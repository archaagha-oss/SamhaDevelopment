/**
 * Inbound message processor.
 *
 * Single entrypoint for any inbound channel (WhatsApp / SMS / email). The
 * webhook routes parse provider-specific payloads into a `NormalizedInbound`
 * shape and hand it here.
 *
 * Responsibilities:
 *   1. Idempotency — providerMessageId is unique on Activity and on
 *      InboundTriage; an upsert pattern makes webhook retries no-ops.
 *   2. Recipient matching via inboundMatcher.
 *   3. On match: create an Activity row (direction=INBOUND), record the
 *      reply signal in CommunicationPreference, notify the assigned agent.
 *   4. On no-match: write an InboundTriage row for the Hot Inbox.
 *   5. Detect STOP/UNSUBSCRIBE keywords and flip the per-channel opt-out.
 */

import { prisma } from "../lib/prisma.js";
import { matchInbound, type Channel } from "./inboundMatcher.js";
import { recordReply, setOptOut } from "./communicationPreferenceService.js";
import { sseHub } from "./sseHub.js";

export interface NormalizedInbound {
  channel: Channel;
  fromPhone?: string | null;     // raw, normalized inside matcher
  fromEmail?: string | null;
  toEmail?: string | null;       // for email reply-token extraction
  subject?: string | null;
  body?: string | null;
  mediaUrls?: string[];
  providerMessageId: string;     // Twilio MessageSid or email Message-ID
  rawHeaders?: Record<string, unknown>;
  receivedAt?: Date;
}

export interface ProcessResult {
  status: "matched" | "triaged" | "duplicate" | "opted-out";
  activityId?: string;
  triageId?: string;
  matchReason?: string;
  ambiguous?: boolean;
}

const STOP_KEYWORDS = [
  "stop", "unsubscribe", "cancel", "end", "quit",
  // Arabic
  "إيقاف", "إلغاء", "اوقف",
];

export function detectStopIntent(body: string | null | undefined): boolean {
  if (!body) return false;
  const trimmed = body.trim().toLowerCase();
  // Match if the body is *exactly* a stop word (don't trigger on "I'd like to stop seeing units" etc.)
  return STOP_KEYWORDS.some((k) => trimmed === k.toLowerCase());
}

export async function processInbound(input: NormalizedInbound): Promise<ProcessResult> {
  // 1. Idempotency check — Activity.providerMessageSid is @unique
  const existingActivity = await prisma.activity.findFirst({
    where: { providerMessageSid: input.providerMessageId } as any,
    select: { id: true } as any,
  } as any);
  if (existingActivity) {
    return { status: "duplicate", activityId: (existingActivity as any).id };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.inboundTriage?.findUnique === "function") {
    const existingTriage = await p.inboundTriage.findUnique({
      where: { providerMessageId: input.providerMessageId },
    });
    if (existingTriage) {
      return { status: "duplicate", triageId: existingTriage.id };
    }
  }

  // 2. Match
  const match = await matchInbound({
    channel: input.channel,
    fromPhone: input.fromPhone,
    fromEmail: input.fromEmail,
    toEmail: input.toEmail,
  });

  // 3. STOP keyword — flip opt-out and record the message anyway (audit trail)
  const isStop = detectStopIntent(input.body);
  if (isStop && match.matched) {
    if (match.leadId) {
      await setOptOut({ leadId: match.leadId, channel: input.channel, optOut: true });
    } else if (match.contactId) {
      await setOptOut({ contactId: match.contactId, channel: input.channel, optOut: true });
    }
  }

  if (match.matched) {
    // 4a. Create Activity
    const activity = await prisma.activity.create({
      data: {
        leadId:    match.leadId    ?? null,
        dealId:    match.dealId    ?? null,
        contactId: match.contactId ?? null,
        type:      input.channel,
        direction: "INBOUND",
        providerMessageSid: input.providerMessageId,
        deliveryStatus: "received",
        summary:   composeSummary(input),
        outcome:   isStop ? "opt-out keyword detected" : null,
        createdBy: `inbound:${input.fromPhone ?? input.fromEmail ?? "unknown"}`,
        activityDate: input.receivedAt ?? new Date(),
      } as any,
    });

    // 5. Record reply signal for channel learning
    if (match.leadId) {
      await recordReply({ leadId: match.leadId, channel: input.channel }).catch((err) =>
        console.warn(`[Inbound] recordReply failed: ${err instanceof Error ? err.message : err}`)
      );
    } else if (match.contactId) {
      await recordReply({ contactId: match.contactId, channel: input.channel }).catch((err) =>
        console.warn(`[Inbound] recordReply failed: ${err instanceof Error ? err.message : err}`)
      );
    }

    // 6. Notify the assigned agent (if any)
    await notifyAssignedAgent({
      leadId: match.leadId,
      activityId: activity.id,
      summary: composeSummary(input),
      channel: input.channel,
      ambiguous: match.ambiguous,
    }).catch((err) => console.warn(`[Inbound] notify failed: ${err instanceof Error ? err.message : err}`));

    // 7. Push a live event so any open Lead/Deal page refreshes its thread
    sseHub.broadcast("activity.inbound", {
      activityId: activity.id,
      leadId: match.leadId ?? null,
      dealId: match.dealId ?? null,
      contactId: match.contactId ?? null,
      channel: input.channel,
    });

    return {
      status: isStop ? "opted-out" : "matched",
      activityId: activity.id,
      matchReason: match.reason,
      ambiguous: match.ambiguous,
    };
  }

  // 4b. No match — drop into triage queue
  if (typeof p.inboundTriage?.create !== "function") {
    console.warn("[Inbound] InboundTriage model unavailable — schema not pushed; dropping inbound on the floor");
    return { status: "triaged", matchReason: "no match (and triage model missing)" };
  }
  const triage = await p.inboundTriage.create({
    data: {
      channel:           input.channel,
      direction:         "INBOUND",
      fromAddress:       input.fromPhone ?? input.fromEmail ?? "unknown",
      toAddress:         input.toEmail ?? null,
      subject:           input.subject ?? null,
      body:              input.body ?? null,
      mediaUrls:         input.mediaUrls ?? null,
      providerMessageId: input.providerMessageId,
      rawHeaders:        input.rawHeaders ?? null,
      status:            "UNCLAIMED",
      receivedAt:        input.receivedAt ?? new Date(),
    },
  });

  // Live: announce the new triage row + an updated count for the sidebar badge.
  sseHub.broadcast("triage.created", {
    triageId: triage.id,
    channel: input.channel,
    fromAddress: triage.fromAddress,
  });
  publishTriageCounts().catch(() => undefined);

  return { status: "triaged", triageId: triage.id, matchReason: match.reason };
}

/** Publish the current { unclaimed, claimed } counts to every connected client. */
export async function publishTriageCounts(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.inboundTriage?.count !== "function") return;
  const [unclaimed, claimed] = await Promise.all([
    p.inboundTriage.count({ where: { status: "UNCLAIMED" } }),
    p.inboundTriage.count({ where: { status: "CLAIMED" } }),
  ]);
  sseHub.broadcast("triage.counts", { unclaimed, claimed });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function composeSummary(input: NormalizedInbound): string {
  const head = input.subject ? `${input.subject} — ` : "";
  const body = (input.body ?? "").replace(/\s+/g, " ").trim();
  return (head + body).slice(0, 280) || `(no content) [${input.channel}]`;
}

interface NotifyArgs {
  leadId?: string;
  activityId: string;
  summary: string;
  channel: Channel;
  ambiguous: boolean;
}

async function notifyAssignedAgent(args: NotifyArgs): Promise<void> {
  if (!args.leadId) return;
  const lead = await prisma.lead.findUnique({
    where: { id: args.leadId },
    select: { assignedAgentId: true, firstName: true, lastName: true } as any,
  });
  if (!lead) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = lead as any;
  if (!l.assignedAgentId) return;

  const channelLabel = args.channel === "WHATSAPP" ? "WhatsApp" : args.channel === "SMS" ? "SMS" : "email";
  const ambiguousNote = args.ambiguous ? " (multiple leads matched — verify before replying)" : "";
  const message = `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() +
    ` replied via ${channelLabel}${ambiguousNote}: ${args.summary.slice(0, 80)}…`;

  const notification = await prisma.notification.create({
    data: {
      userId:   l.assignedAgentId,
      message,
      leadId:   args.leadId,
      type:     "GENERAL",
      priority: args.ambiguous ? "HIGH" : "NORMAL",
    } as any,
  });

  // Live: push to the assigned agent's bell so it lights up immediately.
  sseHub.publishToUser(l.assignedAgentId, "notification.created", {
    id: notification.id,
    message,
    priority: args.ambiguous ? "HIGH" : "NORMAL",
    leadId: args.leadId,
    activityId: args.activityId,
  });
}
