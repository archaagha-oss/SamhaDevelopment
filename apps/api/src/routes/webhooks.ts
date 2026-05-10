/**
 * External provider webhooks: Twilio (WhatsApp / SMS / status) + SendGrid Inbound Parse.
 *
 * These routes are called by external services, not by users. Each route:
 *   1. parses provider-specific body shape (urlencoded for Twilio, multipart for SendGrid)
 *   2. validates authenticity (Twilio signature, SendGrid path-token)
 *   3. normalizes the payload
 *   4. hands to inboundProcessor (which handles match/triage/idempotency/notification)
 *   5. responds 200 with empty body so the provider doesn't retry
 *
 * Mount at /api/webhooks. Webhook routes intentionally bypass the global
 * express.json() body parser — they install their own per-route parsers.
 */

import { Router, type Request, type Response } from "express";
import express from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { processInbound, type NormalizedInbound } from "../services/inboundProcessor.js";
import { twilioWebhookValidator } from "../middleware/twilioWebhook.js";
import { parsePortalLeadEmail, detectPortal } from "../services/portalLeadParserService.js";
import { ingestPortalLead } from "../services/portalLeadIngestService.js";

const router = Router();

// ─── parsers ─────────────────────────────────────────────────────────────────
const urlencodedParser = express.urlencoded({ extended: false });
const multipartParser  = multer().none();

// ─── Twilio: WhatsApp ────────────────────────────────────────────────────────

router.post(
  "/twilio/whatsapp",
  urlencodedParser,
  twilioWebhookValidator(),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as TwilioInboundBody;
      const normalized = normalizeTwilioMessage(body, "WHATSAPP");
      const result = await processInbound(normalized);
      console.log(`[Webhook] Twilio WhatsApp → ${result.status} (${result.matchReason ?? ""})`);
      res.set("Content-Type", "text/xml").status(200).send("<Response/>");
    } catch (err) {
      console.error("[Webhook] Twilio WhatsApp error:", err);
      res.status(200).send(""); // never make Twilio retry on our internal bugs
    }
  }
);

// ─── Twilio: SMS ─────────────────────────────────────────────────────────────

router.post(
  "/twilio/sms",
  urlencodedParser,
  twilioWebhookValidator(),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as TwilioInboundBody;
      const normalized = normalizeTwilioMessage(body, "SMS");
      const result = await processInbound(normalized);
      console.log(`[Webhook] Twilio SMS → ${result.status} (${result.matchReason ?? ""})`);
      res.set("Content-Type", "text/xml").status(200).send("<Response/>");
    } catch (err) {
      console.error("[Webhook] Twilio SMS error:", err);
      res.status(200).send("");
    }
  }
);

// ─── Twilio: delivery / read status callbacks ───────────────────────────────
//
// Updates the OUTBOUND Activity row's deliveryStatus when Twilio reports
// queued / sent / delivered / read / failed. Idempotent because every
// transition writes the latest status; ordering is best-effort.

router.post(
  "/twilio/status",
  urlencodedParser,
  twilioWebhookValidator(),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as TwilioStatusBody;
      const sid = body.MessageSid;
      const status = body.MessageStatus;
      if (!sid || !status) {
        return res.status(200).send("");
      }
      const updated = await prisma.activity.updateMany({
        where: { providerMessageSid: sid } as any,
        data:  { deliveryStatus: status } as any,
      });
      console.log(`[Webhook] Twilio status ${sid}=${status} (matched ${updated.count})`);
      res.status(200).send("");
    } catch (err) {
      console.error("[Webhook] Twilio status error:", err);
      res.status(200).send("");
    }
  }
);

// ─── SendGrid Inbound Parse ──────────────────────────────────────────────────
//
// SendGrid posts inbound emails as multipart/form-data with fields:
//   from, to, subject, text, html, headers, attachments, ...
// Auth: an unguessable token in the path. Set SENDGRID_INBOUND_TOKEN in env
// and configure SendGrid → Inbound Parse webhook URL with that token.

router.post(
  "/email/inbound/:token",
  multipartParser,
  async (req: Request, res: Response) => {
    try {
      // Token can be set in AppSettings (UI-managed) or env (fallback).
      const settings = await prisma.appSettings.findFirst().catch(() => null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settingsToken = (settings as any)?.sendgridInboundToken as string | undefined;
      const expected = settingsToken ?? process.env.SENDGRID_INBOUND_TOKEN;
      if (expected && req.params.token !== expected) {
        console.warn(`[Webhook] SendGrid inbound token mismatch`);
        return res.status(403).send("Forbidden");
      }
      if (!expected) {
        console.warn(`[Webhook] sendgridInboundToken not set in AppSettings or env — accepting unauthenticated inbound. DO NOT run in production.`);
      }

      const body = req.body as SendGridInboundBody;
      const normalized = normalizeSendGridEmail(body);

      // Portal-lead branch: if the inbound looks like a Bayut / Property Finder
      // / Dubizzle lead handoff, parse + ingest as a new Lead. Otherwise fall
      // through to the generic inbound triage (matches existing leads or lands
      // in the Hot Inbox). Closes audit gap #1.
      const fromAddress = normalized.fromEmail ?? body.from ?? "";
      const portal = detectPortal(
        body.subject ?? "",
        fromAddress,
        body.text ?? body.html ?? ""
      );
      if (portal !== "UNKNOWN") {
        const parsed = parsePortalLeadEmail({
          subject: body.subject ?? "",
          fromAddress,
          body: body.text ?? body.html ?? "",
        });
        const ingest = await ingestPortalLead(parsed);
        console.log(`[Webhook] portal=${portal} ingest=${ingest.status}${ingest.leadId ? ` lead=${ingest.leadId}` : ""}${ingest.reason ? ` (${ingest.reason})` : ""}`);
        return res.status(200).send("");
      }

      const result = await processInbound(normalized);
      console.log(`[Webhook] SendGrid inbound email → ${result.status} (${result.matchReason ?? ""})`);
      res.status(200).send("");
    } catch (err) {
      console.error("[Webhook] SendGrid inbound error:", err);
      res.status(200).send("");
    }
  }
);

export default router;

// ─── Provider-specific shapes + normalizers ──────────────────────────────────

interface TwilioInboundBody {
  MessageSid?: string;
  SmsMessageSid?: string;
  From?: string;        // e.g. "whatsapp:+971501234567" or "+971501234567"
  To?: string;
  Body?: string;
  NumMedia?: string;    // numeric string
  [key: string]: unknown;
}

interface TwilioStatusBody {
  MessageSid?: string;
  MessageStatus?: string; // queued | sending | sent | delivered | read | failed | undelivered
  ErrorCode?: string;
  [key: string]: unknown;
}

interface SendGridInboundBody {
  from?: string;        // "Display Name <addr@domain>"
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: string;     // raw, multi-line
  envelope?: string;    // JSON string
  charsets?: string;    // JSON string
  [key: string]: unknown;
}

function normalizeTwilioMessage(body: TwilioInboundBody, channel: "WHATSAPP" | "SMS"): NormalizedInbound {
  const from = (body.From ?? "").replace(/^whatsapp:/i, "");
  const sid  = body.MessageSid ?? body.SmsMessageSid ?? `unknown-${Date.now()}`;
  const numMedia = parseInt(body.NumMedia ?? "0", 10) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const url = body[`MediaUrl${i}`];
    if (typeof url === "string") mediaUrls.push(url);
  }
  return {
    channel,
    fromPhone:         from || null,
    body:              typeof body.Body === "string" ? body.Body : null,
    mediaUrls:         mediaUrls.length > 0 ? mediaUrls : undefined,
    providerMessageId: sid,
    rawHeaders:        body as Record<string, unknown>,
    receivedAt:        new Date(),
  };
}

function normalizeSendGridEmail(body: SendGridInboundBody): NormalizedInbound {
  const fromEmail = extractEmailAddress(body.from ?? "");
  const toEmail   = body.to ?? null;
  // SendGrid puts a Message-ID in the headers blob; extract for idempotency.
  const messageId = extractMessageId(body.headers ?? "") ?? `sg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    channel:           "EMAIL",
    fromEmail:         fromEmail || null,
    toEmail,
    subject:           body.subject ?? null,
    body:              body.text ?? body.html ?? null,
    providerMessageId: messageId,
    rawHeaders:        { headers: body.headers, envelope: body.envelope },
    receivedAt:        new Date(),
  };
}

function extractEmailAddress(rawFrom: string): string | null {
  // "Display Name <addr@domain>"  or just "addr@domain"
  const m = /<\s*([^>\s]+@[^>\s]+)\s*>/.exec(rawFrom);
  if (m) return m[1].toLowerCase();
  const trimmed = rawFrom.trim();
  if (/^[^\s@]+@[^\s@]+$/.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function extractMessageId(headersBlob: string): string | null {
  const m = /^Message-ID:\s*(.+)$/im.exec(headersBlob);
  return m ? m[1].trim() : null;
}
