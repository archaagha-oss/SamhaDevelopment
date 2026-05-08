import { z } from "zod";

// ── Allowed values ─────────────────────────────────────────────────────────
// Keep these in sync with apps/web/src/pages/SettingsPage.tsx.

export const TIMEZONES = [
  "Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
] as const;

export const CURRENCIES = ["AED", "SAR", "USD", "EUR", "GBP", "QAR", "KWD", "BHD", "OMR"] as const;

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

export const EMAIL_PROVIDERS = ["", "sendgrid", "smtp", "mailgun", "ses"] as const;
export const SMS_PROVIDERS   = ["", "twilio", "unifonic", "stc"] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex like #2563eb");

// ── Per-section payloads (PATCH bodies) ───────────────────────────────────

export const brandingSchema = z.object({
  companyName:  z.string().trim().min(1).max(120).optional(),
  logoUrl:      z.string().trim().url().or(z.literal("")).optional(),
  primaryColor: hexColor.or(z.literal("")).optional(),
}).strict();

export const localizationSchema = z.object({
  timezone:   z.enum(TIMEZONES).optional(),
  currency:   z.enum(CURRENCIES).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
}).strict();

export const communicationSchema = z.object({
  defaultFromName:  z.string().trim().max(120).optional(),
  defaultFromEmail: z.string().trim().email().or(z.literal("")).optional(),
  emailProvider:    z.enum(EMAIL_PROVIDERS).optional(),
  whatsappNumber:   z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Invalid phone format").or(z.literal("")).optional(),
  smsProvider:      z.enum(SMS_PROVIDERS).optional(),
  smtpHost:         z.string().trim().max(253).or(z.literal("")).optional(),
  smtpPort:         z.union([z.number().int().min(1).max(65535), z.literal("")]).optional(),
  smtpUsername:     z.string().trim().max(255).or(z.literal("")).optional(),
  // Empty string means "leave unchanged"; null means "clear it".
  smtpPassword:     z.union([z.string(), z.null()]).optional(),
}).strict();

export const financeSchema = z.object({
  paymentInstructions: z.string().max(4000).optional(),
}).strict();

const templateBody = z.string().max(8000);
export const templatesSchema = z.object({
  emailTemplates: z.object({
    beforeDue:  templateBody.optional(),
    onDue:      templateBody.optional(),
    overdue7:   templateBody.optional(),
    overdue30:  templateBody.optional(),
  }).strict(),
}).strict();

export const notificationsSchema = z.object({
  notificationPrefs: z.object({
    paymentOverdue:        z.boolean().optional(),
    reservationExpiring:   z.boolean().optional(),
    commissionPending:     z.boolean().optional(),
    oqoodDeadline:         z.boolean().optional(),
    dealStageChanged:      z.boolean().optional(),
    newLeadAssigned:       z.boolean().optional(),
  }).passthrough(),
}).strict();

// ── Test endpoints ────────────────────────────────────────────────────────

export const testSmtpSchema = z.object({
  to: z.string().trim().email(),
}).strict();

export const previewTemplateSchema = z.object({
  key: z.enum(["beforeDue", "onDue", "overdue7", "overdue30"]),
  vars: z.object({
    buyerName:      z.string().optional(),
    unitNumber:     z.string().optional(),
    projectName:    z.string().optional(),
    milestoneLabel: z.string().optional(),
    dueDate:        z.string().optional(),
    amount:         z.string().optional(),
  }).partial().optional(),
}).strict();

export type BrandingInput      = z.infer<typeof brandingSchema>;
export type LocalizationInput  = z.infer<typeof localizationSchema>;
export type CommunicationInput = z.infer<typeof communicationSchema>;
export type FinanceInput       = z.infer<typeof financeSchema>;
export type TemplatesInput     = z.infer<typeof templatesSchema>;
export type NotificationsInput = z.infer<typeof notificationsSchema>;
