import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";
import { requireRole, requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

// ─── Feature flag catalog ───────────────────────────────────────────────────
//
// Adding a flag here lets it appear in the Settings UI and be toggled at
// runtime. The default applies when the flag is missing from the JSON blob.

export const FEATURE_FLAGS: { key: string; label: string; description: string; default: boolean }[] = [
  { key: "escrowModule",         label: "Escrow Module",          description: "Enable escrow account tracking and reconciliation", default: false },
  { key: "snagList",             label: "Snag List",              description: "Defect tracking during the handover phase",         default: false },
  { key: "handoverChecklist",    label: "Handover Checklist",     description: "Step-by-step handover workflow per unit",           default: false },
  { key: "kycVerification",      label: "KYC Verification",       description: "Buyer document verification workflow",              default: true  },
  { key: "commissionTiers",      label: "Commission Tiers",       description: "Multi-tier broker commission rules",                default: false },
  { key: "constructionProgress", label: "Construction Progress",  description: "Project-level construction tracking with media",    default: false },
  { key: "bulkUnitImport",       label: "Bulk Unit Import",       description: "CSV import for unit creation",                      default: true  },
  { key: "publicShareLinks",     label: "Public Share Links",     description: "Anonymous unit/project share URLs",                 default: true  },
  { key: "leadAutoAssignment",   label: "Lead Auto-Assignment",   description: "Round-robin lead routing based on agent capacity",  default: false },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the active organization for settings operations.
 *
 * Today the platform is single-tenant — all routes operate against the first
 * Organization row, auto-created on first access so a fresh DB doesn't 404
 * every settings call. When multi-tenancy ships, switch this to derive from
 * the authenticated user's session.
 */
async function getActiveOrg() {
  const existing = await prisma.organization.findFirst();
  if (existing) return existing;
  // Race-safe bootstrap on a fresh DB: upsert by name so two concurrent
  // requests don't trip the unique constraint on Organization.name.
  const name = process.env.DEFAULT_ORG_NAME ?? "Samha";
  return prisma.organization.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

/**
 * Strip secrets and add `…Set` boolean flags so the client can show a "set /
 * not set" indicator without ever seeing the raw value.
 */
function sanitizeSettings(s: any) {
  if (!s) return s;
  const { smtpPassword, sendgridInboundToken, ...rest } = s;
  return {
    ...rest,
    smtpPasswordSet: Boolean(smtpPassword),
    sendgridInboundTokenSet: Boolean(sendgridInboundToken),
  };
}

const SECRET_KEYS = new Set(["smtpPassword", "sendgridInboundToken"]);

/** Replace secret values with a fixed marker so audit snapshots don't leak them. */
function maskSecrets<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SECRET_KEYS.has(k) ? (v ? "***" : null) : v;
  }
  return out as T;
}

/**
 * Compute the diff between two snapshots. Only keys present in `next` are
 * considered. A key is "changed" when its value differs from the current row.
 */
function diff(prev: Record<string, any>, next: Record<string, any>) {
  const changed: string[] = [];
  const before: Record<string, any> = {};
  const after: Record<string, any> = {};
  for (const k of Object.keys(next)) {
    const a = prev?.[k] ?? null;
    const b = next[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(k);
      before[k] = a;
      after[k] = b;
    }
  }
  return { changed, before, after };
}

/** Resolve the calling user's id from clerkId, falling back to null in dev. */
async function resolveUserId(req: Request): Promise<string | null> {
  if (!req.auth?.userId) return null;
  const u = await prisma.user.findFirst({
    where: { clerkId: req.auth.userId },
    select: { id: true },
  });
  return u?.id ?? null;
}

async function writeAudit(params: {
  req: Request;
  organizationId: string;
  section: string;
  prev: any;
  next: any;
  reason: string | null;
}) {
  const { changed, before, after } = diff(params.prev ?? {}, params.next ?? {});
  if (changed.length === 0) return null;

  const userId = await resolveUserId(params.req);
  return prisma.settingsAuditLog.create({
    data: {
      organizationId: params.organizationId,
      section: params.section,
      changedFields: changed,
      before: maskSecrets(before),
      after: maskSecrets(after),
      reason: params.reason && params.reason.trim() ? params.reason.trim().slice(0, 1000) : null,
      userId,
      ip: (req => req.ip ?? null)(params.req),
      userAgent: (params.req.headers["user-agent"] as string | undefined) ?? null,
    },
  });
}

/** Build a Prisma update payload that only writes keys explicitly provided. */
function pickProvided<T extends Record<string, any>>(input: T, keys: readonly (keyof T)[]) {
  const out: Record<string, any> = {};
  for (const k of keys) if (input[k] !== undefined) out[k as string] = input[k];
  return out;
}

/** Standard error responder. */
function fail(res: Response, status: number, error: string, code: string, details?: unknown) {
  return res.status(status).json({ error, code, statusCode: status, details });
}

// ─── Validation schemas ─────────────────────────────────────────────────────

const reasonField = z.string().max(1000).optional();

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color");

const brandingSchema = z.object({
  companyName: z.string().min(1).max(120).optional().nullable(),
  logoUrl: z.string().url().max(2048).optional().nullable().or(z.literal("")),
  primaryColor: hexColor.optional().nullable().or(z.literal("")),
  secondaryColor: hexColor.optional().nullable().or(z.literal("")),
  theme: z.enum(["light", "dark", "system"]).optional(),
  _reason: reasonField,
});

const TIMEZONES = [
  "Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
] as const;
const CURRENCIES = ["AED", "SAR", "USD", "EUR", "GBP", "QAR", "KWD", "BHD", "OMR"] as const;
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

const localizationSchema = z.object({
  timezone: z.enum(TIMEZONES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
  _reason: reasonField,
});

const communicationSchema = z.object({
  defaultFromName: z.string().max(120).optional().nullable(),
  defaultFromEmail: z.string().email().max(254).optional().nullable().or(z.literal("")),
  emailProvider: z.enum(["", "sendgrid", "smtp", "mailgun", "ses"]).optional(),
  whatsappNumber: z.string().max(32).optional().nullable(),
  smsProvider: z.enum(["", "twilio", "unifonic", "stc"]).optional(),
  smtpHost: z.string().max(253).optional().nullable(),
  smtpPort: z.union([z.number().int().min(1).max(65535), z.literal(""), z.null()]).optional(),
  smtpUsername: z.string().max(254).optional().nullable(),
  smtpPassword: z.string().max(512).optional(), // empty / undefined = no edit
  _reason: reasonField,
});

const integrationsSchema = z.object({
  twilioWhatsappFrom: z.string().max(64).optional().nullable(),
  twilioMessagingServiceSid: z.string().max(64).optional().nullable(),
  twilioWhatsappContentSidBeforeDue: z.string().max(64).optional().nullable(),
  twilioWhatsappContentSidOnDue: z.string().max(64).optional().nullable(),
  twilioWhatsappContentSidOverdue7: z.string().max(64).optional().nullable(),
  twilioWhatsappContentSidOverdue30: z.string().max(64).optional().nullable(),
  inboundEmailDomain: z.string().max(253).optional().nullable(),
  sendgridInboundToken: z.string().max(256).optional(), // empty = no edit
  _reason: reasonField,
});

const financeSchema = z.object({
  paymentInstructions: z.string().max(8000).optional().nullable(),
  _reason: reasonField,
});

const TEMPLATE_KEYS = ["beforeDue", "onDue", "overdue7", "overdue30"] as const;
type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const templatesSchema = z.object({
  emailTemplates: z
    .record(z.string(), z.string().max(20000))
    .refine(
      (obj) => Object.keys(obj).every((k) => (TEMPLATE_KEYS as readonly string[]).includes(k)),
      { message: `Unknown template key. Allowed: ${TEMPLATE_KEYS.join(", ")}` },
    )
    .optional(),
  _reason: reasonField,
});

const notificationsSchema = z.object({
  notificationPrefs: z.record(z.string(), z.any()).optional(),
  _reason: reasonField,
});

const themeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  _reason: reasonField,
});

const featureFlagsSchema = z.object({
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  _reason: reasonField,
});

// ─── Auth ────────────────────────────────────────────────────────────────────

const adminOnly = [requireAuthentication, requireRole(["ADMIN"])];

// ─── GET / ──────────────────────────────────────────────────────────────────

router.get("/", requireAuthentication, async (_req, res) => {
  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    let settings = await prisma.appSettings.findUnique({ where: { organizationId: org.id } });
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          organizationId: org.id,
          companyName: org.name,
          timezone: org.timezone,
          currency: org.currency,
        },
      });
    }
    res.json(sanitizeSettings(settings));
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to load settings", "INTERNAL_ERROR");
  }
});

// ─── Sectioned PATCH endpoints ──────────────────────────────────────────────
//
// Each section validates only its own fields, runs the diff, persists, and
// records an audit row. Splitting them keeps the surface area small and lets
// the UI save one card at a time without touching unrelated config.

function makeSectionRoute(opts: {
  section: string;
  schema: z.ZodTypeAny;
  /** Map validated input → Prisma update payload. Pulls _reason out for you. */
  toUpdate: (data: any, current: any) => Record<string, any>;
}) {
  return async (req: Request, res: Response) => {
    try {
      const org = await getActiveOrg();
      if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

      const parsed = opts.schema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
        return fail(res, 400, details[0] ?? "Validation failed", "VALIDATION_ERROR", details);
      }

      const { _reason, ...data } = parsed.data as Record<string, any>;
      const current = await prisma.appSettings.findUnique({ where: { organizationId: org.id } });
      const updatePayload = opts.toUpdate(data, current);

      const next = await prisma.appSettings.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          timezone: org.timezone,
          currency: org.currency,
          ...updatePayload,
        },
        update: updatePayload,
      });

      await writeAudit({
        req,
        organizationId: org.id,
        section: opts.section,
        prev: current ?? {},
        next: updatePayload,
        reason: _reason ?? null,
      });

      res.json(sanitizeSettings(next));
    } catch (err: any) {
      fail(res, 500, err.message ?? "Failed to update settings", "INTERNAL_ERROR");
    }
  };
}

router.patch(
  "/branding",
  ...adminOnly,
  makeSectionRoute({
    section: "branding",
    schema: brandingSchema,
    toUpdate: (data) =>
      pickProvided(data, ["companyName", "logoUrl", "primaryColor", "secondaryColor", "theme"] as const),
  }),
);

router.patch(
  "/localization",
  ...adminOnly,
  makeSectionRoute({
    section: "localization",
    schema: localizationSchema,
    toUpdate: (data) => pickProvided(data, ["timezone", "currency", "dateFormat"] as const),
  }),
);

router.patch(
  "/communication",
  ...adminOnly,
  makeSectionRoute({
    section: "communication",
    schema: communicationSchema,
    toUpdate: (data) => {
      const out: Record<string, any> = pickProvided(data, [
        "defaultFromName",
        "defaultFromEmail",
        "emailProvider",
        "whatsappNumber",
        "smsProvider",
        "smtpHost",
        "smtpUsername",
      ] as const);
      // Treat empty string as "clear it" for the port; preserve undefined as "no edit".
      if (data.smtpPort !== undefined) {
        out.smtpPort = data.smtpPort === "" || data.smtpPort === null ? null : Number(data.smtpPort);
      }
      // Password: only update when non-empty. Empty string / undefined keeps existing.
      if (data.smtpPassword !== undefined && data.smtpPassword !== "") {
        out.smtpPassword = data.smtpPassword;
      }
      return out;
    },
  }),
);

router.patch(
  "/integrations",
  ...adminOnly,
  makeSectionRoute({
    section: "integrations",
    schema: integrationsSchema,
    toUpdate: (data) => {
      const out: Record<string, any> = pickProvided(data, [
        "twilioWhatsappFrom",
        "twilioMessagingServiceSid",
        "twilioWhatsappContentSidBeforeDue",
        "twilioWhatsappContentSidOnDue",
        "twilioWhatsappContentSidOverdue7",
        "twilioWhatsappContentSidOverdue30",
        "inboundEmailDomain",
      ] as const);
      if (data.sendgridInboundToken !== undefined && data.sendgridInboundToken !== "") {
        out.sendgridInboundToken = data.sendgridInboundToken;
      }
      return out;
    },
  }),
);

router.patch(
  "/finance",
  ...adminOnly,
  makeSectionRoute({
    section: "finance",
    schema: financeSchema,
    toUpdate: (data) => pickProvided(data, ["paymentInstructions"] as const),
  }),
);

router.patch(
  "/templates",
  ...adminOnly,
  makeSectionRoute({
    section: "templates",
    schema: templatesSchema,
    toUpdate: (data) => pickProvided(data, ["emailTemplates"] as const),
  }),
);

router.patch(
  "/notifications",
  ...adminOnly,
  makeSectionRoute({
    section: "notifications",
    schema: notificationsSchema,
    toUpdate: (data) => pickProvided(data, ["notificationPrefs"] as const),
  }),
);

router.patch(
  "/theme",
  ...adminOnly,
  makeSectionRoute({
    section: "theme",
    schema: themeSchema,
    toUpdate: (data) => pickProvided(data, ["theme"] as const),
  }),
);

router.patch(
  "/feature-flags",
  ...adminOnly,
  makeSectionRoute({
    section: "feature-flags",
    schema: featureFlagsSchema,
    toUpdate: (data) => pickProvided(data, ["featureFlags"] as const),
  }),
);

// Public catalog so the UI knows which flags exist + their defaults.
router.get("/feature-flags/catalog", requireAuthentication, (_req, res) => {
  res.json({ flags: FEATURE_FLAGS });
});

// ─── Legacy single-PATCH endpoint (deprecated) ──────────────────────────────
//
// Kept for backwards compat with any external callers. Routes the request to
// the matching section endpoints based on which fields are present.

router.patch("/", ...adminOnly, async (req, res) => {
  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const current = await prisma.appSettings.findUnique({ where: { organizationId: org.id } });
    const body = req.body ?? {};
    const reason: string | null = typeof body._reason === "string" ? body._reason : null;

    // Whitelist of editable fields — silently drops unknown keys.
    const ALLOWED = [
      "companyName", "logoUrl", "primaryColor", "secondaryColor",
      "timezone", "currency", "dateFormat",
      "defaultFromName", "defaultFromEmail", "emailProvider",
      "whatsappNumber", "smsProvider",
      "smtpHost", "smtpPort", "smtpUsername", "smtpPassword",
      "twilioWhatsappFrom", "twilioMessagingServiceSid",
      "twilioWhatsappContentSidBeforeDue", "twilioWhatsappContentSidOnDue",
      "twilioWhatsappContentSidOverdue7", "twilioWhatsappContentSidOverdue30",
      "inboundEmailDomain", "sendgridInboundToken",
      "paymentInstructions", "emailTemplates", "notificationPrefs",
      "theme", "featureFlags",
    ] as const;

    const update: Record<string, any> = {};
    for (const k of ALLOWED) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (update.smtpPort !== undefined && update.smtpPort !== null && update.smtpPort !== "") {
      update.smtpPort = Number(update.smtpPort);
    }
    // Password / token: drop if empty so we don't clobber existing secret with "".
    if (update.smtpPassword === "") delete update.smtpPassword;
    if (update.sendgridInboundToken === "") delete update.sendgridInboundToken;

    const next = await prisma.appSettings.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        timezone: org.timezone,
        currency: org.currency,
        ...update,
      },
      update,
    });

    await writeAudit({
      req,
      organizationId: org.id,
      section: "legacy",
      prev: current ?? {},
      next: update,
      reason,
    });

    res.json(sanitizeSettings(next));
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to update settings", "INTERNAL_ERROR");
  }
});

// ─── Test SMTP ──────────────────────────────────────────────────────────────

router.post("/test-smtp", ...adminOnly, async (req, res) => {
  const schema = z.object({ to: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid email address", "VALIDATION_ERROR");
  }

  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const s = await prisma.appSettings.findUnique({ where: { organizationId: org.id } });
    if (!s?.smtpHost) {
      return fail(res, 400, "SMTP not configured. Save host/port/credentials first.", "SMTP_NOT_CONFIGURED");
    }

    const port = s.smtpPort ?? 587;
    const transporter = nodemailer.createTransport({
      host: s.smtpHost,
      port,
      secure: port === 465,
      auth: s.smtpUsername ? { user: s.smtpUsername, pass: (s as any).smtpPassword ?? "" } : undefined,
    });

    // Verify before sending so users get a clean diagnostic, not a bounce.
    await transporter.verify();

    const fromName = s.defaultFromName ?? "Samha CRM";
    const fromEmail = s.defaultFromEmail ?? "noreply@samha.ae";
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: parsed.data.to,
      subject: "Samha CRM — SMTP test",
      text: `This is a test email from your Samha CRM settings.\n\nHost: ${s.smtpHost}:${port}\nFrom: ${fromEmail}\nSent: ${new Date().toISOString()}\n\nIf you received this, your SMTP configuration is working.`,
      html: `<p>This is a test email from your <strong>Samha CRM</strong> settings.</p><ul><li>Host: <code>${s.smtpHost}:${port}</code></li><li>From: <code>${fromEmail}</code></li><li>Sent: <code>${new Date().toISOString()}</code></li></ul><p>If you received this, your SMTP configuration is working.</p>`,
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (err: any) {
    fail(res, 502, err.message ?? "SMTP send failed", "SMTP_SEND_FAILED");
  }
});

// ─── Template preview ───────────────────────────────────────────────────────

router.post("/templates/preview", ...adminOnly, async (req, res) => {
  const schema = z.object({ key: z.enum(TEMPLATE_KEYS) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid template key", "VALIDATION_ERROR");

  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const s = await prisma.appSettings.findUnique({ where: { organizationId: org.id } });
    const templates = (s?.emailTemplates as Record<TemplateKey, string> | null) ?? {} as Record<TemplateKey, string>;
    const userTemplate = templates[parsed.data.key];

    const SAMPLE = {
      BuyerName: "Ahmed Al Maktoum",
      UnitNumber: "JVC-A-1204",
      Amount: `${s?.currency ?? "AED"} 250,000`,
      DueDate: new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("en-GB"),
      ProjectName: "Jumeirah Heights",
      Milestone: "20% Construction Milestone",
    };

    const subjectByKey: Record<TemplateKey, string> = {
      beforeDue: `Payment Reminder – Unit ${SAMPLE.UnitNumber} (due in 7 days)`,
      onDue: `Payment Due Today – Unit ${SAMPLE.UnitNumber}`,
      overdue7: `Payment Overdue – Unit ${SAMPLE.UnitNumber}`,
      overdue30: `FINAL NOTICE: Payment Overdue – Unit ${SAMPLE.UnitNumber}`,
    };

    const fallback = `Dear {{BuyerName}},\n\nYour payment of {{Amount}} for {{Milestone}} is due on {{DueDate}}.\n\nUnit: {{UnitNumber}}\nProject: {{ProjectName}}\n\nThank you.`;

    const raw = (userTemplate ?? fallback);
    const text = raw.replace(/\{\{(\w+)\}\}/g, (_, k) => (SAMPLE as Record<string, string>)[k] ?? `{{${k}}}`);
    const html = text.replace(/\n/g, "<br>");

    res.json({ subject: subjectByKey[parsed.data.key], text, html, sample: SAMPLE });
  } catch (err: any) {
    fail(res, 500, err.message ?? "Preview failed", "INTERNAL_ERROR");
  }
});

// ─── Audit log ──────────────────────────────────────────────────────────────

router.get("/audit-log", ...adminOnly, async (req, res) => {
  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const format = req.query.format === "csv" ? "csv" : "json";
    // CSV exports default to a wider window since they're meant for analysis.
    const defaultLimit = format === "csv" ? 1000 : 50;
    const limit = Math.min(Math.max(Number(req.query.limit ?? defaultLimit), 1), format === "csv" ? 5000 : 200);
    const section = typeof req.query.section === "string" && req.query.section ? req.query.section : undefined;
    const userId = typeof req.query.userId === "string" && req.query.userId ? req.query.userId : undefined;

    const where = {
      organizationId: org.id,
      ...(section ? { section } : {}),
      ...(userId ? { userId } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.settingsAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      prisma.settingsAuditLog.count({ where }),
    ]);

    if (format === "csv") {
      const csv = toCsv(data);
      const filename = `settings-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    res.json({ data, total });
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to load audit log", "INTERNAL_ERROR");
  }
});

/** Excel-friendly CSV: BOM, CRLF line endings, double-quoted strings. */
function toCsv(rows: any[]): string {
  const header = ["createdAt", "section", "user", "userRole", "ip", "changedFields", "reason", "before", "after"];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      escape(r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt),
      escape(r.section),
      escape(r.user ? `${r.user.name} <${r.user.email}>` : ""),
      escape(r.user?.role ?? ""),
      escape(r.ip ?? ""),
      escape(Array.isArray(r.changedFields) ? r.changedFields.join("; ") : r.changedFields),
      escape(r.reason ?? ""),
      escape(r.before),
      escape(r.after),
    ].join(","));
  }
  // BOM keeps Excel happy with non-ASCII chars.
  return "﻿" + lines.join("\r\n");
}

// ─── System info / diagnostics ──────────────────────────────────────────────

router.get("/system-info", ...adminOnly, async (_req, res) => {
  try {
    const org = await getActiveOrg();

    // DB ping — measure round-trip in ms.
    const t0 = Date.now();
    let dbOk = false;
    let dbError: string | null = null;
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      dbOk = true;
    } catch (e: any) {
      dbError = e.message ?? String(e);
    }
    const dbLatencyMs = Date.now() - t0;

    const [userCount, dealCount, unitCount, leadCount, jobsPending, auditCount] = await Promise.all([
      prisma.user.count(),
      prisma.deal.count(),
      prisma.unit.count(),
      prisma.lead.count(),
      prisma.backgroundJob.count({ where: { status: "PENDING" } }).catch(() => 0),
      prisma.settingsAuditLog.count().catch(() => 0),
    ]);

    res.json({
      app: {
        nodeEnv: process.env.NODE_ENV ?? "development",
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        clerkAuth: Boolean(process.env.CLERK_SECRET_KEY),
        memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      },
      organization: org ? { id: org.id, name: org.name, country: org.country } : null,
      database: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      counts: { users: userCount, deals: dealCount, units: unitCount, leads: leadCount, settingsAuditEntries: auditCount },
      backgroundJobs: { pending: jobsPending },
    });
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to load system info", "INTERNAL_ERROR");
  }
});

// ─── API keys ───────────────────────────────────────────────────────────────
//
// Issued for non-user integrations (mobile portal, broker app, public lead form).
// Tokens are SHA-256-hashed in the DB. The plaintext is shown to the admin
// exactly once at creation; after that it's unrecoverable. To rotate, revoke
// and create a new one.

export const API_KEY_SCOPES = [
  "leads:read", "leads:create",
  "deals:read", "deals:create",
  "units:read",
  "documents:read", "documents:create",
  "payments:read",
  "webhooks:receive",
] as const;

const TOKEN_PREFIX = "sk_";

function generateApiToken(): { plaintext: string; prefix: string; hash: string } {
  // 32 bytes -> 43 base64url chars. Plenty of entropy.
  const random = crypto.randomBytes(32).toString("base64url");
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const prefix = plaintext.slice(0, 11); // "sk_" + 8 chars
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

const createKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, "Pick at least one scope"),
  expiresAt: z.string().datetime().optional().nullable().or(z.literal("")),
});

router.get("/api-keys", ...adminOnly, async (_req, res) => {
  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    // Never include hashedKey in responses.
    const data = keys.map((k: any) => { const { hashedKey: _h, ...rest } = k; return rest; });
    res.json({ data, scopes: API_KEY_SCOPES });
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to load keys", "INTERNAL_ERROR");
  }
});

router.post("/api-keys", ...adminOnly, async (req, res) => {
  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      return fail(res, 400, details[0] ?? "Validation failed", "VALIDATION_ERROR", details);
    }

    const { plaintext, prefix, hash } = generateApiToken();
    const createdById = await resolveUserId(req);

    const expiresAt = parsed.data.expiresAt && parsed.data.expiresAt !== ""
      ? new Date(parsed.data.expiresAt)
      : null;

    const key = await prisma.apiKey.create({
      data: {
        organizationId: org.id,
        name: parsed.data.name,
        prefix,
        hashedKey: hash,
        scopes: parsed.data.scopes,
        expiresAt,
        createdById,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });

    // Audit-log the creation. The plaintext is NOT recorded — only metadata.
    await prisma.settingsAuditLog.create({
      data: {
        organizationId: org.id,
        section: "api-keys",
        changedFields: ["created"],
        // Prisma typing wants undefined (not null) for missing JSON; behavior is identical.
        after: { id: key.id, name: key.name, prefix, scopes: parsed.data.scopes, expiresAt },
        reason: typeof req.body._reason === "string" ? req.body._reason.slice(0, 1000) : null,
        userId: createdById,
        ip: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      },
    });

    const { hashedKey: _h, ...keyOut } = key as any;
    res.status(201).json({
      key: keyOut,
      // ⚠ Plaintext returned exactly once. Client must save it now.
      plaintext,
      message: "Save this token now. It cannot be shown again — only revoked.",
    });
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to create key", "INTERNAL_ERROR");
  }
});

router.post("/api-keys/:id/revoke", ...adminOnly, async (req, res) => {
  try {
    const org = await getActiveOrg();
    if (!org) return fail(res, 404, "Organization not found", "NOT_FOUND");

    const existing = await prisma.apiKey.findFirst({
      where: { id: req.params.id, organizationId: org.id },
    });
    if (!existing) return fail(res, 404, "Key not found", "NOT_FOUND");
    if (existing.revokedAt) return fail(res, 400, "Key is already revoked", "ALREADY_REVOKED");

    const now = new Date();
    await prisma.apiKey.update({ where: { id: existing.id }, data: { revokedAt: now } });

    const userId = await resolveUserId(req);
    await prisma.settingsAuditLog.create({
      data: {
        organizationId: org.id,
        section: "api-keys",
        changedFields: ["revoked"],
        before: { id: existing.id, name: existing.name, revokedAt: null },
        after:  { id: existing.id, name: existing.name, revokedAt: now },
        reason: typeof req.body?._reason === "string" ? req.body._reason.slice(0, 1000) : null,
        userId,
        ip: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      },
    });

    res.json({ ok: true, revokedAt: now });
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to revoke key", "INTERNAL_ERROR");
  }
});

// ─── Per-user notification preferences ──────────────────────────────────────
//
// Org-wide prefs (in AppSettings.notificationPrefs) define defaults; users
// can override them on a per-channel basis. Anyone can edit their own prefs;
// only ADMIN can edit someone else's.

const userNotifPrefsSchema = z.object({
  notificationPrefs: z.record(z.string(), z.any()),
});

router.get("/user-prefs/:userId", requireAuthentication, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, name: true, notificationPrefs: true },
    });
    if (!target) return fail(res, 404, "User not found", "NOT_FOUND");
    res.json(target);
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to load prefs", "INTERNAL_ERROR");
  }
});

router.patch("/user-prefs/:userId", requireAuthentication, async (req, res) => {
  try {
    const callerId = await resolveUserId(req);
    const caller = callerId ? await prisma.user.findUnique({ where: { id: callerId }, select: { role: true } }) : null;
    const isAdmin = caller?.role === "ADMIN";
    const isSelf = callerId === req.params.userId;

    if (!isAdmin && !isSelf) {
      return fail(res, 403, "Can only edit your own preferences", "FORBIDDEN");
    }

    const parsed = userNotifPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      return fail(res, 400, details[0] ?? "Validation failed", "VALIDATION_ERROR", details);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data: { notificationPrefs: parsed.data.notificationPrefs },
      select: { id: true, name: true, notificationPrefs: true },
    });
    res.json(updated);
  } catch (err: any) {
    fail(res, 500, err.message ?? "Failed to update prefs", "INTERNAL_ERROR");
  }
});

export default router;
