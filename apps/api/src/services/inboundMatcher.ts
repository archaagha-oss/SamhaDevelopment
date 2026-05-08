/**
 * Inbound recipient matcher.
 *
 * Maps an incoming message's `from` (phone or email) to a Lead/Contact row.
 * Returns enough context to either:
 *   - attach the inbound to a specific Lead/Deal (success)
 *   - send the inbound to the Hot Inbox triage queue (no match)
 *
 * Priority for phones:
 *   1. Lead.phone exact match
 *   2. Contact.phone or Contact.whatsapp exact match
 *   3. BrokerAgent.phone exact match
 *
 * Priority for emails:
 *   1. Reply-token in the To address (`reply+<activityId>@...`) — deterministic
 *      back-pointer to the outbound Activity, ALWAYS wins when present.
 *   2. Lead.email exact match
 *   3. Contact.email exact match
 *
 * If multiple Leads share the same phone/email (rare but possible — same buyer
 * came in via two brokers), pick the one with the most recent Activity and
 * flag `ambiguous: true` so the UI can prompt the agent to re-route.
 */

import { prisma } from "../lib/prisma.js";
import { normalizePhone } from "../lib/phone.js";

export type Channel = "EMAIL" | "WHATSAPP" | "SMS";

export interface InboundMatchInput {
  channel: Channel;
  fromPhone?: string | null;     // raw, will be normalized
  fromEmail?: string | null;
  toEmail?: string | null;       // for email reply-token extraction
}

export interface InboundMatch {
  matched: boolean;
  ambiguous: boolean;
  leadId?: string;
  dealId?: string;        // most-recent active deal on that lead, if any
  contactId?: string;
  brokerAgentId?: string;
  /** When matched via email reply-token, this is the Activity.id we extracted. */
  parentActivityId?: string;
  reason?: string;        // human-readable describing how we matched
}

const REPLY_TOKEN_RE = /(?:^|<)\s*reply\+([a-z0-9_-]+)@/i;

export function extractReplyToken(toAddress: string | null | undefined): string | null {
  if (!toAddress) return null;
  const m = REPLY_TOKEN_RE.exec(toAddress);
  return m ? m[1] : null;
}

export async function matchInbound(input: InboundMatchInput): Promise<InboundMatch> {
  // 1. Email reply-token (deterministic) ─────────────────────────────────────
  if (input.channel === "EMAIL" && input.toEmail) {
    const token = extractReplyToken(input.toEmail);
    if (token) {
      const parent = await prisma.activity.findUnique({
        where: { id: token } as any,
        select: { id: true, leadId: true, dealId: true, contactId: true } as any,
      } as any);
      if (parent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = parent as any;
        return {
          matched: true,
          ambiguous: false,
          leadId:           a.leadId    ?? undefined,
          dealId:           a.dealId    ?? undefined,
          contactId:        a.contactId ?? undefined,
          parentActivityId: a.id,
          reason:           "email reply-token",
        };
      }
      // token didn't resolve — fall through to address matching
    }
  }

  // 2. Phone match (WhatsApp / SMS) ──────────────────────────────────────────
  const phoneE164 = normalizePhone(input.fromPhone);
  if (phoneE164) {
    // Lead first
    const leads = await prisma.lead.findMany({
      where: { phone: phoneE164 },
      select: { id: true },
    });
    if (leads.length > 0) {
      const winner = await pickMostRecentLead(leads.map((l) => l.id));
      const dealId = await mostRecentActiveDealId(winner.id);
      return {
        matched: true,
        ambiguous: leads.length > 1,
        leadId: winner.id,
        dealId,
        reason: `phone match on Lead${leads.length > 1 ? ` (ambiguous, ${leads.length} leads)` : ""}`,
      };
    }

    // Contact
    const contacts = await prisma.contact.findMany({
      where: { OR: [{ phone: phoneE164 }, { whatsapp: phoneE164 }] },
      select: { id: true },
    });
    if (contacts.length > 0) {
      return {
        matched: true,
        ambiguous: contacts.length > 1,
        contactId: contacts[0].id,
        reason: `phone match on Contact${contacts.length > 1 ? ` (ambiguous, ${contacts.length} contacts)` : ""}`,
      };
    }

    // BrokerAgent
    const agent = await prisma.brokerAgent.findFirst({
      where: { phone: phoneE164 },
      select: { id: true } as any,
    } as any);
    if (agent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { matched: true, ambiguous: false, brokerAgentId: (agent as any).id, reason: "phone match on BrokerAgent" };
    }
  }

  // 3. Email match (fallback when no reply-token) ────────────────────────────
  if (input.fromEmail) {
    const email = input.fromEmail.toLowerCase().trim();

    const leads = await prisma.lead.findMany({
      where: { email },
      select: { id: true },
    });
    if (leads.length > 0) {
      const winner = await pickMostRecentLead(leads.map((l) => l.id));
      const dealId = await mostRecentActiveDealId(winner.id);
      return {
        matched: true,
        ambiguous: leads.length > 1,
        leadId: winner.id,
        dealId,
        reason: `email match on Lead${leads.length > 1 ? ` (ambiguous, ${leads.length} leads)` : ""}`,
      };
    }

    const contacts = await prisma.contact.findMany({
      where: { email },
      select: { id: true },
    });
    if (contacts.length > 0) {
      return {
        matched: true,
        ambiguous: contacts.length > 1,
        contactId: contacts[0].id,
        reason: `email match on Contact${contacts.length > 1 ? ` (ambiguous, ${contacts.length} contacts)` : ""}`,
      };
    }
  }

  return { matched: false, ambiguous: false, reason: "no match" };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function pickMostRecentLead(leadIds: string[]): Promise<{ id: string }> {
  if (leadIds.length === 1) return { id: leadIds[0] };
  // Pick the lead with the most recent Activity (their most-active conversation).
  const recent = await prisma.activity.findFirst({
    where: { leadId: { in: leadIds } },
    orderBy: { createdAt: "desc" },
    select: { leadId: true },
  });
  if (recent?.leadId) return { id: recent.leadId };
  // Fall back to most-recently created Lead
  const fallback = await prisma.lead.findFirst({
    where: { id: { in: leadIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return { id: fallback?.id ?? leadIds[0] };
}

async function mostRecentActiveDealId(leadId: string): Promise<string | undefined> {
  const deal = await prisma.deal.findFirst({
    where: { leadId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return deal?.id;
}
