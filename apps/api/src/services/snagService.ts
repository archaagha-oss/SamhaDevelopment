/**
 * snagService.ts — Snag list lifecycle for a unit.
 *
 * A unit can have multiple snag lists (e.g. initial walk-through and a
 * post-rectification revisit). Each list holds individual items with a
 * severity, optional contractor + due date, and a status that progresses
 * through RAISED → ACKNOWLEDGED → IN_PROGRESS → FIXED → CLOSED (with
 * REJECTED as a terminal off-ramp). Items carry before/after photos.
 *
 * The service is intentionally thin — it owns three small lifecycle rules:
 *   1. CLOSE on FIXED auto-stamps fixedDate when the caller didn't supply one.
 *   2. CLOSE on CLOSED auto-stamps closedDate and bubbles up to close the
 *      parent list when every sibling item is CLOSED/REJECTED.
 *   3. REJECTED requires a rejectionReason.
 */

import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = ["COSMETIC", "MINOR", "MAJOR", "CRITICAL"] as const;
const VALID_STATUSES = [
  "RAISED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "FIXED",
  "REJECTED",
  "CLOSED",
] as const;
const TERMINAL_STATUSES = new Set(["CLOSED", "REJECTED"]);

type Severity = (typeof VALID_SEVERITIES)[number];
type Status = (typeof VALID_STATUSES)[number];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SnagError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "SNAG_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listInclude() {
  return {
    items: {
      orderBy: { createdAt: "asc" as const },
      include: {
        photos: { orderBy: { uploadedAt: "asc" as const } },
      },
    },
  };
}

function itemInclude() {
  return {
    photos: { orderBy: { uploadedAt: "asc" as const } },
  };
}

function parseDate(input: string | null | undefined): Date | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new SnagError(`Invalid date: ${input}`, 400, "INVALID_DATE");
  }
  return d;
}

function todayIso(): string {
  // YYYY-MM-DD for the auto-label.
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// listForUnit
// ---------------------------------------------------------------------------

/**
 * Return every snag list for a unit, ordered by raisedAt desc (newest first).
 * Each list's items are ordered by createdAt asc, and each item's photos are
 * ordered by uploadedAt asc.
 */
export async function listForUnit(unitId: string) {
  return prisma.snagList.findMany({
    where:   { unitId },
    orderBy: { raisedAt: "desc" },
    include: listInclude(),
  });
}

// ---------------------------------------------------------------------------
// createList
// ---------------------------------------------------------------------------

/**
 * Create a new snag list for a unit. Auto-labels as "Snag list YYYY-MM-DD"
 * when no label is provided. Verifies the unit exists first so we can return
 * a clean 404 instead of relying on the FK violation.
 */
export async function createList(
  unitId: string,
  label: string | null | undefined,
  raisedBy: string,
) {
  const unit = await prisma.unit.findUnique({
    where:  { id: unitId },
    select: { id: true },
  });
  if (!unit) {
    throw new SnagError("Unit not found", 404, "UNIT_NOT_FOUND");
  }

  const finalLabel = (label ?? "").trim() || `Snag list ${todayIso()}`;

  return prisma.snagList.create({
    data: {
      unitId,
      label:    finalLabel,
      raisedBy,
    },
    include: listInclude(),
  });
}

// ---------------------------------------------------------------------------
// addItem
// ---------------------------------------------------------------------------

export interface AddItemBody {
  room?:           string | null;
  category?:       string | null;
  description:     string;
  severity:        string;
  contractorName?: string | null;
  dueDate?:        string | null;
}

/**
 * Add a new item to an existing snag list. Validates severity and the parent
 * list. Status defaults to RAISED.
 */
export async function addItem(
  listId: string,
  body: AddItemBody,
  _createdBy: string,
) {
  if (!VALID_SEVERITIES.includes(body.severity as Severity)) {
    throw new SnagError(
      `Invalid severity: ${body.severity}. Must be one of ${VALID_SEVERITIES.join(", ")}`,
      400,
      "INVALID_SEVERITY",
    );
  }

  const list = await prisma.snagList.findUnique({
    where:  { id: listId },
    select: { id: true, closedAt: true },
  });
  if (!list) {
    throw new SnagError("Snag list not found", 404, "LIST_NOT_FOUND");
  }

  // Re-opening: if a new item is added to a list that was previously closed,
  // un-close it so the lifecycle stays consistent.
  if (list.closedAt) {
    await prisma.snagList.update({
      where: { id: listId },
      data:  { closedAt: null },
    });
  }

  return prisma.snagItem.create({
    data: {
      snagListId:     listId,
      room:           body.room ?? null,
      category:       body.category ?? null,
      description:    body.description,
      severity:       body.severity,
      contractorName: body.contractorName ?? null,
      dueDate:        parseDate(body.dueDate),
      status:         "RAISED",
    },
    include: itemInclude(),
  });
}

// ---------------------------------------------------------------------------
// setItemStatus
// ---------------------------------------------------------------------------

export interface StatusExtras {
  rejectionReason?: string | null;
  fixedDate?:       string | null;
}

/**
 * Transition a snag item's status. Handles the three lifecycle rules called
 * out in the file header.
 */
export async function setItemStatus(
  itemId: string,
  status: string,
  extras: StatusExtras,
  _actorId: string,
) {
  if (!VALID_STATUSES.includes(status as Status)) {
    throw new SnagError(
      `Invalid status: ${status}. Must be one of ${VALID_STATUSES.join(", ")}`,
      400,
      "INVALID_STATUS",
    );
  }

  const item = await prisma.snagItem.findUnique({
    where:  { id: itemId },
    select: { id: true, snagListId: true, status: true },
  });
  if (!item) {
    throw new SnagError("Snag item not found", 404, "ITEM_NOT_FOUND");
  }

  const data: {
    status:           string;
    fixedDate?:       Date | null;
    closedDate?:      Date | null;
    rejectionReason?: string | null;
  } = { status };

  if (status === "FIXED") {
    const supplied = parseDate(extras.fixedDate);
    data.fixedDate = supplied ?? new Date();
  } else if (status === "CLOSED") {
    data.closedDate = new Date();
  } else if (status === "REJECTED") {
    const reason = (extras.rejectionReason ?? "").trim();
    if (!reason) {
      throw new SnagError(
        "rejectionReason is required when status=REJECTED",
        400,
        "REJECTION_REASON_REQUIRED",
      );
    }
    data.rejectionReason = reason;
  }

  // Caller can also pass a fixedDate independent of status transition (e.g.
  // correcting a prior date). Honor it when supplied even if status != FIXED.
  if (status !== "FIXED" && extras.fixedDate !== undefined && extras.fixedDate !== null) {
    const parsed = parseDate(extras.fixedDate);
    if (parsed) data.fixedDate = parsed;
  }

  const updated = await prisma.snagItem.update({
    where: { id: itemId },
    data,
    include: itemInclude(),
  });

  // Bubble closure up to the parent list when every sibling is terminal.
  if (status === "CLOSED" || status === "REJECTED") {
    const siblings = await prisma.snagItem.findMany({
      where:  { snagListId: item.snagListId },
      select: { status: true },
    });
    const allTerminal = siblings.length > 0 && siblings.every((s) => TERMINAL_STATUSES.has(s.status));
    if (allTerminal) {
      await prisma.snagList.update({
        where: { id: item.snagListId },
        data:  { closedAt: new Date() },
      });
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// addPhoto
// ---------------------------------------------------------------------------

export interface AddPhotoBody {
  s3Key:   string;
  caption?: string | null;
  kind:    "BEFORE" | "AFTER";
}

export async function addPhoto(
  itemId: string,
  body: AddPhotoBody,
  uploadedBy: string,
) {
  const item = await prisma.snagItem.findUnique({
    where:  { id: itemId },
    select: { id: true },
  });
  if (!item) {
    throw new SnagError("Snag item not found", 404, "ITEM_NOT_FOUND");
  }

  return prisma.snagPhoto.create({
    data: {
      snagItemId: itemId,
      s3Key:      body.s3Key,
      caption:    body.caption ?? null,
      kind:       body.kind,
      uploadedBy,
    },
  });
}

// ---------------------------------------------------------------------------
// deletePhoto
// ---------------------------------------------------------------------------

export async function deletePhoto(photoId: string) {
  const photo = await prisma.snagPhoto.findUnique({
    where:  { id: photoId },
    select: { id: true },
  });
  if (!photo) {
    throw new SnagError("Snag photo not found", 404, "PHOTO_NOT_FOUND");
  }
  await prisma.snagPhoto.delete({ where: { id: photoId } });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// deleteItem
// ---------------------------------------------------------------------------

export async function deleteItem(itemId: string) {
  const item = await prisma.snagItem.findUnique({
    where:  { id: itemId },
    select: { id: true },
  });
  if (!item) {
    throw new SnagError("Snag item not found", 404, "ITEM_NOT_FOUND");
  }
  await prisma.snagItem.delete({ where: { id: itemId } });
  return { ok: true as const };
}
