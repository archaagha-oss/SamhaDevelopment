/**
 * Outbound communications API.
 *
 *   POST /api/communications/send
 *
 * Body:
 *   { leadId? | contactId?, dealId?, channel?, subject?, body }
 *
 * channel may be EMAIL | WHATSAPP | SMS. If omitted, the channel-picker
 * (Phase C) decides based on stored preference + engagement signals.
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { dispatchAdHocMessage, type AdHocResult } from "../services/communicationDispatcher.js";

const router = Router();

router.post("/send", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { leadId, contactId, dealId, channel, subject, body } = req.body as {
      leadId?: string;
      contactId?: string;
      dealId?: string;
      channel?: "EMAIL" | "WHATSAPP" | "SMS";
      subject?: string;
      body?: string;
    };

    if (!leadId && !contactId) {
      return res.status(400).json({ error: "leadId or contactId is required", code: "MISSING_RECIPIENT", statusCode: 400 });
    }
    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: "body is required", code: "MISSING_BODY", statusCode: 400 });
    }
    if (channel && !["EMAIL", "WHATSAPP", "SMS"].includes(channel)) {
      return res.status(400).json({ error: "channel must be EMAIL, WHATSAPP, or SMS", code: "INVALID_CHANNEL", statusCode: 400 });
    }

    // Look up the recipient's email/phone
    let recipient = { email: null as string | null, phone: null as string | null };
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { email: true, phone: true },
      });
      if (!lead) return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
      recipient = { email: lead.email ?? null, phone: lead.phone ?? null };
    } else if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { email: true, phone: true, whatsapp: true },
      });
      if (!contact) return res.status(404).json({ error: "Contact not found", code: "NOT_FOUND", statusCode: 404 });
      recipient = {
        email: contact.email ?? null,
        phone: contact.whatsapp ?? contact.phone ?? null,
      };
    }

    const result: AdHocResult = await dispatchAdHocMessage({
      leadId,
      contactId,
      dealId,
      channel,
      subject,
      body,
      recipient,
      createdBy: req.auth.userId,
    });

    if (!result.sent && !result.channel) {
      // Couldn't pick a channel at all (e.g. no email + opted out of phone channels)
      return res.status(422).json({
        error: result.reason ?? "no deliverable channel",
        code: "NO_CHANNEL",
        statusCode: 422,
      });
    }

    res.status(result.sent ? 201 : 502).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Send failed", code: "SEND_ERROR", statusCode: 500 });
  }
});

export default router;
