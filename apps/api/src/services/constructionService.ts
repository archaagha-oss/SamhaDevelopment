/**
 * constructionService.ts — Construction milestone tracker.
 *
 * One project has N construction milestones (e.g. "Foundation", "Structure",
 * "MEP rough-in", "Finishes", "Snagging", "Ready for handover"), each with a
 * target date, optional completion date, and 0-100 progress percentage.
 *
 * Distinct from:
 *   - Project.completionStatus — high-level enum (OFF_PLAN / UNDER_CONSTRUCTION / READY)
 *   - Project.handoverDate     — single date
 *   - ProjectUpdate            — media-attached news items
 */

import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Default milestone seed
// ---------------------------------------------------------------------------

type SeedSpec = {
  label: string;
  // anchor: which project date to offset from
  anchor: "launch" | "handover";
  // signed offset in days; positive means after the anchor, negative before
  offsetDays: number;
};

const DEFAULT_MILESTONES: SeedSpec[] = [
  { label: "Foundation",          anchor: "launch",   offsetDays: 90 },
  { label: "Structure",           anchor: "launch",   offsetDays: 270 },
  { label: "MEP rough-in",        anchor: "launch",   offsetDays: 450 },
  { label: "Finishes",            anchor: "launch",   offsetDays: 600 },
  { label: "Snagging",            anchor: "handover", offsetDays: -60 },
  { label: "Ready for handover",  anchor: "handover", offsetDays: 0 },
];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ConstructionError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "CONSTRUCTION_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function milestoneOrderBy() {
  return [
    { sortOrder: "asc" as const },
    { targetDate: "asc" as const },
    { createdAt: "asc" as const },
  ];
}

// ---------------------------------------------------------------------------
// getOrSeedMilestones
// ---------------------------------------------------------------------------

/**
 * Returns the milestones for a project, seeding the standard set on first
 * call (when none exist yet). Idempotent: subsequent calls return existing
 * rows untouched, so an operator who deletes the default set won't have it
 * re-created the next time the page loads.
 *
 * Anchors target dates to the project's launchDate / handoverDate. If launch
 * is null we fall back to createdAt for the launch-anchored milestones so the
 * seed still produces reasonable defaults rather than crashing.
 */
export async function getOrSeedMilestones(projectId: string) {
  const existing = await prisma.constructionMilestone.findMany({
    where:   { projectId },
    orderBy: milestoneOrderBy(),
  });
  if (existing.length > 0) return existing;

  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, launchDate: true, handoverDate: true, createdAt: true },
  });
  if (!project) {
    throw new ConstructionError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  const launchAnchor   = project.launchDate ?? project.createdAt;
  const handoverAnchor = project.handoverDate;

  await prisma.constructionMilestone.createMany({
    data: DEFAULT_MILESTONES.map((m, idx) => ({
      projectId,
      label:           m.label,
      targetDate:      addDays(m.anchor === "launch" ? launchAnchor : handoverAnchor, m.offsetDays),
      progressPercent: 0,
      sortOrder:       idx,
    })),
  });

  return prisma.constructionMilestone.findMany({
    where:   { projectId },
    orderBy: milestoneOrderBy(),
  });
}

// ---------------------------------------------------------------------------
// updateMilestone
// ---------------------------------------------------------------------------

export type UpdateMilestonePatch = {
  progressPercent?: number;
  completedDate?:   Date | string | null;
  notes?:           string | null;
  targetDate?:      Date | string;
  label?:           string;
  description?:     string | null;
};

/**
 * Patch a milestone. Auto-stamps lastUpdatedBy. When progressPercent reaches
 * 100 and no completedDate was supplied, completedDate auto-sets to now;
 * when it drops below 100 and the caller didn't explicitly set completedDate,
 * it clears.
 *
 * After the update commits, if the project's overall construction-progress
 * percent has changed, any ON_CONSTRUCTION_PCT payments whose threshold is
 * now <= overallPercent get their dueDate set to today (matching the
 * ON_SPA_SIGNING / ON_OQOOD pattern in dealService.transitionStage).
 *
 * Returns the updated milestone along with the list of payments that fired
 * so the route can surface a "N payments marked due" toast.
 */
export async function updateMilestone(
  id: string,
  patch: UpdateMilestonePatch,
  userId: string,
): Promise<{
  milestone: Awaited<ReturnType<typeof prisma.constructionMilestone.update>>;
  paymentsTriggered: TriggeredPayment[];
}> {
  const existing = await prisma.constructionMilestone.findUnique({ where: { id } });
  if (!existing) {
    throw new ConstructionError("Milestone not found", 404, "MILESTONE_NOT_FOUND");
  }

  const data: Record<string, unknown> = { lastUpdatedBy: userId };

  if (patch.progressPercent !== undefined) {
    if (patch.progressPercent < 0 || patch.progressPercent > 100) {
      throw new ConstructionError(
        "progressPercent must be between 0 and 100",
        400,
        "INVALID_PROGRESS_PERCENT",
      );
    }
    data.progressPercent = patch.progressPercent;
  }

  if (patch.completedDate !== undefined) {
    data.completedDate = patch.completedDate ? new Date(patch.completedDate) : null;
  } else if (patch.progressPercent !== undefined) {
    // Auto-set / auto-clear completedDate based on the 100% threshold, but
    // only when the caller didn't explicitly pass completedDate (so an
    // operator can override the auto-stamp by supplying it themselves).
    if (patch.progressPercent === 100 && !existing.completedDate) {
      data.completedDate = new Date();
    } else if (patch.progressPercent < 100 && existing.completedDate) {
      data.completedDate = null;
    }
  }

  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.targetDate !== undefined) data.targetDate = new Date(patch.targetDate);
  if (patch.label !== undefined) data.label = patch.label;
  if (patch.description !== undefined) data.description = patch.description;

  const milestone = await prisma.constructionMilestone.update({ where: { id }, data });

  // Only re-evaluate ON_CONSTRUCTION_PCT triggers when the progress changed —
  // edits to label / dates / notes don't move the overall %.
  const paymentsTriggered = patch.progressPercent !== undefined
    ? await fireConstructionPctTriggers(milestone.projectId)
    : [];

  return { milestone, paymentsTriggered };
}

// ---------------------------------------------------------------------------
// fireConstructionPctTriggers
// ---------------------------------------------------------------------------

export type TriggeredPayment = {
  paymentId: string;
  dealId:    string;
  amount:    number;
  threshold: number;
};

/**
 * Auto-due any ON_CONSTRUCTION_PCT payment whose threshold has been reached.
 *
 * Matches the dealService.transitionStage pattern: payments materialized
 * from an ON_CONSTRUCTION_PCT plan-milestone start life as PENDING with a
 * placeholder dueDate. When the project's overall construction % crosses
 * the payment's `constructionPercent` threshold, we set dueDate = today so
 * the finance team sees it on collection dashboards.
 *
 * Idempotency: we only flip rows whose dueDate is still in the future (the
 * placeholder). Once a row has been auto-dued, its dueDate is "today or
 * earlier" and the WHERE clause won't pick it up again — so re-running
 * after subsequent % changes is safe.
 */
export async function fireConstructionPctTriggers(
  projectId: string,
): Promise<TriggeredPayment[]> {
  // Recompute overall % from current milestone state.
  const milestones = await prisma.constructionMilestone.findMany({
    where:  { projectId },
    select: { progressPercent: true },
  });
  if (milestones.length === 0) return [];
  const overallPercent = Math.round(
    milestones.reduce((sum, m) => sum + m.progressPercent, 0) / milestones.length,
  );

  // Find candidates: payments on this project's deals, ON_CONSTRUCTION_PCT,
  // threshold met, status still PENDING (or OVERDUE — defensive), dueDate
  // still in the future (i.e. not yet auto-dued).
  const now = new Date();
  const candidates = await prisma.payment.findMany({
    where: {
      scheduleTrigger:     "ON_CONSTRUCTION_PCT" as any,
      constructionPercent: { not: null, lte: overallPercent },
      status:              { in: ["PENDING", "OVERDUE"] },
      dueDate:             { gt: now },
      deal:                { unitId: { not: undefined }, unit: { projectId } },
    },
    select: {
      id:                  true,
      dealId:              true,
      amount:              true,
      constructionPercent: true,
    },
  });

  if (candidates.length === 0) return [];

  await prisma.payment.updateMany({
    where: { id: { in: candidates.map((p) => p.id) } },
    data:  { dueDate: now },
  });

  return candidates.map((p) => ({
    paymentId: p.id,
    dealId:    p.dealId,
    amount:    p.amount,
    threshold: p.constructionPercent ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// createMilestone
// ---------------------------------------------------------------------------

export type CreateMilestoneInput = {
  label: string;
  targetDate: Date | string;
  description?: string | null;
  progressPercent?: number;
  sortOrder?: number;
  notes?: string | null;
};

export async function createMilestone(
  projectId: string,
  input: CreateMilestoneInput,
  userId: string,
) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true },
  });
  if (!project) {
    throw new ConstructionError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  const progressPercent = input.progressPercent ?? 0;
  if (progressPercent < 0 || progressPercent > 100) {
    throw new ConstructionError(
      "progressPercent must be between 0 and 100",
      400,
      "INVALID_PROGRESS_PERCENT",
    );
  }

  // Default sortOrder to (max existing) + 1 so new custom milestones land
  // at the bottom of the list rather than colliding on the default 0.
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.constructionMilestone.findFirst({
      where:   { projectId },
      orderBy: { sortOrder: "desc" },
      select:  { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  return prisma.constructionMilestone.create({
    data: {
      projectId,
      label:           input.label,
      description:     input.description ?? null,
      targetDate:      new Date(input.targetDate),
      progressPercent,
      sortOrder,
      notes:           input.notes ?? null,
      lastUpdatedBy:   userId,
      completedDate:   progressPercent === 100 ? new Date() : null,
    },
  });
}

// ---------------------------------------------------------------------------
// deleteMilestone
// ---------------------------------------------------------------------------

export async function deleteMilestone(id: string) {
  const existing = await prisma.constructionMilestone.findUnique({
    where:  { id },
    select: { id: true },
  });
  if (!existing) {
    throw new ConstructionError("Milestone not found", 404, "MILESTONE_NOT_FOUND");
  }
  await prisma.constructionMilestone.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// getProjectProgress
// ---------------------------------------------------------------------------

/**
 * Composite read used by the Construction Progress page. Seeds defaults on
 * first call so a freshly-created project still shows the standard milestone
 * skeleton.
 *
 * overallPercent is the mean of all milestone progressPercent values, weighted
 * equally and rounded to the nearest integer. Empty milestone list → 0.
 *
 * nextMilestone is the first not-yet-complete (progressPercent < 100)
 * milestone in sort order — i.e. what's "up next" for the project team.
 *
 * paymentTriggers lists the ON_CONSTRUCTION_PCT payment thresholds that
 * have been configured for this project so the page can show "next
 * payment fires at X%" hints.
 */
export async function getProjectProgress(projectId: string) {
  const milestones = await getOrSeedMilestones(projectId);

  const totalCount     = milestones.length;
  const completedCount = milestones.filter((m) => m.progressPercent >= 100).length;
  const overallPercent = totalCount === 0
    ? 0
    : Math.round(
        milestones.reduce((sum, m) => sum + m.progressPercent, 0) / totalCount,
      );

  const nextMilestone = milestones.find((m) => m.progressPercent < 100) ?? null;

  // Distinct construction-pct thresholds across all payments on this project's
  // deals. Used by the page to surface "payments fire at X / Y / Z %" hints.
  const triggerRows = await prisma.payment.findMany({
    where: {
      scheduleTrigger:     "ON_CONSTRUCTION_PCT" as any,
      constructionPercent: { not: null },
      deal:                { unit: { projectId } },
    },
    select: { constructionPercent: true },
    distinct: ["constructionPercent"],
    orderBy:  { constructionPercent: "asc" },
  });
  const paymentTriggers = triggerRows
    .map((r) => r.constructionPercent)
    .filter((p): p is number => p !== null);

  return {
    overallPercent,
    completedCount,
    totalCount,
    milestones,
    nextMilestone,
    paymentTriggers,
  };
}
