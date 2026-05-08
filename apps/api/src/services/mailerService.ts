/**
 * Mailer service.
 *
 * When AppSettings.smtpHost is configured, delivers via SMTP using nodemailer.
 * Otherwise logs the email to stdout (useful for dev / when provider not configured).
 */

import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  let fromName = "Samha Properties";
  let fromEmail = "noreply@samha.ae";
  let smtpHost: string | null = null;
  let smtpPort = 587;
  let smtpUsername: string | null = null;
  let smtpPassword: string | null = null;

  try {
    const settings = await prisma.appSettings.findFirst();
    if (settings) {
      if (settings.defaultFromName) fromName = settings.defaultFromName;
      if (settings.defaultFromEmail) fromEmail = settings.defaultFromEmail;
      const s = settings as any;
      if (s.smtpHost) smtpHost = s.smtpHost;
      if (s.smtpPort) smtpPort = Number(s.smtpPort);
      if (s.smtpUsername) smtpUsername = s.smtpUsername;
      if (s.smtpPassword) smtpPassword = s.smtpPassword;
    }
  } catch {
    // AppSettings not available — use defaults
  }

  const from = `"${fromName}" <${fromEmail}>`;

  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: smtpUsername ? { user: smtpUsername, pass: smtpPassword ?? "" } : undefined,
      });
      const info = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      });
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[Mailer/SMTP] send failed: ${reason}`);
      return { sent: false, reason };
    }
  }

  // Fallback: log to stdout (no provider configured)
  console.log(
    `[Mailer] FROM: ${from} TO: ${payload.to}\n` +
    `         SUBJECT: ${payload.subject}\n` +
    `         ---\n${payload.text}\n         ---`
  );

  return { sent: true, reason: "logged-only" };
}

// ─── Email templates ─────────────────────────────────────────────────────────

interface ReminderTemplateVars {
  buyerName: string;
  unitNumber: string;
  projectName: string;
  milestoneLabel: string;
  dueDate: string;
  amount: string;
}

export function buildBeforeDueEmail(vars: ReminderTemplateVars): Pick<EmailPayload, "subject" | "text" | "html"> {
  const subject = `Payment Reminder – Unit ${vars.unitNumber} (due in 7 days)`;
  const text = [
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
  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

export function buildOnDueEmail(vars: ReminderTemplateVars): Pick<EmailPayload, "subject" | "text" | "html"> {
  const subject = `Payment Due Today – Unit ${vars.unitNumber}`;
  const text = [
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
  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

export function buildOverdueEmail(vars: ReminderTemplateVars, daysOverdue: number): Pick<EmailPayload, "subject" | "text" | "html"> {
  const isFinal = daysOverdue >= 30;
  const subject = isFinal
    ? `FINAL NOTICE: Payment Overdue – Unit ${vars.unitNumber}`
    : `Payment Overdue – Unit ${vars.unitNumber}`;
  const text = [
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
  return { subject, text, html: text.replace(/\n/g, "<br>") };
}
