import { Router, type Request } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  brandingSchema,
  localizationSchema,
  communicationSchema,
  financeSchema,
  templatesSchema,
  notificationsSchema,
  testSmtpSchema,
  previewTemplateSchema,
} from "../schemas/settings";
import {
  loadOrCreateSettings,
  toPublicSettings,
  recordAudit,
  diffFields,
  applyCommunicationPatch,
  snapshotFields,
  type SettingsSection,
} from "../services/settingsService";
import {
  sendEmail,
  buildBeforeDueEmail,
  buildOnDueEmail,
  buildOverdueEmail,
  refreshSettingsCache,
} from "../services/mailerService";

const router = Router();

const ADMIN_ONLY = ["ADMIN"];

router.use(requireAuthentication);

// ─── Read ────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    res.json(toPublicSettings(settings));
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const userIdFrom = (req: Request): string | null =>
  (req as any).resolvedUser?.id ?? req.auth?.userId ?? null;

const ipFrom = (req: Request): string | null =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

const uaFrom = (req: Request): string | null =>
  (req.headers["user-agent"] as string) ?? null;

interface SectionContext {
  req: Request;
  section: SettingsSection;
  before: any;
  data: Record<string, any>;
  changed: string[];
  reason: string | null;
}

async function commitSection(ctx: SectionContext) {
  const updated = await prisma.appSettings.update({ where: { id: ctx.before.id }, data: ctx.data });
  await recordAudit({
    appSettingsId: ctx.before.id,
    userId:        userIdFrom(ctx.req),
    section:       ctx.section,
    changedFields: ctx.changed,
    before:        snapshotFields(ctx.before, ctx.changed),
    after:         snapshotFields(updated,    ctx.changed),
    reason:        ctx.reason,
    ip:            ipFrom(ctx.req),
    userAgent:     uaFrom(ctx.req),
  });
  return updated;
}

const reasonFrom = (req: Request): string | null => {
  const r = (req.body as any)?._reason;
  return typeof r === "string" && r.trim().length > 0 ? r.trim().slice(0, 500) : null;
};

const stripMeta = (body: any) => {
  if (body && typeof body === "object") delete body._reason;
  return body;
};

// ─── Per-section update ─────────────────────────────────────────────────────

router.patch("/branding", requireRole(ADMIN_ONLY), validate(brandingSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data: Record<string, any> = { ...stripMeta(req.body) };
    for (const k of Object.keys(data)) if (data[k] === "") data[k] = null;
    const changed = diffFields(settings, data);
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await commitSection({ req, section: "branding", before: settings, data, changed, reason: reasonFrom(req) });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/localization", requireRole(ADMIN_ONLY), validate(localizationSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data = { ...stripMeta(req.body) };
    const changed = diffFields(settings, data);
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await commitSection({ req, section: "localization", before: settings, data, changed, reason: reasonFrom(req) });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/communication", requireRole(ADMIN_ONLY), validate(communicationSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data = applyCommunicationPatch(stripMeta(req.body));
    const changed = diffFields(settings, data);
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await commitSection({ req, section: "communication", before: settings, data, changed, reason: reasonFrom(req) });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/finance", requireRole(ADMIN_ONLY), validate(financeSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data = { ...stripMeta(req.body) };
    const changed = diffFields(settings, data);
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await commitSection({ req, section: "finance", before: settings, data, changed, reason: reasonFrom(req) });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/templates", requireRole(ADMIN_ONLY), validate(templatesSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const beforeTemplates = (settings.emailTemplates as any) ?? {};
    const merged = { ...beforeTemplates, ...req.body.emailTemplates };
    const changed = Object.keys(req.body.emailTemplates).filter(
      (k) => JSON.stringify(beforeTemplates[k] ?? null) !== JSON.stringify(req.body.emailTemplates[k] ?? null),
    );
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await prisma.appSettings.update({
      where: { id: settings.id },
      data:  { emailTemplates: merged },
    });
    await recordAudit({
      appSettingsId: settings.id,
      userId:        userIdFrom(req),
      section:       "templates",
      changedFields: changed,
      before:        Object.fromEntries(changed.map((k) => [k, beforeTemplates[k] ?? null])),
      after:         Object.fromEntries(changed.map((k) => [k, merged[k] ?? null])),
      reason:        reasonFrom(req),
      ip:            ipFrom(req),
      userAgent:     uaFrom(req),
    });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/notifications", requireRole(ADMIN_ONLY), validate(notificationsSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const beforePrefs = (settings.notificationPrefs as any) ?? {};
    const merged = { ...beforePrefs, ...req.body.notificationPrefs };
    const changed = Object.keys(req.body.notificationPrefs).filter(
      (k) => JSON.stringify(beforePrefs[k] ?? null) !== JSON.stringify(req.body.notificationPrefs[k] ?? null),
    );
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await prisma.appSettings.update({
      where: { id: settings.id },
      data:  { notificationPrefs: merged },
    });
    await recordAudit({
      appSettingsId: settings.id,
      userId:        userIdFrom(req),
      section:       "notifications",
      changedFields: changed,
      before:        Object.fromEntries(changed.map((k) => [k, beforePrefs[k] ?? null])),
      after:         Object.fromEntries(changed.map((k) => [k, merged[k] ?? null])),
      reason:        reasonFrom(req),
      ip:            ipFrom(req),
      userAgent:     uaFrom(req),
    });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

// ─── Audit log read ─────────────────────────────────────────────────────────

router.get("/audit-log", requireRole(ADMIN_ONLY), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const section = typeof req.query.section === "string" ? req.query.section : undefined;

    const where: Record<string, any> = { appSettingsId: settings.id };
    if (section) where.section = section;

    const [items, total] = await Promise.all([
      (prisma as any).settingsAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      (prisma as any).settingsAuditLog.count({ where }),
    ]);

    // Resolve user names where possible — best effort.
    const userIds = Array.from(new Set(items.map((i: any) => i.userId).filter(Boolean) as string[]));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { OR: [{ id: { in: userIds } }, { clerkId: { in: userIds } }] },
          select: { id: true, clerkId: true, name: true, role: true },
        })
      : [];
    const userMap = new Map<string, { name: string; role: string }>();
    for (const u of users) {
      userMap.set(u.id, { name: u.name, role: u.role });
      if (u.clerkId) userMap.set(u.clerkId, { name: u.name, role: u.role });
    }

    res.json({
      data: items.map((i: any) => ({
        ...i,
        user: i.userId ? userMap.get(i.userId) ?? null : null,
      })),
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    if (/settingsAuditLog/i.test(err?.message ?? "")) {
      // Model not migrated yet — return empty result with a hint.
      return res.json({
        data: [],
        total: 0,
        limit: 0,
        offset: 0,
        warning: "SettingsAuditLog table not yet migrated. Run `npm run db:push` in apps/api.",
      });
    }
    next(err);
  }
});

// ─── Test endpoints ─────────────────────────────────────────────────────────

router.post("/test-smtp", requireRole(ADMIN_ONLY), validate(testSmtpSchema), async (req, res, next) => {
  try {
    const result = await sendEmail({
      to: req.body.to,
      subject: "Samha CRM — SMTP test message",
      text: "If you received this, your SMTP configuration is working.",
      html: "<p>If you received this, your SMTP configuration is working.</p>",
    });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

router.post("/templates/preview", requireRole(ADMIN_ONLY), validate(previewTemplateSchema), async (req, res, next) => {
  try {
    await refreshSettingsCache();
    const sampleVars = {
      buyerName:      req.body.vars?.buyerName      ?? "John Doe",
      unitNumber:     req.body.vars?.unitNumber     ?? "A-1204",
      projectName:    req.body.vars?.projectName    ?? "Marina Heights",
      milestoneLabel: req.body.vars?.milestoneLabel ?? "1st installment (10%)",
      dueDate:        req.body.vars?.dueDate        ?? "30 June 2026",
      amount:         req.body.vars?.amount         ?? "AED 250,000",
    };
    let preview;
    if (req.body.key === "beforeDue")     preview = buildBeforeDueEmail(sampleVars);
    else if (req.body.key === "onDue")    preview = buildOnDueEmail(sampleVars);
    else if (req.body.key === "overdue7") preview = buildOverdueEmail(sampleVars, 7);
    else                                  preview = buildOverdueEmail(sampleVars, 30);
    res.json(preview);
  } catch (err) { next(err); }
});

// ─── Backwards-compat: keep the old PATCH / for clients that still send
// the whole bundle. New clients should use the per-section endpoints.
// ─────────────────────────────────────────────────────────────────────────────

router.patch("/", requireRole(ADMIN_ONLY), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data: Record<string, any> = {};

    const passthrough = [
      "companyName", "logoUrl", "primaryColor",
      "timezone", "currency", "dateFormat",
      "paymentInstructions",
    ];
    for (const k of passthrough) if (req.body[k] !== undefined) data[k] = req.body[k];
    Object.assign(data, applyCommunicationPatch(req.body));

    if (req.body.emailTemplates !== undefined) {
      data.emailTemplates = { ...(settings.emailTemplates as any ?? {}), ...req.body.emailTemplates };
    }
    if (req.body.notificationPrefs !== undefined) {
      data.notificationPrefs = { ...(settings.notificationPrefs as any ?? {}), ...req.body.notificationPrefs };
    }

    const changed = diffFields(settings, data);
    if (changed.length === 0) return res.json(toPublicSettings(settings));
    const updated = await commitSection({ req, section: "branding", before: settings, data, changed, reason: reasonFrom(req) });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

export default router;
