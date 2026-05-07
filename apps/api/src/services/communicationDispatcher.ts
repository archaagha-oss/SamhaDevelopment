/**
 * Communication dispatcher.
 *
 * Single entrypoint for outbound channel-aware sends. Picks the channel via
 * `pickChannel`, calls the right service, writes an Activity row (typed by
 * channel, direction=OUTBOUND, with the provider's message id for inbound
 * webhook idempotency), and updates per-recipient counters.
 *
 * Reminder-specific helper `dispatchPaymentReminder` adds the ReminderLog row
 * the existing sweep relies on for dedup.
 */

import { prisma } from "../lib/prisma.js";
import { sendEmail, buildBeforeDueEmail, buildOnDueEmail, buildOverdueEmail } from "./mailerService.js";
import { sendWhatsapp, buildBeforeDueWhatsapp, buildOnDueWhatsapp, buildOverdueWhatsapp } from "./whatsappService.js";
import { sendSms, buildBeforeDueSms, buildOnDueSms, buildOverdueSms } from "./smsService.js";
import { pickChannel, recordOutbound, type Channel } from "./communicationPreferenceService.js";
import { normalizePhone } from "../lib/phone.js";

type ReminderRule = "BEFORE_DUE" | "ON_DUE" | "OVERDUE_7" | "OVERDUE_30";

export interface ReminderTemplateVars {
  buyerName: string;
  unitNumber: string;
  projectName: string;
  milestoneLabel: string;
  dueDate: string;
  amount: string;
}

export interface DispatchPaymentReminderInput {
  paymentId: string;
  dealId: string;
  leadId: string;
  rule: ReminderRule;
  daysOverdue: number;
  recipient: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  vars: ReminderTemplateVars;
  channelOverride?: Channel;
}

export interface DispatchResult {
  sent: boolean;
  channel: Channel | null;
  reason?: string;
  providerMessageId?: string;
}

export async function dispatchPaymentReminder(input: DispatchPaymentReminderInput): Promise<DispatchResult> {
  const phoneE164 = normalizePhone(input.recipient.phone);
  const hasEmail = !!input.recipient.email;
  const hasPhone = !!phoneE164;

  const channel = await pickChannel({
    leadId: input.leadId,
    hasEmail,
    hasPhone,
    override: input.channelOverride,
  });

  if (!channel) {
    await writeReminderLog({
      paymentId: input.paymentId,
      ruleType: input.rule,
      channel: "EMAIL", // placeholder
      status: "SKIPPED_NO_RECIPIENT",
      failureReason: "no deliverable channel (no email/phone or all opted out)",
    });
    return { sent: false, channel: null, reason: "no-deliverable-channel" };
  }

  let result: { sent: boolean; reason?: string; providerMessageId?: string };
  let activitySummary: string;

  if (channel === "EMAIL") {
    const tmpl = pickEmailTemplate(input.rule, input.daysOverdue, input.vars);
    result = await sendEmail({ to: input.recipient.email!, ...tmpl });
    activitySummary = `Email reminder (${humanRule(input.rule)}) → ${input.recipient.email}`;
  } else if (channel === "WHATSAPP") {
    const settings = await prisma.appSettings.findFirst().catch(() => null);
    const contentSid = pickContentSid(settings, input.rule);
    const wa = pickWhatsappTemplate(input.rule, input.daysOverdue, input.vars);
    result = await sendWhatsapp({
      to: phoneE164!,
      contentSid: contentSid || undefined,
      contentVariables: contentSid ? wa.contentVariables : undefined,
      body: contentSid ? undefined : wa.body,
    });
    activitySummary = `WhatsApp reminder (${humanRule(input.rule)}) → ${phoneE164}`;
  } else {
    const body = pickSmsTemplate(input.rule, input.daysOverdue, input.vars);
    result = await sendSms({ to: phoneE164!, body });
    activitySummary = `SMS reminder (${humanRule(input.rule)}) → ${phoneE164}`;
  }

  // Counters (best-effort — never fail the send because of stat update failure)
  recordOutbound({ leadId: input.leadId, channel }).catch((err) =>
    console.warn(`[Dispatcher] recordOutbound failed: ${err instanceof Error ? err.message : err}`)
  );

  // Activity row — replaces the old "NOTE" entry with a channel-typed OUTBOUND row
  await prisma.activity.create({
    data: {
      dealId: input.dealId,
      leadId: input.leadId,
      type: channel, // "EMAIL" | "WHATSAPP" | "SMS"
      direction: "OUTBOUND",
      providerMessageSid: result.providerMessageId ?? null,
      deliveryStatus: result.sent ? "sent" : "failed",
      summary: activitySummary,
      createdBy: "system",
    } as any,
  });

  // ReminderLog row (preserves sweep dedup behavior)
  await writeReminderLog({
    paymentId: input.paymentId,
    ruleType: input.rule,
    channel,
    email: channel === "EMAIL" ? input.recipient.email ?? null : null,
    phoneE164: channel === "EMAIL" ? null : phoneE164,
    providerMessageId: result.providerMessageId ?? null,
    status: result.sent ? "SENT" : "FAILED",
    failureReason: result.sent ? null : result.reason ?? null,
  });

  return {
    sent: result.sent,
    channel,
    reason: result.reason,
    providerMessageId: result.providerMessageId,
  };
}

// ─── Template selectors ──────────────────────────────────────────────────────

function pickEmailTemplate(rule: ReminderRule, daysOverdue: number, vars: ReminderTemplateVars) {
  if (rule === "BEFORE_DUE") return buildBeforeDueEmail(vars);
  if (rule === "ON_DUE")     return buildOnDueEmail(vars);
  return buildOverdueEmail(vars, daysOverdue);
}

function pickWhatsappTemplate(rule: ReminderRule, daysOverdue: number, vars: ReminderTemplateVars) {
  if (rule === "BEFORE_DUE") return buildBeforeDueWhatsapp(vars);
  if (rule === "ON_DUE")     return buildOnDueWhatsapp(vars);
  return buildOverdueWhatsapp(vars, daysOverdue);
}

function pickSmsTemplate(rule: ReminderRule, daysOverdue: number, vars: ReminderTemplateVars) {
  if (rule === "BEFORE_DUE") return buildBeforeDueSms(vars);
  if (rule === "ON_DUE")     return buildOnDueSms(vars);
  return buildOverdueSms(vars, daysOverdue);
}

function pickContentSid(settings: unknown, rule: ReminderRule): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any;
  if (!s) return null;
  if (rule === "BEFORE_DUE") return s.twilioWhatsappContentSidBeforeDue ?? null;
  if (rule === "ON_DUE")     return s.twilioWhatsappContentSidOnDue ?? null;
  if (rule === "OVERDUE_7")  return s.twilioWhatsappContentSidOverdue7 ?? null;
  return s.twilioWhatsappContentSidOverdue30 ?? null;
}

function humanRule(rule: ReminderRule): string {
  return rule.replace(/_/g, " ").toLowerCase();
}

// ─── ReminderLog writer (defensive — model may not be migrated yet) ──────────

interface ReminderLogInput {
  paymentId: string;
  ruleType: ReminderRule;
  channel: Channel;
  email?: string | null;
  phoneE164?: string | null;
  providerMessageId?: string | null;
  status: string;
  failureReason?: string | null;
}

async function writeReminderLog(input: ReminderLogInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.reminderLog?.create !== "function") return;
  try {
    await p.reminderLog.create({
      data: {
        paymentId: input.paymentId,
        ruleType:  input.ruleType,
        channel:   input.channel,
        email:     input.email ?? null,
        phoneE164: input.phoneE164 ?? null,
        providerMessageId: input.providerMessageId ?? null,
        status:    input.status,
        failureReason: input.failureReason ?? null,
        sentAt:    new Date(),
      },
    });
  } catch (err) {
    console.error(`[Dispatcher] writeReminderLog failed:`, err);
  }
}
