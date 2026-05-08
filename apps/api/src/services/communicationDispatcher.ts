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

  // Compute the activity summary first; create the Activity row BEFORE sending
  // so we can set a Reply-To header that points back to this exact activity id
  // (per-activity reply tokens give the inbound matcher a deterministic 1:1).
  const activitySummary =
    channel === "EMAIL"
      ? `Email reminder (${humanRule(input.rule)}) → ${input.recipient.email}`
      : channel === "WHATSAPP"
        ? `WhatsApp reminder (${humanRule(input.rule)}) → ${phoneE164}`
        : `SMS reminder (${humanRule(input.rule)}) → ${phoneE164}`;

  const activity = await prisma.activity.create({
    data: {
      dealId: input.dealId,
      leadId: input.leadId,
      type: channel,
      direction: "OUTBOUND",
      deliveryStatus: "queued",
      summary: activitySummary,
      createdBy: "system",
    } as any,
  });

  let result: { sent: boolean; reason?: string; providerMessageId?: string };

  if (channel === "EMAIL") {
    const tmpl = pickEmailTemplate(input.rule, input.daysOverdue, input.vars);
    const replyTo = buildReplyToHeader(activity.id);
    result = await sendEmail({
      to: input.recipient.email!,
      ...tmpl,
      ...(replyTo ? { replyTo } : {}),
    });
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
  } else {
    const body = pickSmsTemplate(input.rule, input.daysOverdue, input.vars);
    result = await sendSms({ to: phoneE164!, body });
  }

  // Update the Activity row with the provider message id + final delivery status
  await prisma.activity.update({
    where: { id: activity.id },
    data: {
      providerMessageSid: result.providerMessageId ?? null,
      deliveryStatus: result.sent ? "sent" : "failed",
    } as any,
  });

  // Counters (best-effort — never fail the send because of stat update failure)
  recordOutbound({ leadId: input.leadId, channel }).catch((err) =>
    console.warn(`[Dispatcher] recordOutbound failed: ${err instanceof Error ? err.message : err}`)
  );

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

/**
 * Build a per-Activity reply-token email address. When INBOUND_EMAIL_DOMAIN
 * is set (e.g. "inbound.samha.ae"), outbound reminders include
 * `Reply-To: reply+<activityId>@inbound.samha.ae`. Inbound replies hit
 * SendGrid Inbound Parse, the matcher extracts the token, and the reply
 * lands on the same conversation thread deterministically.
 */
function buildReplyToHeader(activityId: string): string | null {
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  if (!domain) return null;
  return `reply+${activityId}@${domain}`;
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
