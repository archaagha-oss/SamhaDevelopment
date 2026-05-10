/**
 * Tiny helper for choosing the background-job backend at boot.
 *
 * Extracted from `index.ts` so it can be unit-tested without spinning up
 * the full Express app. Two valid values:
 *
 *   - `"bullmq"` — operator opted into Redis-backed BullMQ. Adapter must
 *     load successfully or boot fails (no silent fallback — if you ask for
 *     bullmq you want bullmq).
 *   - `"db"` (default, also covers any unrecognised value) — keep the
 *     existing DB-polling loop. No Redis required.
 */

export type JobQueueBackend = "bullmq" | "db";

/**
 * Resolve the backend choice from an env-var-shaped object.
 * Default is `"db"` to preserve current behaviour for everyone who hasn't
 * explicitly opted in.
 */
export function resolveJobQueueBackend(
  env: { JOB_QUEUE_BACKEND?: string } = process.env
): JobQueueBackend {
  const raw = (env.JOB_QUEUE_BACKEND ?? "").trim().toLowerCase();
  if (raw === "bullmq") return "bullmq";
  return "db";
}
