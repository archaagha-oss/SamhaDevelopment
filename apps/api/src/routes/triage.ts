/**
 * InboundTriage / Hot Inbox API.
 *
 *   GET    /api/triage                 — list (default UNCLAIMED, oldest first)
 *   PATCH  /api/triage/:id/attach      — attach to a Lead (creates Activity, marks RESOLVED)
 *   PATCH  /api/triage/:id/claim       — claim for the current agent (UNCLAIMED → CLAIMED)
 *   PATCH  /api/triage/:id/discard     — mark DISCARDED (spam, wrong number, etc.)
 *   GET    /api/triage/counts          — quick {unclaimed, claimed} counts for the sidebar badge
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { recordReply } from "../services/communicationPreferenceService.js";
import { publishTriageCounts } from "../services/inboundProcessor.js";
import { sseHub } from "../services/sseHub.js";
import { requireAuthentication } from "../middleware/auth.js";

const router = Router();
router.use(requireAuthentication);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function triageModel(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.inboundTriage?.findMany !== "function") return null;
  return p.inboundTriage;
}

router.get("/counts", async (_req, res) => {
  try {
    const m = triageModel();
    if (!m) return res.json({ unclaimed: 0, claimed: 0 });
    const [unclaimed, claimed] = await Promise.all([
      m.count({ where: { status: "UNCLAIMED" } }),
      m.count({ where: { status: "CLAIMED" } }),
    ]);
    res.json({ unclaimed, claimed });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch counts", code: "TRIAGE_COUNT_ERROR", statusCode: 500 });
  }
});

router.get("/", async (req, res) => {
  try {
    const m = triageModel();
    if (!m) return res.json({ data: [] });

    const status = (req.query.status as string) ?? "UNCLAIMED";
    const channel = req.query.channel as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);

    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") where.status = status;
    if (channel) where.channel = channel;

    const rows = await m.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: limit,
    });
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch triage", code: "TRIAGE_LIST_ERROR", statusCode: 500 });
  }
});

router.patch("/:id/claim", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const m = triageModel();
    if (!m) return res.status(503).json({ error: "Triage unavailable (schema not migrated)", code: "TRIAGE_UNAVAILABLE", statusCode: 503 });

    const updated = await m.update({
      where: { id: req.params.id },
      data:  { status: "CLAIMED", claimedById: req.auth.userId, claimedAt: new Date() },
    });
    sseHub.broadcast("triage.updated", { triageId: updated.id, status: updated.status });
    publishTriageCounts().catch(() => undefined);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Failed to claim", code: "TRIAGE_CLAIM_ERROR", statusCode: 400 });
  }
});

router.patch("/:id/discard", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const m = triageModel();
    if (!m) return res.status(503).json({ error: "Triage unavailable", code: "TRIAGE_UNAVAILABLE", statusCode: 503 });

    const updated = await m.update({
      where: { id: req.params.id },
      data:  { status: "DISCARDED", claimedById: req.auth.userId, claimedAt: new Date() },
    });
    sseHub.broadcast("triage.updated", { triageId: updated.id, status: updated.status });
    publishTriageCounts().catch(() => undefined);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Failed to discard", code: "TRIAGE_DISCARD_ERROR", statusCode: 400 });
  }
});

/**
 * Attach a triage row to a Lead (or Contact). Creates an Activity row tied to
 * that recipient, then marks the triage row RESOLVED with a link back. Also
 * records the reply signal so the channel-picker learns from it.
 */
router.patch("/:id/attach", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const m = triageModel();
    if (!m) return res.status(503).json({ error: "Triage unavailable", code: "TRIAGE_UNAVAILABLE", statusCode: 503 });

    const { leadId, contactId, dealId } = req.body as { leadId?: string; contactId?: string; dealId?: string };
    if (!leadId && !contactId) {
      return res.status(400).json({ error: "leadId or contactId is required", code: "MISSING_RECIPIENT", statusCode: 400 });
    }

    const triage = await m.findUnique({ where: { id: req.params.id } });
    if (!triage) return res.status(404).json({ error: "Triage entry not found", code: "NOT_FOUND", statusCode: 404 });

    const activity = await prisma.activity.create({
      data: {
        leadId:    leadId    ?? null,
        contactId: contactId ?? null,
        dealId:    dealId    ?? null,
        type:      triage.channel,
        direction: "INBOUND",
        providerMessageSid: triage.providerMessageId,
        deliveryStatus: "received",
        summary:   composeFromTriage(triage),
        createdBy: `triage:${req.auth.userId}`,
        activityDate: triage.receivedAt,
      } as any,
    });

    // Channel learning signal
    if (leadId) {
      await recordReply({ leadId, channel: triage.channel as any }).catch(() => undefined);
    } else if (contactId) {
      await recordReply({ contactId, channel: triage.channel as any }).catch(() => undefined);
    }

    const updated = await m.update({
      where: { id: triage.id },
      data: {
        status: "RESOLVED",
        claimedById: req.auth.userId,
        claimedAt: triage.claimedAt ?? new Date(),
        resolvedActivityId: activity.id,
      },
    });

    sseHub.broadcast("triage.updated", { triageId: updated.id, status: updated.status });
    sseHub.broadcast("activity.inbound", {
      activityId: activity.id,
      leadId: leadId ?? null,
      contactId: contactId ?? null,
      dealId: dealId ?? null,
      channel: triage.channel,
    });
    publishTriageCounts().catch(() => undefined);

    res.json({ triage: updated, activity });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Failed to attach", code: "TRIAGE_ATTACH_ERROR", statusCode: 400 });
  }
});

export default router;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function composeFromTriage(triage: any): string {
  const head = triage.subject ? `${triage.subject} — ` : "";
  const body = (triage.body ?? "").replace(/\s+/g, " ").trim();
  return (head + body).slice(0, 280) || `(no content) [${triage.channel}]`;
}
