import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";
import { resolveCaller } from "../lib/pii";

// ───────────────────────────────────────────────────────────────────────────────
// My Day — agent home queue (UX_AUDIT_2 Part B)
//
// Two endpoints power the MEMBER/VIEWER "My Day" home:
//
//   GET /api/my-day/summary  → strip counters (calls due, follow-ups overdue,
//                              deals stalled, payments due this week).
//   GET /api/my-day/queue    → merged feed: tasks, follow-ups, silent leads,
//                              payments due — sorted by due time (overdue first).
//
// Scoping: both endpoints scope by the calling User.id (resolved from
// `req.auth.userId`). ADMIN/MANAGER can also use the page from /my-day —
// they'll see their own personal queue (whatever they're assigned to). The
// page is mainly for MEMBER/VIEWER, but exposing it to all roles is intentional
// so a manager can use it as their own todo list.
//
// Deal "assignedAgent" is inherited from the lead — there is no direct
// Deal.assignedAgentId column. We filter via `lead.assignedAgentId`.
// ───────────────────────────────────────────────────────────────────────────────

const router = Router();

router.use(requireAuthentication);

// Stages we consider "stalled" candidates — closed / cancelled stages are
// excluded automatically because the deal isn't open anymore.
const STALLED_DEAL_STAGES = [
  "RESERVATION_PENDING",
  "SPA_PENDING",
  "OQOOD_PENDING",
] as const;

const STAGE_MAX_DAYS: Record<string, number> = {
  RESERVATION_PENDING: 7,
  SPA_PENDING: 14,
  OQOOD_PENDING: 30,
};

const OPEN_LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "PROPOSAL",
  "NEGOTIATING",
] as const;

const DUE_PAYMENT_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

// ─── GET /summary ─────────────────────────────────────────────────────────────

router.get("/summary", async (req, res) => {
  try {
    const { userId } = await resolveCaller(req);
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const weekOut = addDays(now, 7);

    const [callsDue, followUpsOverdue, paymentsDueWeek, stalledCandidates] = await Promise.all([
      // Calls due today or earlier, still pending
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: "PENDING",
          type: "CALL",
          dueDate: { lte: endOfToday },
        },
      }),

      // Follow-ups whose followUpDate has passed. We don't have a "completed"
      // marker on Activity; treat presence of a more-recent activity on the
      // same lead/deal as an implicit completion later in /queue. For the
      // summary count we approximate with `followUpDate <= now`.
      prisma.activity.count({
        where: {
          createdBy: userId,
          followUpDate: { lte: now, not: null },
        },
      }),

      // Payments due in the next 7 days where the deal's lead is assigned to me.
      prisma.payment.findMany({
        where: {
          status: { in: [...DUE_PAYMENT_STATUSES] },
          dueDate: { lte: weekOut },
          deal: { lead: { assignedAgentId: userId } },
        },
        select: { amount: true },
      }),

      // Deals where I'm the lead's agent, in a stalled-candidate stage. We
      // compute "stalled" by joining stageHistory below to find the date the
      // current stage was entered.
      prisma.deal.findMany({
        where: {
          isActive: true,
          stage: { in: [...STALLED_DEAL_STAGES] },
          lead: { assignedAgentId: userId },
        },
        select: { id: true, stage: true, createdAt: true, updatedAt: true },
      }),
    ]);

    const paymentsDueWeekTotal = paymentsDueWeek.reduce((s, p) => s + p.amount, 0);

    // Count deals whose current stage has been held longer than the policy
    // max. Without a per-deal "stage entered at" timestamp we use updatedAt
    // (set whenever the stage flips) as a proxy.
    const dealsStalled = stalledCandidates.reduce((count, deal) => {
      const cap = STAGE_MAX_DAYS[deal.stage] ?? 14;
      const ageDays = daysBetween(now, deal.updatedAt);
      return ageDays > cap ? count + 1 : count;
    }, 0);

    res.json({
      callsDue,
      followUpsOverdue,
      dealsStalled,
      paymentsDueWeek: paymentsDueWeek.length,
      paymentsDueWeekTotal,
    });
  } catch (error) {
    console.error("[my-day] GET /summary", error);
    res.status(500).json({
      error: "Failed to fetch My Day summary",
      code: "FETCH_MY_DAY_SUMMARY_ERROR",
      statusCode: 500,
    });
  }
});

// ─── GET /queue ───────────────────────────────────────────────────────────────

type QueueItemKind = "TASK" | "FOLLOW_UP" | "SILENT_LEAD" | "PAYMENT_DUE";

interface QueueItem {
  kind: QueueItemKind;
  id: string;
  title: string;
  subtitle: string;
  dueAt: string; // ISO
  leadId?: string;
  dealId?: string;
  overdue: boolean;
  overdueDays: number;
}

router.get("/queue", async (req, res) => {
  try {
    const { userId } = await resolveCaller(req);
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const sevenDaysOut = addDays(now, 7);
    const sevenDaysAgo = addDays(now, -7);

    const [tasks, followUps, openLeads, payments] = await Promise.all([
      // A. Open tasks assigned to me, due within the next 7 days (or earlier).
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: "PENDING",
          dueDate: { lte: sevenDaysOut },
        },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
          deal: { select: { id: true, dealNumber: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 100,
      }),

      // B. Activities I created where followUpDate has passed. We dedup by
      // checking whether a newer activity exists on the same lead — if so the
      // follow-up is implicitly satisfied.
      prisma.activity.findMany({
        where: {
          createdBy: userId,
          followUpDate: { lte: now, not: null },
        },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { followUpDate: "asc" },
        take: 100,
      }),

      // C. My open leads — silent if their last activity was > 7 days ago.
      prisma.lead.findMany({
        where: {
          assignedAgentId: userId,
          stage: { in: [...OPEN_LEAD_STAGES] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          stage: true,
        },
        take: 200,
      }),

      // D. Payments due in the next 7 days on deals whose lead is assigned to me.
      prisma.payment.findMany({
        where: {
          status: { in: [...DUE_PAYMENT_STATUSES] },
          dueDate: { lte: sevenDaysOut },
          deal: { lead: { assignedAgentId: userId } },
        },
        include: {
          deal: {
            select: {
              id: true,
              dealNumber: true,
              lead: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 100,
      }),
    ]);

    // For (C) silent leads we need lastActivityAt — same groupBy pattern as
    // routes/leads.ts:66-86.
    const leadIds = openLeads.map((l) => l.id);
    const lastActivities = leadIds.length
      ? await prisma.activity.groupBy({
          by: ["leadId"],
          where: { leadId: { in: leadIds } },
          _max: { activityDate: true },
        })
      : [];
    const lastActivityByLead = new Map<string, Date | null>();
    for (const row of lastActivities) {
      if (row.leadId) lastActivityByLead.set(row.leadId, row._max.activityDate);
    }

    // For (B) dedup follow-ups: an activity on the same lead newer than the
    // follow-up's activityDate implicitly satisfies the follow-up.
    const followUpLeadIds = followUps
      .map((a) => a.leadId)
      .filter((x): x is string => Boolean(x));
    const newestPerLead = followUpLeadIds.length
      ? await prisma.activity.groupBy({
          by: ["leadId"],
          where: { leadId: { in: followUpLeadIds } },
          _max: { activityDate: true },
        })
      : [];
    const newestActivityByLead = new Map<string, Date | null>();
    for (const row of newestPerLead) {
      if (row.leadId) newestActivityByLead.set(row.leadId, row._max.activityDate);
    }

    const items: QueueItem[] = [];

    // Tasks → kind = TASK (or PAYMENT_DUE if type=PAYMENT — but we surface
    // payments separately via the Payment table, so just label them TASK here).
    for (const t of tasks) {
      const dueAt = t.dueDate;
      const ageDays = Math.max(0, daysBetween(startOfDay, new Date(dueAt)));
      const overdue = dueAt.getTime() < startOfDay.getTime();
      const leadName = t.lead
        ? `${t.lead.firstName} ${t.lead.lastName}`.trim()
        : t.deal?.dealNumber ?? "Task";
      items.push({
        kind: "TASK",
        id: t.id,
        title: leadName,
        subtitle: `${t.type === "CALL" ? "Call" : t.type === "MEETING" ? "Meeting" : t.type === "DOCUMENT" ? "Document" : t.type === "PAYMENT" ? "Payment task" : "Follow-up"} · ${t.title}`,
        dueAt: dueAt.toISOString(),
        leadId: t.lead?.id ?? undefined,
        dealId: t.deal?.id ?? undefined,
        overdue,
        overdueDays: overdue ? ageDays : 0,
      });
    }

    // Follow-ups → kind = FOLLOW_UP, with implicit-completion dedup.
    for (const a of followUps) {
      if (!a.followUpDate) continue;
      // Skip if there is a newer activity on the same lead than this one's
      // activityDate — treat that as implicit completion of the follow-up.
      if (a.leadId) {
        const newest = newestActivityByLead.get(a.leadId);
        if (newest && newest.getTime() > a.activityDate.getTime()) continue;
      }
      const dueAt = a.followUpDate;
      const overdue = dueAt.getTime() < now.getTime();
      const ageDays = overdue ? daysBetween(now, dueAt) : 0;
      const name = a.lead
        ? `${a.lead.firstName} ${a.lead.lastName}`.trim()
        : "Follow-up";
      items.push({
        kind: "FOLLOW_UP",
        id: a.id,
        title: name,
        subtitle: `Follow-up · ${a.summary.slice(0, 80)}`,
        dueAt: dueAt.toISOString(),
        leadId: a.leadId ?? undefined,
        dealId: a.dealId ?? undefined,
        overdue,
        overdueDays: ageDays,
      });
    }

    // Silent leads → kind = SILENT_LEAD. "Silent" = last activity > 7 days
    // ago (or no activity at all and the lead was created > 7 days ago).
    for (const lead of openLeads) {
      const lastAt = lastActivityByLead.get(lead.id) ?? null;
      const reference = lastAt ?? lead.createdAt;
      if (reference.getTime() > sevenDaysAgo.getTime()) continue;
      const silentDays = daysBetween(now, reference);
      items.push({
        kind: "SILENT_LEAD",
        id: lead.id,
        title: `${lead.firstName} ${lead.lastName}`.trim(),
        subtitle: `${silentDays} days silent · ${lead.stage}`,
        dueAt: reference.toISOString(),
        leadId: lead.id,
        overdue: true,
        overdueDays: silentDays,
      });
    }

    // Payments due → kind = PAYMENT_DUE.
    for (const p of payments) {
      const overdue = p.dueDate.getTime() < startOfDay.getTime();
      const ageDays = overdue ? daysBetween(startOfDay, p.dueDate) : 0;
      const leadName = p.deal?.lead
        ? `${p.deal.lead.firstName} ${p.deal.lead.lastName}`.trim()
        : p.deal?.dealNumber ?? "Payment";
      items.push({
        kind: "PAYMENT_DUE",
        id: p.id,
        title: `${leadName} · ${p.deal?.dealNumber ?? ""}`.trim(),
        subtitle: `${p.milestoneLabel} · AED ${p.amount.toLocaleString("en-AE")}`,
        dueAt: p.dueDate.toISOString(),
        dealId: p.deal?.id,
        leadId: p.deal?.lead?.id,
        overdue,
        overdueDays: ageDays,
      });
    }

    // Sort: overdue first (by overdueDays desc), then by dueAt asc.
    items.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      if (a.overdue && b.overdue) {
        if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
      }
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

    res.json({ items });
  } catch (error) {
    console.error("[my-day] GET /queue", error);
    res.status(500).json({
      error: "Failed to fetch My Day queue",
      code: "FETCH_MY_DAY_QUEUE_ERROR",
      statusCode: 500,
    });
  }
});

export default router;
