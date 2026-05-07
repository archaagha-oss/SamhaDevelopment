import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export interface PublicSettings {
  id?: string;
  organizationId: string;

  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;

  timezone: string;
  currency: string;
  dateFormat: string;

  defaultFromEmail: string | null;
  defaultFromName: string | null;
  whatsappNumber: string | null;
  smsProvider: string | null;
  emailProvider: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPasswordSet: boolean;

  paymentInstructions: string | null;
  emailTemplates: Record<string, string>;
  notificationPrefs: Record<string, unknown>;

  updatedAt?: Date;
}

const SECRET_FIELDS = ["smtpPassword"] as const;

/**
 * Resolve the active organization. We use `findFirst` because the app is
 * single-tenant in dev. When multi-tenancy lands, derive this from
 * `req.auth.orgId` and remove this helper.
 */
export async function getActiveOrg() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    const err: any = new Error("Organization not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  return org;
}

export async function loadOrCreateSettings() {
  const org = await getActiveOrg();
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
  return { org, settings };
}

/** Strip secrets and shape the row for client consumption. */
export function toPublicSettings(row: any): PublicSettings {
  return {
    id:             row.id,
    organizationId: row.organizationId,

    companyName:  row.companyName  ?? null,
    logoUrl:      row.logoUrl      ?? null,
    primaryColor: row.primaryColor ?? null,

    timezone:   row.timezone,
    currency:   row.currency,
    dateFormat: row.dateFormat,

    defaultFromEmail: row.defaultFromEmail ?? null,
    defaultFromName:  row.defaultFromName  ?? null,
    whatsappNumber:   row.whatsappNumber   ?? null,
    smsProvider:      row.smsProvider      ?? null,
    emailProvider:    row.emailProvider    ?? null,
    smtpHost:         row.smtpHost         ?? null,
    smtpPort:         row.smtpPort         ?? null,
    smtpUsername:     row.smtpUsername     ?? null,
    smtpPasswordSet:  Boolean(row.smtpPassword && String(row.smtpPassword).length > 0),

    paymentInstructions: row.paymentInstructions ?? null,
    emailTemplates:      (row.emailTemplates    as Record<string, string>) ?? {},
    notificationPrefs:   (row.notificationPrefs as Record<string, unknown>) ?? {},

    updatedAt: row.updatedAt,
  };
}

interface AuditCtx {
  userId: string | null;
  section: "branding" | "localization" | "communication" | "finance" | "templates" | "notifications";
  changedFields: string[];
}

/**
 * Lightweight audit log. Persists to the application logger so a search of the
 * logs surfaces every settings change with userId + section + fields. DB-backed
 * audit can be added later via a SettingsAuditLog model.
 */
export function recordAudit(ctx: AuditCtx) {
  if (ctx.changedFields.length === 0) return;
  // Never log secret values, only their field names.
  logger.info("settings.update", {
    userId:        ctx.userId,
    section:       ctx.section,
    changedFields: ctx.changedFields,
    timestamp:     new Date().toISOString(),
  });
}

/**
 * Compute which fields actually changed between an existing row and a patch
 * object so the audit log is precise.
 */
export function diffFields<T extends Record<string, any>>(before: T, patch: Partial<T>): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(patch)) {
    const next = patch[key];
    if (next === undefined) continue;
    const prev = before[key];
    if (SECRET_FIELDS.includes(key as any)) {
      // For secrets, only mark changed if a non-empty replacement was sent.
      if (typeof next === "string" && next.length > 0 && next !== prev) changed.push(key);
      else if (next === null && prev) changed.push(key); // explicit clear
      continue;
    }
    if (JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null)) changed.push(key);
  }
  return changed;
}

/**
 * Apply a communication patch with smtpPassword semantics:
 *   undefined → leave unchanged
 *   null      → clear it
 *   ""        → leave unchanged (UI's "no edit" sentinel)
 *   string    → replace
 */
export function applyCommunicationPatch(patch: any): Record<string, any> {
  const data: Record<string, any> = {};
  const passthrough = [
    "defaultFromName", "defaultFromEmail", "whatsappNumber",
    "smsProvider", "emailProvider", "smtpHost", "smtpUsername",
  ];
  for (const k of passthrough) {
    if (patch[k] !== undefined) data[k] = patch[k] === "" ? null : patch[k];
  }
  if (patch.smtpPort !== undefined) {
    data.smtpPort = patch.smtpPort === "" || patch.smtpPort === null ? null : Number(patch.smtpPort);
  }
  if (patch.smtpPassword !== undefined) {
    if (patch.smtpPassword === null) data.smtpPassword = null;
    else if (typeof patch.smtpPassword === "string" && patch.smtpPassword.length > 0) {
      data.smtpPassword = patch.smtpPassword;
    }
    // empty string → leave unchanged
  }
  return data;
}
