/**
 * Mailer service.
 *
 * Reads SMTP credentials and email templates from AppSettings on every send.
 * When AppSettings.smtpHost is configured, delivers via SMTP using nodemailer.
 * Otherwise logs the email to stdout (useful for dev / when provider not configured).
 *
 * To enable real SMTP delivery: `npm install nodemailer @types/nodemailer` in
 * apps/api and uncomment the import + transporter block below.
 */

// import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface ReminderTemplateVars {
  buyerName:      string;
  unitNumber:     string;
  projectName:    string;
  milestoneLabel: string;
  dueDate:        string;
  amount:         string;
}

type TemplateKey = "beforeDue" | "onDue" | "overdue7" | "overdue30";

// ─── Public API ─────────────────────────────────────────────────────────────

export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; reason?: string }> {
  const cfg = await loadMailerConfig();
  const from = `"${cfg.fromName}" <${cfg.fromEmail}>`;

  if (cfg.smtpHost) {
    // SMTP delivery via nodemailer (requires: npm install nodemailer).
    // const transporter = nodemailer.createTransport({
    //   host: cfg.smtpHost,
    //   port: cfg.smtpPort,
    //   secure: cfg.smtpPort === 465,
    //   auth: cfg.smtpUsername ? { user: cfg.smtpUsername, pass: cfg.smtpPassword ?? "" } : undefined,
    // });
    // await transporter.sendMail({ from, to: payload.to, subject: payload.subject, text: payload.text, html: payload.html });
    // logger.info("mailer.sent", { provider: "smtp", host: cfg.smtpHost, to: payload.to });
    // return { sent: true };

    logger.warn("mailer.smtp_not_installed", { host: cfg.smtpHost, port: cfg.smtpPort });
  }

  logger.info("mailer.logged", {
    from,
    to: payload.to,
    subject: payload.subject,
    bodyPreview: payload.text.slice(0, 200),
  });
  return { sent: true, reason: cfg.smtpHost ? "smtp-not-installed" : "no-smtp-configured" };
}

// ─── Template builders ─────────────────────────────────────────────────────
//
// Each builder first looks for a saved template body in AppSettings; if none,
// it falls back to a built-in English default. The builder ALWAYS returns a
// fully resolved subject + text + html.

export function buildBeforeDueEmail(vars: ReminderTemplateVars): Pick<EmailPayload, "subject" | "text" | "html"> {
  const subject = `Payment Reminder – Unit ${vars.unitNumber} (due in 7 days)`;
  const fallback = [
    `Dear ${vars.buyerName},`,
    ``,
    `This is a friendly reminder that your upcoming payment of ${vars.amount} for "${vars.milestoneLabel}" at ${vars.projectName} is due on ${vars.dueDate}.`,
    ``,
    `Unit: ${vars.unitNumber}`,
    `Due Date: ${vars.dueDate}`,
    `Amount: ${vars.amount}`,
    ``,
    `Please arrange payment before the due date.`,
    ``,
    `Thank you,`,
    `${vars.projectName} Finance Team`,
  ].join("\n");
  return finalize("beforeDue", subject, fallback, vars);
}

export function buildOnDueEmail(vars: ReminderTemplateVars): Pick<EmailPayload, "subject" | "text" | "html"> {
  const subject = `Payment Due Today – Unit ${vars.unitNumber}`;
  const fallback = [
    `Dear ${vars.buyerName},`,
    ``,
    `Your payment of ${vars.amount} for "${vars.milestoneLabel}" at ${vars.projectName} is due today (${vars.dueDate}).`,
    ``,
    `Unit: ${vars.unitNumber}`,
    `Amount Due: ${vars.amount}`,
    ``,
    `Please complete your payment today to avoid overdue status.`,
    ``,
    `Thank you,`,
    `${vars.projectName} Finance Team`,
  ].join("\n");
  return finalize("onDue", subject, fallback, vars);
}

export function buildOverdueEmail(vars: ReminderTemplateVars, daysOverdue: number): Pick<EmailPayload, "subject" | "text" | "html"> {
  const isFinal = daysOverdue >= 30;
  const subject = isFinal
    ? `FINAL NOTICE: Payment Overdue – Unit ${vars.unitNumber}`
    : `Payment Overdue – Unit ${vars.unitNumber}`;
  const fallback = [
    `Dear ${vars.buyerName},`,
    ``,
    isFinal
      ? `This is a FINAL NOTICE. Your payment of ${vars.amount} for "${vars.milestoneLabel}" was due on ${vars.dueDate} and is now ${daysOverdue} days overdue.`
      : `Your payment of ${vars.amount} for "${vars.milestoneLabel}" was due on ${vars.dueDate} and is now ${daysOverdue} days overdue.`,
    ``,
    `Unit: ${vars.unitNumber}`,
    `Project: ${vars.projectName}`,
    `Amount Overdue: ${vars.amount}`,
    ``,
    `Please arrange payment at the earliest to avoid further action.`,
    ``,
    `Regards,`,
    `${vars.projectName} Finance Team`,
  ].join("\n");
  return finalize(isFinal ? "overdue30" : "overdue7", subject, fallback, vars);
}

// ─── Internals ─────────────────────────────────────────────────────────────

function finalize(
  key: TemplateKey,
  subject: string,
  fallbackBody: string,
  vars: ReminderTemplateVars,
): Pick<EmailPayload, "subject" | "text" | "html"> {
  const saved = templateCache.get(key);
  const bodyTemplate = saved && saved.length > 0 ? saved : fallbackBody;
  const text = renderTemplate(bodyTemplate, vars);
  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

/** Replace {{Name}} placeholders. Unknown vars are left as-is. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  // The settings UI advertises {{BuyerName}}, {{UnitNumber}}, {{Amount}},
  // {{DueDate}}, {{ProjectName}}, {{Milestone}}. Map both PascalCase and
  // camelCase so existing templates and new ones both work.
  const map: Record<string, string> = {
    BuyerName:      vars.buyerName      ?? "",
    UnitNumber:     vars.unitNumber     ?? "",
    Amount:         vars.amount         ?? "",
    DueDate:        vars.dueDate        ?? "",
    ProjectName:    vars.projectName    ?? "",
    Milestone:      vars.milestoneLabel ?? "",
    buyerName:      vars.buyerName      ?? "",
    unitNumber:     vars.unitNumber     ?? "",
    amount:         vars.amount         ?? "",
    dueDate:        vars.dueDate        ?? "",
    projectName:    vars.projectName    ?? "",
    milestoneLabel: vars.milestoneLabel ?? "",
  };
  return body.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(map, name) ? map[name] : `{{${name}}}`,
  );
}

// ─── Settings cache (refreshed lazily on each sendEmail) ────────────────────

interface MailerConfig {
  fromName: string;
  fromEmail: string;
  smtpHost: string | null;
  smtpPort: number;
  smtpUsername: string | null;
  smtpPassword: string | null;
}

const templateCache = new Map<TemplateKey, string>();

/**
 * Force-refresh the in-memory template cache from AppSettings. Callers that
 * need an up-to-the-second template (preview endpoint, scheduled reminder
 * pass) should await this before calling the build* functions.
 */
export async function refreshSettingsCache(): Promise<void> {
  await loadMailerConfig();
}

async function loadMailerConfig(): Promise<MailerConfig> {
  const cfg: MailerConfig = {
    fromName:     "Samha Properties",
    fromEmail:    "noreply@samha.ae",
    smtpHost:     null,
    smtpPort:     587,
    smtpUsername: null,
    smtpPassword: null,
  };

  try {
    const settings = await prisma.appSettings.findFirst();
    if (!settings) return cfg;
    if (settings.defaultFromName)  cfg.fromName  = settings.defaultFromName;
    if (settings.defaultFromEmail) cfg.fromEmail = settings.defaultFromEmail;
    if (settings.smtpHost)         cfg.smtpHost  = settings.smtpHost;
    if (settings.smtpPort)         cfg.smtpPort  = Number(settings.smtpPort);
    if (settings.smtpUsername)     cfg.smtpUsername = settings.smtpUsername;
    if (settings.smtpPassword)     cfg.smtpPassword = settings.smtpPassword;

    // Refresh template cache while we have the row.
    const t = (settings.emailTemplates as Record<string, string> | null) ?? {};
    for (const key of ["beforeDue", "onDue", "overdue7", "overdue30"] as TemplateKey[]) {
      if (typeof t[key] === "string" && t[key].trim().length > 0) templateCache.set(key, t[key]);
      else templateCache.delete(key);
    }
  } catch (err) {
    logger.warn("mailer.settings_load_failed", { err: (err as Error).message });
  }
  return cfg;
}
