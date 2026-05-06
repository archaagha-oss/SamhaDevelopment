/**
 * Mailer service — stub implementation.
 *
 * Reads email config from AppSettings. Logs email content to stdout.
 * To enable real delivery: install nodemailer, then replace the `sendMail`
 * implementation with a transporter call using settings.emailProvider + SMTP env vars.
 */

import { prisma } from "../lib/prisma.js";

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; reason?: string }> {
  let fromName = "Samha Properties";
  let fromEmail = "noreply@samha.ae";

  try {
    const settings = await prisma.appSettings.findFirst();
    if (settings) {
      if (settings.defaultFromName) fromName = settings.defaultFromName;
      if (settings.defaultFromEmail) fromEmail = settings.defaultFromEmail;
    }
  } catch {
    // AppSettings not available — use defaults
  }

  // In production, replace this block with a real transporter (nodemailer, resend, sendgrid, etc.)
  console.log(
    `[Mailer] FROM: "${fromName}" <${fromEmail}> TO: ${payload.to}\n` +
    `         SUBJECT: ${payload.subject}\n` +
    `         ---\n${payload.text}\n         ---`
  );

  return { sent: true };
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
