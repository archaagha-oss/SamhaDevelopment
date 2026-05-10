import { Request, Response } from "express";
import { Prisma } from "@prisma/client";

/**
 * Thrown by optimisticUpdate() when the row's `version` no longer matches
 * the `expectedVersion` the client sent. The handler converts this to a
 * 409 Conflict response that includes the current row + version so the
 * client can offer a "reload and retry" without a second roundtrip.
 */
export class OptimisticLockError<T = unknown> extends Error {
  readonly code = "OPTIMISTIC_LOCK_CONFLICT";
  readonly statusCode = 409;
  readonly currentVersion: number;
  readonly currentRow: T | null;

  constructor(modelLabel: string, currentVersion: number, currentRow: T | null) {
    super(
      `${modelLabel} was modified by someone else. Reload to see the latest changes before retrying.`,
    );
    this.name = "OptimisticLockError";
    this.currentVersion = currentVersion;
    this.currentRow = currentRow;
  }
}

/**
 * Run an UPDATE that only succeeds when the row's `version` equals
 * `expectedVersion`, and increments `version` on success. Throws
 * OptimisticLockError if the row was modified between the client's last
 * read and this write.
 *
 * Implementation note: we use updateMany (no error on 0 rows) followed by
 * a count check rather than a transaction-wrapped findUnique-then-update,
 * because the former is ONE SQL roundtrip and atomic at the row level —
 * the WHERE clause `id=X AND version=N` is the lock. If 0 rows are
 * affected we re-read the row to give the client the current state.
 *
 * Usage:
 *   const updated = await optimisticUpdate({
 *     model: prisma.deal,
 *     modelLabel: "Deal",
 *     id: dealId,
 *     expectedVersion,
 *     data: { salePrice, discount, … },
 *   });
 *
 * `data` should NOT include `version` — the helper bumps it.
 */
export async function optimisticUpdate<T extends { id: string; version: number }>(opts: {
  /** A Prisma delegate, e.g. `prisma.deal`, `prisma.lead`, `prisma.unit`. */
  model: {
    updateMany: (args: any) => Promise<{ count: number }>;
    findUnique: (args: any) => Promise<T | null>;
  };
  /** Human-readable label for the error message ("Deal", "Lead", "Unit"). */
  modelLabel: string;
  id: string;
  expectedVersion: number;
  data: Record<string, any>;
  /** Optional Prisma `select` shape to scope the re-read on conflict. */
  selectOnConflict?: Prisma.JsonObject;
}): Promise<T> {
  const { model, modelLabel, id, expectedVersion, data, selectOnConflict } = opts;

  const result = await model.updateMany({
    where: { id, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });

  if (result.count === 1) {
    // Re-read the row so the caller gets the post-update snapshot
    // (including the bumped version) without inferring it.
    const fresh = await model.findUnique({ where: { id } });
    if (!fresh) {
      // Extremely narrow race: row deleted between our update and read.
      // Treat as conflict so the client refetches.
      throw new OptimisticLockError(modelLabel, -1, null);
    }
    return fresh;
  }

  // 0 rows affected — either the id doesn't exist (caller should have
  // checked earlier) or the version no longer matches. Re-read to find out.
  const current = await model.findUnique({
    where: { id },
    ...(selectOnConflict ? { select: selectOnConflict } : {}),
  });
  throw new OptimisticLockError(
    modelLabel,
    current?.version ?? -1,
    current ?? null,
  );
}

/**
 * Pull the client's `expectedVersion` from a request body. Returns null
 * if absent or invalid — callers that demand it should reject with 400
 * before calling optimisticUpdate. We deliberately do NOT default to 0
 * for missing values because that would let an outdated client write
 * over a long-evolved record (its missing value would just match
 * version=0 on a row that's been edited many times).
 */
export function readExpectedVersion(req: Request): number | null {
  const raw = req.body?.expectedVersion;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) return null;
  return raw;
}

/**
 * Convert an OptimisticLockError caught in a route handler into the
 * standard 409 response shape. Returns true if it handled the error
 * (so the caller can `if (handled) return;`), false otherwise so the
 * caller falls through to its normal 500 path.
 */
export function handleOptimisticLockError(err: unknown, res: Response): boolean {
  if (err instanceof OptimisticLockError) {
    res.status(409).json({
      error: err.message,
      code: err.code,
      statusCode: 409,
      currentVersion: err.currentVersion,
      currentRow: err.currentRow,
    });
    return true;
  }
  return false;
}
