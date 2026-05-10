/**
 * handoverService.ts — Handover checklist lifecycle.
 *
 * One checklist per deal. The checklist is seeded with a standard set of
 * operational items the first time it's read, then individual items are
 * toggled as the handover progresses. When every required item is complete,
 * the checklist can be marked COMPLETED — which also moves the parent deal
 * to the COMPLETED stage. Closes audit gap #9.
 */

import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Default checklist seed
// ---------------------------------------------------------------------------

type SeedItem = { category: string; label: string; required?: boolean };

const DEFAULT_CHECKLIST_ITEMS: SeedItem[] = [
  // Payments
  { category: "PAYMENTS",   label: "All scheduled payments cleared" },
  { category: "PAYMENTS",   label: "DLD fee paid" },
  { category: "PAYMENTS",   label: "Admin fee paid" },
  // Documents
  { category: "DOCUMENTS",  label: "Title deed received" },
  { category: "DOCUMENTS",  label: "SPA fully signed copy on file" },
  { category: "DOCUMENTS",  label: "Oqood certificate on file" },
  // Inspection
  { category: "INSPECTION", label: "Snag list resolved" },
  { category: "INSPECTION", label: "Final walkthrough completed" },
  // Keys
  { category: "KEYS",       label: "Keys handed to buyer" },
  { category: "KEYS",       label: "Access cards / fobs handed over" },
  // Utilities
  { category: "UTILITIES",  label: "DEWA account transferred" },
  { category: "UTILITIES",  label: "Chiller account transferred" },
];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HandoverError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "HANDOVER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checklistInclude() {
  return {
    items: {
      orderBy: [
        { category: "asc" as const },
        { sortOrder: "asc" as const },
        { createdAt: "asc" as const },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// getOrCreateChecklist
// ---------------------------------------------------------------------------

/**
 * Returns the checklist for a deal, seeding the standard items the first
 * time it's accessed. Idempotent: subsequent calls return the same row.
 */
export async function getOrCreateChecklist(dealId: string, _userId: string) {
  const existing = await prisma.handoverChecklist.findUnique({
    where:   { dealId },
    include: checklistInclude(),
  });
  if (existing) return existing;

  // Confirm the deal exists before seeding (FK would catch this anyway, but
  // a clean error message beats a 500).
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) {
    throw new HandoverError("Deal not found", 404, "DEAL_NOT_FOUND");
  }

  // Seed checklist + items in a single transaction so we never end up with
  // a header row but no items if something fails between the two writes.
  return prisma.$transaction(async (tx) => {
    const created = await tx.handoverChecklist.create({
      data: {
        dealId,
        items: {
          create: DEFAULT_CHECKLIST_ITEMS.map((it, idx) => ({
            category:  it.category,
            label:     it.label,
            required:  it.required ?? true,
            sortOrder: idx,
          })),
        },
      },
      include: checklistInclude(),
    });
    return created;
  });
}

// ---------------------------------------------------------------------------
// updateItem
// ---------------------------------------------------------------------------

/**
 * Toggle a single item's completed flag and/or notes. Sets completedAt +
 * completedBy when transitioning to completed, clears them when re-opening.
 */
export async function updateItem(
  itemId: string,
  patch: { completed?: boolean; notes?: string },
  userId: string,
) {
  const existing = await prisma.handoverChecklistItem.findUnique({
    where: { id: itemId },
  });
  if (!existing) {
    throw new HandoverError("Checklist item not found", 404, "ITEM_NOT_FOUND");
  }

  const data: {
    completed?:   boolean;
    notes?:       string | null;
    completedAt?: Date | null;
    completedBy?: string | null;
  } = {};

  if (patch.notes !== undefined) {
    data.notes = patch.notes;
  }

  if (patch.completed !== undefined && patch.completed !== existing.completed) {
    data.completed   = patch.completed;
    data.completedAt = patch.completed ? new Date() : null;
    data.completedBy = patch.completed ? userId     : null;
  }

  return prisma.handoverChecklistItem.update({
    where: { id: itemId },
    data,
  });
}

// ---------------------------------------------------------------------------
// markChecklistComplete
// ---------------------------------------------------------------------------

/**
 * Mark the checklist COMPLETED. Fails (400) if any required=true item is
 * still unchecked. Also bumps the parent deal to stage=COMPLETED if it
 * isn't already there.
 */
export async function markChecklistComplete(checklistId: string, userId: string) {
  const checklist = await prisma.handoverChecklist.findUnique({
    where:   { id: checklistId },
    include: { items: true, deal: { select: { id: true, stage: true } } },
  });
  if (!checklist) {
    throw new HandoverError("Checklist not found", 404, "CHECKLIST_NOT_FOUND");
  }

  if (checklist.status === "COMPLETED") {
    // Already complete — return as-is rather than 400'ing on a refresh.
    return prisma.handoverChecklist.findUnique({
      where:   { id: checklistId },
      include: checklistInclude(),
    });
  }

  const missing = checklist.items.filter((i) => i.required && !i.completed);
  if (missing.length > 0) {
    throw new HandoverError(
      `Cannot complete checklist — ${missing.length} required item(s) still pending: ${missing
        .map((m) => m.label)
        .join(", ")}`,
      400,
      "REQUIRED_ITEMS_PENDING",
    );
  }

  const ops: any[] = [
    prisma.handoverChecklist.update({
      where: { id: checklistId },
      data: {
        status:      "COMPLETED",
        completedAt: new Date(),
        completedBy: userId,
      },
    }),
  ];

  // Bump deal to COMPLETED if it isn't already. We sidestep the deal-stage
  // state machine here on purpose — the checklist itself is the gate, and
  // we don't want to fail a handover sign-off because of the document
  // requirements check that runs on stage transitions for pre-handover steps.
  if (checklist.deal.stage !== "COMPLETED") {
    ops.push(
      prisma.deal.update({
        where: { id: checklist.deal.id },
        data:  { stage: "COMPLETED" },
      }),
      prisma.dealStageHistory.create({
        data: {
          dealId:    checklist.deal.id,
          oldStage:  checklist.deal.stage,
          newStage:  "COMPLETED",
          changedBy: userId,
          reason:    "Handover checklist completed",
        },
      }),
    );
  }

  await prisma.$transaction(ops);

  return prisma.handoverChecklist.findUnique({
    where:   { id: checklistId },
    include: checklistInclude(),
  });
}
