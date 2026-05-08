/**
 * Channel preference service.
 *
 * Owns the `CommunicationPreference` row per recipient. Two responsibilities:
 *
 *   1. pickChannel(input) — returns the channel that the dispatcher should
 *      use. Order: explicit override → preferredChannel → engagement-derived
 *      best channel → deterministic fallback.
 *
 *   2. recordOutbound / recordReply / recordOpenOrClick — update the per-channel
 *      counters that drive the engagement-derived choice. recordReply is called
 *      from inbound webhooks (Phase D); for now we only call recordOutbound from
 *      the dispatcher.
 *
 * The decision rule is intentionally simple. No ML — just deterministic
 * heuristics that get smarter as more signals arrive.
 */

import { prisma } from "../lib/prisma.js";

export type Channel = "EMAIL" | "WHATSAPP" | "SMS";

export interface PickChannelInput {
  leadId?: string;
  contactId?: string;
  hasEmail: boolean;
  hasPhone: boolean;
  override?: Channel;
}

export interface PreferenceRow {
  id: string;
  preferredChannel: string | null;
  emailOptOut: boolean;
  whatsappOptOut: boolean;
  smsOptOut: boolean;
  emailSent: number;
  whatsappSent: number;
  smsSent: number;
  emailReplies: number;
  whatsappReplies: number;
  smsReplies: number;
  emailOpens: number;
  emailClicks: number;
  whatsappReads: number;
  lastEmailReplyAt: Date | null;
  lastWhatsappReplyAt: Date | null;
  lastSmsReplyAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function findPreference(input: { leadId?: string; contactId?: string }): Promise<PreferenceRow | null> {
  if (!input.leadId && !input.contactId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.findFirst !== "function") return null;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  const row = await p.communicationPreference.findFirst({ where });
  return row as PreferenceRow | null;
}

async function upsertPreference(input: { leadId?: string; contactId?: string }): Promise<PreferenceRow | null> {
  if (!input.leadId && !input.contactId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.upsert !== "function") return null;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  return await p.communicationPreference.upsert({
    where,
    create: input,
    update: {},
  });
}

/**
 * Pick the channel for an outbound dispatch. Returns null if no channel is
 * deliverable (e.g. recipient opted out of every channel they can be reached on).
 */
export async function pickChannel(input: PickChannelInput): Promise<Channel | null> {
  const pref = await findPreference(input);

  // 1. explicit override always wins (subject to opt-out + capability checks)
  const candidate: Channel | null = input.override ?? (pref?.preferredChannel as Channel | null) ?? null;
  if (candidate && isDeliverable(candidate, input, pref)) {
    return candidate;
  }

  // 2. engagement-derived best channel (only if we have signals to act on)
  if (pref) {
    const ranked = rankByEngagement(pref).filter((c) => isDeliverable(c, input, pref));
    if (ranked.length > 0) return ranked[0];
  }

  // 3. deterministic fallback: prefer email when available (cheaper, written record),
  //    then WhatsApp (richer than SMS), then SMS.
  const fallback: Channel[] = ["EMAIL", "WHATSAPP", "SMS"];
  for (const c of fallback) {
    if (isDeliverable(c, input, pref)) return c;
  }
  return null;
}

export function isDeliverable(channel: Channel, input: PickChannelInput, pref: PreferenceRow | null): boolean {
  if (channel === "EMAIL") {
    if (!input.hasEmail) return false;
    if (pref?.emailOptOut) return false;
    return true;
  }
  if (channel === "WHATSAPP") {
    if (!input.hasPhone) return false;
    if (pref?.whatsappOptOut) return false;
    return true;
  }
  // SMS
  if (!input.hasPhone) return false;
  if (pref?.smsOptOut) return false;
  return true;
}

export function rankByEngagement(pref: PreferenceRow): Channel[] {
  const now = Date.now();

  // Recent reply = strongest signal (within 30 days)
  const recentReplyChannel: Channel | null = (() => {
    type Hit = { c: Channel; t: number };
    const hits: Hit[] = [];
    if (pref.lastEmailReplyAt && now - new Date(pref.lastEmailReplyAt).getTime() < 30 * DAY_MS) {
      hits.push({ c: "EMAIL", t: new Date(pref.lastEmailReplyAt).getTime() });
    }
    if (pref.lastWhatsappReplyAt && now - new Date(pref.lastWhatsappReplyAt).getTime() < 30 * DAY_MS) {
      hits.push({ c: "WHATSAPP", t: new Date(pref.lastWhatsappReplyAt).getTime() });
    }
    if (pref.lastSmsReplyAt && now - new Date(pref.lastSmsReplyAt).getTime() < 30 * DAY_MS) {
      hits.push({ c: "SMS", t: new Date(pref.lastSmsReplyAt).getTime() });
    }
    if (hits.length === 0) return null;
    hits.sort((a, b) => b.t - a.t);
    return hits[0].c;
  })();
  if (recentReplyChannel) return [recentReplyChannel];

  // Reply ratio over lifetime — weight clicks > opens for email (Apple Mail Privacy
  // auto-fetches pixels and inflates opens, so opens alone are noisy).
  const score = (replies: number, sent: number, weighted = 0) => {
    if (sent === 0) return -1;
    return (replies * 3 + weighted) / sent;
  };
  const emailScore    = score(pref.emailReplies,    pref.emailSent,    pref.emailClicks * 1 + pref.emailOpens * 0.2);
  const whatsappScore = score(pref.whatsappReplies, pref.whatsappSent, pref.whatsappReads * 0.5);
  const smsScore      = score(pref.smsReplies,      pref.smsSent);

  const ranked: Array<[Channel, number]> = [
    ["EMAIL", emailScore],
    ["WHATSAPP", whatsappScore],
    ["SMS", smsScore],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  // Only return scores that are positive (i.e. have *some* signal).
  return ranked.filter(([, s]) => s > 0).map(([c]) => c);
}

// ─── Counter updates (called from dispatcher + future inbound webhooks) ──────

export async function recordOutbound(input: { leadId?: string; contactId?: string; channel: Channel }): Promise<void> {
  if (!input.leadId && !input.contactId) return;
  await upsertPreference({ leadId: input.leadId, contactId: input.contactId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.update !== "function") return;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  const field = input.channel === "EMAIL" ? "emailSent" : input.channel === "WHATSAPP" ? "whatsappSent" : "smsSent";
  await p.communicationPreference.update({
    where,
    data: { [field]: { increment: 1 } },
  });
}

export async function recordReply(input: { leadId?: string; contactId?: string; channel: Channel; latencySec?: number }): Promise<void> {
  if (!input.leadId && !input.contactId) return;
  await upsertPreference({ leadId: input.leadId, contactId: input.contactId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.update !== "function") return;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  const now = new Date();
  const data: Record<string, unknown> = {};
  if (input.channel === "EMAIL") {
    data.emailReplies = { increment: 1 };
    data.lastEmailReplyAt = now;
    if (typeof input.latencySec === "number") data.avgResponseLatencyEmailSec = input.latencySec;
  } else if (input.channel === "WHATSAPP") {
    data.whatsappReplies = { increment: 1 };
    data.lastWhatsappReplyAt = now;
    if (typeof input.latencySec === "number") data.avgResponseLatencyWhatsappSec = input.latencySec;
  } else {
    data.smsReplies = { increment: 1 };
    data.lastSmsReplyAt = now;
    if (typeof input.latencySec === "number") data.avgResponseLatencySmsSec = input.latencySec;
  }
  await p.communicationPreference.update({ where, data });
}

export async function recordEmailOpen(input: { leadId?: string; contactId?: string }): Promise<void> {
  if (!input.leadId && !input.contactId) return;
  await upsertPreference({ leadId: input.leadId, contactId: input.contactId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.update !== "function") return;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  await p.communicationPreference.update({ where, data: { emailOpens: { increment: 1 } } });
}

export async function recordEmailClick(input: { leadId?: string; contactId?: string }): Promise<void> {
  if (!input.leadId && !input.contactId) return;
  await upsertPreference({ leadId: input.leadId, contactId: input.contactId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.update !== "function") return;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  await p.communicationPreference.update({ where, data: { emailClicks: { increment: 1 } } });
}

export async function setPreferredChannel(input: { leadId?: string; contactId?: string; channel: Channel | null }): Promise<void> {
  if (!input.leadId && !input.contactId) return;
  await upsertPreference({ leadId: input.leadId, contactId: input.contactId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.update !== "function") return;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  await p.communicationPreference.update({ where, data: { preferredChannel: input.channel } });
}

export async function setOptOut(input: { leadId?: string; contactId?: string; channel: Channel; optOut: boolean }): Promise<void> {
  if (!input.leadId && !input.contactId) return;
  await upsertPreference({ leadId: input.leadId, contactId: input.contactId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.communicationPreference?.update !== "function") return;
  const where = input.leadId ? { leadId: input.leadId } : { contactId: input.contactId };
  const field = input.channel === "EMAIL" ? "emailOptOut" : input.channel === "WHATSAPP" ? "whatsappOptOut" : "smsOptOut";
  await p.communicationPreference.update({ where, data: { [field]: input.optOut } });
}

export async function getPreference(input: { leadId?: string; contactId?: string }): Promise<PreferenceRow | null> {
  return findPreference(input);
}
