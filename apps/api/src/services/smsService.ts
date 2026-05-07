/**
 * SMS service (Twilio Programmable SMS).
 *
 * Secrets in env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 * Public config in AppSettings:
 *   twilioMessagingServiceSid (preferred — pool of numbers)
 *   twilioWhatsappFrom (used only as a from-number fallback for SMS if MessagingService not set;
 *                       in that case strip the "whatsapp:" prefix)
 *
 * SMS bodies should be ≤160 chars to fit in a single segment.
 */

import twilio from "twilio";
import { prisma } from "../lib/prisma.js";

export interface SendSmsPayload {
  to: string; // E.164
  body: string;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
  providerMessageId?: string;
}

interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  fromNumber?: string;
}

async function loadConfig(): Promise<TwilioSmsConfig | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;

  const settings = await prisma.appSettings.findFirst().catch(() => null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any;
  const messagingServiceSid = s?.twilioMessagingServiceSid as string | undefined;
  let fromNumber = s?.twilioWhatsappFrom as string | undefined;
  if (fromNumber?.startsWith("whatsapp:")) fromNumber = fromNumber.slice("whatsapp:".length);

  if (!messagingServiceSid && !fromNumber) return null;

  return { accountSid, authToken, messagingServiceSid, fromNumber };
}

export async function sendSms(payload: SendSmsPayload): Promise<SendResult> {
  const cfg = await loadConfig();

  if (!cfg) {
    console.log(`[SMS] Provider not configured. TO: ${payload.to}\n         BODY: ${payload.body}`);
    return { sent: true, reason: "logged-only" };
  }

  try {
    const client = twilio(cfg.accountSid, cfg.authToken);
    const params: Record<string, unknown> = {
      to: payload.to,
      body: payload.body,
    };
    if (cfg.messagingServiceSid) {
      params.messagingServiceSid = cfg.messagingServiceSid;
    } else if (cfg.fromNumber) {
      params.from = cfg.fromNumber;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await client.messages.create(params as any);
    return { sent: true, providerMessageId: message.sid };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[SMS] send failed: ${reason}`);
    return { sent: false, reason };
  }
}

// ─── Body builders (single-segment-friendly) ─────────────────────────────────

export interface ReminderTemplateVars {
  buyerName: string;
  unitNumber: string;
  projectName: string;
  milestoneLabel: string;
  dueDate: string;
  amount: string;
}

export function buildBeforeDueSms(vars: ReminderTemplateVars): string {
  return `${vars.projectName}: ${vars.amount} for ${vars.milestoneLabel} (Unit ${vars.unitNumber}) due on ${vars.dueDate}.`;
}

export function buildOnDueSms(vars: ReminderTemplateVars): string {
  return `${vars.projectName}: ${vars.amount} for ${vars.milestoneLabel} (Unit ${vars.unitNumber}) is DUE TODAY (${vars.dueDate}).`;
}

export function buildOverdueSms(vars: ReminderTemplateVars, daysOverdue: number): string {
  const tag = daysOverdue >= 30 ? "FINAL NOTICE" : "OVERDUE";
  return `${tag}: ${vars.projectName} ${vars.amount} for ${vars.milestoneLabel} (Unit ${vars.unitNumber}) ${daysOverdue}d overdue. Please pay immediately.`;
}
