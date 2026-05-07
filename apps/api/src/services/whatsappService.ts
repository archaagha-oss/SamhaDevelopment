/**
 * WhatsApp service (Twilio).
 *
 * Secrets come from env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 * Public config (from-number, approved Content Template SIDs) comes from AppSettings.
 *
 * Two send modes:
 *   1. Template message (preferred for outbound proactive sends): pass contentSid +
 *      contentVariables. Twilio will substitute {{1}}, {{2}}, ... in the approved Meta
 *      template body. This is the only valid path outside the 24h service window.
 *   2. Freeform body: only usable when the recipient has messaged you in the last 24h
 *      (the "service window") or in Twilio sandbox.
 */

import twilio from "twilio";
import { prisma } from "../lib/prisma.js";

export interface SendWhatsappPayload {
  to: string;                            // E.164, e.g. "+971501234567"
  body?: string;                         // freeform — service-window only
  contentSid?: string;                   // Meta-approved Content Template SID (HX...)
  contentVariables?: Record<string, string>;
  mediaUrl?: string;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
  providerMessageId?: string;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;                    // "whatsapp:+1..."
}

async function loadConfig(): Promise<TwilioConfig | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;

  const settings = await prisma.appSettings.findFirst().catch(() => null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromNumber = (settings as any)?.twilioWhatsappFrom as string | undefined;
  if (!fromNumber) return null;

  return { accountSid, authToken, fromNumber };
}

export async function sendWhatsapp(payload: SendWhatsappPayload): Promise<SendResult> {
  const cfg = await loadConfig();

  // No provider configured — log to stdout (matches mailerService dev fallback)
  if (!cfg) {
    console.log(
      `[WhatsApp] Provider not configured. TO: ${payload.to}\n` +
      `         CONTENT_SID: ${payload.contentSid ?? "(none)"}\n` +
      `         BODY: ${payload.body ?? "(none)"}\n` +
      `         VARS: ${JSON.stringify(payload.contentVariables ?? {})}`
    );
    return { sent: true, reason: "logged-only" };
  }

  const to = payload.to.startsWith("whatsapp:") ? payload.to : `whatsapp:${payload.to}`;

  try {
    const client = twilio(cfg.accountSid, cfg.authToken);

    const params: Record<string, unknown> = {
      from: cfg.fromNumber,
      to,
    };

    if (payload.contentSid) {
      params.contentSid = payload.contentSid;
      if (payload.contentVariables && Object.keys(payload.contentVariables).length > 0) {
        params.contentVariables = JSON.stringify(payload.contentVariables);
      }
    } else if (payload.body) {
      params.body = payload.body;
    } else {
      return { sent: false, reason: "no body or contentSid provided" };
    }

    if (payload.mediaUrl) {
      params.mediaUrl = [payload.mediaUrl];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await client.messages.create(params as any);
    return { sent: true, providerMessageId: message.sid };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[WhatsApp] send failed: ${reason}`);
    return { sent: false, reason };
  }
}

// ─── Body builders for the 24h service window / sandbox tests ────────────────
//
// For Meta-approved templates, the BODY is fixed in Meta's Business Manager and
// only the {{1}}, {{2}}, ... variables are sent via contentVariables. The builders
// below produce the equivalent freeform body for testing in the Twilio sandbox.

export interface ReminderTemplateVars {
  buyerName: string;
  unitNumber: string;
  projectName: string;
  milestoneLabel: string;
  dueDate: string;
  amount: string;
}

export function buildBeforeDueWhatsapp(vars: ReminderTemplateVars): { body: string; contentVariables: Record<string, string> } {
  const body =
    `Dear ${vars.buyerName}, this is a friendly reminder that your payment of ${vars.amount} ` +
    `for "${vars.milestoneLabel}" at ${vars.projectName} (Unit ${vars.unitNumber}) is due on ${vars.dueDate}. ` +
    `Please arrange payment before the due date. — ${vars.projectName} Finance Team`;
  return {
    body,
    contentVariables: {
      "1": vars.buyerName,
      "2": vars.amount,
      "3": vars.milestoneLabel,
      "4": vars.unitNumber,
      "5": vars.dueDate,
    },
  };
}

export function buildOnDueWhatsapp(vars: ReminderTemplateVars): { body: string; contentVariables: Record<string, string> } {
  const body =
    `Dear ${vars.buyerName}, your payment of ${vars.amount} for "${vars.milestoneLabel}" ` +
    `(Unit ${vars.unitNumber}, ${vars.projectName}) is due TODAY (${vars.dueDate}). ` +
    `Please complete payment today to avoid overdue status.`;
  return {
    body,
    contentVariables: {
      "1": vars.buyerName,
      "2": vars.amount,
      "3": vars.milestoneLabel,
      "4": vars.unitNumber,
      "5": vars.dueDate,
    },
  };
}

export function buildOverdueWhatsapp(vars: ReminderTemplateVars, daysOverdue: number): { body: string; contentVariables: Record<string, string> } {
  const isFinal = daysOverdue >= 30;
  const prefix = isFinal ? "FINAL NOTICE: " : "";
  const body =
    `${prefix}Dear ${vars.buyerName}, your payment of ${vars.amount} for "${vars.milestoneLabel}" ` +
    `(Unit ${vars.unitNumber}, ${vars.projectName}) was due on ${vars.dueDate} and is now ` +
    `${daysOverdue} day(s) overdue. Please arrange payment immediately.`;
  return {
    body,
    contentVariables: {
      "1": vars.buyerName,
      "2": vars.amount,
      "3": vars.milestoneLabel,
      "4": vars.unitNumber,
      "5": vars.dueDate,
      "6": String(daysOverdue),
    },
  };
}
