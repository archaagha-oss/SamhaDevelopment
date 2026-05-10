/**
 * BullMQ-backed implementation of the background job system.
 *
 * This is an **optional** alternative to the homegrown DB-polling loop in
 * `jobHandlers.ts`. It is only loaded when `JOB_QUEUE_BACKEND=bullmq` and
 * the `bullmq` + `ioredis` optional dependencies are installed.
 *
 * Key design choices:
 *
 *  1. **Lazy import.** We do NOT `import "bullmq"` at module top-level —
 *     that would crash module load on environments where the optional dep
 *     isn't installed (e.g. CI, single-instance dev). Instead the imports
 *     happen inside `createBullmqAdapter()` and are caught explicitly.
 *
 *  2. **Handler reuse.** The Worker's processor looks up handlers in the
 *     `jobHandlerMap` exported from `jobHandlers.ts` so the two backends
 *     execute identical business logic — no duplication.
 *
 *  3. **Connection resilience.** `ioredis` will reconnect automatically on
 *     transient Redis outages. We log connection errors but do **not**
 *     crash the API process — the HTTP surface stays up; jobs just pause
 *     until Redis recovers.
 *
 *  4. **Retention / retry shape** matches the existing scheduleJob behaviour
 *     in `jobHandlers.ts`: 3 attempts with exponential back-off, retain the
 *     last 100 completed and 500 failed jobs.
 */

import { logger } from "../../lib/logger";
import { jobHandlerMap, type JobType } from "./jobHandlers";

// ---------------------------------------------------------------------------
// Types — declared inline to avoid a hard `import "bullmq"` at module top.
// At runtime we use `any` so the file type-checks even when the optional
// peer deps aren't installed in node_modules.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BullQueue = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BullWorker = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BullJobsOptions = any;

const QUEUE_NAME = "samha-jobs";

// Module-level handle so `bullmqShutdown()` can find the active instance.
let activeAdapter: {
  queue: BullQueue;
  worker: BullWorker;
} | null = null;

// ---------------------------------------------------------------------------
// Default retention / retry policy. Mirrors the implicit shape of the
// existing DB-poller scheduleJob (3 attempts, exponential back-off). Values
// chosen to be production-safe, not maximum:
//
//   - removeOnComplete: 100 — enough history to debug recent runs without
//     letting Redis memory grow unbounded.
//   - removeOnFail: 500 — failures are rarer and more interesting; keep more.
//   - attempts: 3 — same as the DB poller's `maxRetries: 3`.
//   - backoff exponential 60s — first retry +1m, second +2m, third +4m.
// ---------------------------------------------------------------------------

export const DEFAULT_JOB_OPTS: BullJobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 500,
  attempts: 3,
  backoff: { type: "exponential", delay: 60_000 },
};

// ---------------------------------------------------------------------------
// createBullmqAdapter — wires up Queue + Worker + connection.
// ---------------------------------------------------------------------------

/**
 * Lazy-loads `bullmq` and `ioredis`, creates the queue and worker, and wires
 * up error logging. Throws a friendly error if either dependency is missing
 * or `REDIS_URL` is not set (the operator explicitly opted into bullmq, so
 * silent fallback would be surprising).
 *
 * On Redis connection errors during steady-state operation, this logs but
 * does NOT throw — `ioredis` reconnects automatically; jobs pause until
 * Redis recovers.
 */
export async function createBullmqAdapter(): Promise<{
  queue: BullQueue;
  worker: BullWorker;
}> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error(
      "[bullmqAdapter] JOB_QUEUE_BACKEND=bullmq but REDIS_URL is not set. " +
        "Set REDIS_URL=redis://host:6379 (or fall back to JOB_QUEUE_BACKEND=db)."
    );
  }

  // Lazy-load bullmq + ioredis. If either is missing we throw a clear error
  // rather than crashing on module evaluation — operator can downgrade to
  // JOB_QUEUE_BACKEND=db without re-installing.
  //
  // We type these as `any` (instead of `typeof import("bullmq")`) on
  // purpose: the static type-check would otherwise need the module's
  // declaration files present in node_modules, defeating the
  // optionalDependencies guarantee. The `@ts-ignore` lines suppress the
  // module-not-found errors that surface when those packages aren't yet
  // installed (e.g. in CI without Redis).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bullmq: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let IORedis: any;
  try {
    // @ts-ignore — optional dependency; resolved at runtime only.
    bullmq = await import("bullmq");
    // @ts-ignore — optional dependency; resolved at runtime only.
    const ioredisModule = await import("ioredis");
    IORedis = ioredisModule.default ?? ioredisModule;
  } catch (err) {
    throw new Error(
      "[bullmqAdapter] Failed to load 'bullmq' / 'ioredis' optional " +
        "dependencies. Install them with `npm install bullmq ioredis` in " +
        "apps/api, or unset JOB_QUEUE_BACKEND to use the DB-polling fallback. " +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Two connections: BullMQ requires `maxRetriesPerRequest: null` on the
  // worker connection (per its docs) so blocking commands aren't aborted.
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on("error", (err: Error) => {
    logger.error(`[bullmqAdapter] Redis connection error: ${err.message}`);
    // Do NOT throw or exit — ioredis will reconnect automatically. Jobs
    // pause until the connection recovers.
  });

  connection.on("reconnecting", () => {
    logger.warn("[bullmqAdapter] Redis reconnecting...");
  });

  connection.on("ready", () => {
    logger.info("[bullmqAdapter] Redis connection ready");
  });

  // Queue — used to enqueue jobs from anywhere in the app.
  const queue: BullQueue = new bullmq.Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTS,
  });

  queue.on("error", (err: Error) => {
    logger.error(`[bullmqAdapter] Queue error: ${err.message}`);
  });

  // Worker — processes jobs by name, dispatching to the same handler map
  // that `jobHandlers.ts` uses for the DB-poller path.
  const worker: BullWorker = new bullmq.Worker(
    QUEUE_NAME,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (job: any) => {
      const name = job.name as JobType;
      const handler = jobHandlerMap[name];
      if (!handler) {
        // Unknown job names are a bug, not a transient failure — surface
        // loudly so they show up in error tracking.
        throw new Error(`[bullmqAdapter] Unknown job type: ${name}`);
      }
      // Payload is whatever was passed to `bullmqScheduleJob`; default to {}
      // so handlers that ignore payload (the *_CHECK / *_SWEEP types) are
      // unaffected.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (job.data ?? {}) as Record<string, any>;
      await handler(payload);
    },
    {
      connection,
      // Concurrency 4 is a conservative default; production can tune via
      // BULLMQ_CONCURRENCY. Most of our handlers are I/O-bound (Prisma +
      // mailer) so a small pool keeps DB connections sane.
      concurrency: parseInt(process.env.BULLMQ_CONCURRENCY ?? "4", 10),
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worker.on("failed", (job: any, err: Error) => {
    logger.error(
      `[bullmqAdapter] Job ${job?.id} (${job?.name}) failed: ${err.message}`
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worker.on("completed", (job: any) => {
    logger.info(`[bullmqAdapter] Job ${job?.id} (${job?.name}) completed`);
  });

  worker.on("error", (err: Error) => {
    // Worker-level errors are typically Redis connection issues. Log and
    // continue — bullmq + ioredis will recover on their own.
    logger.error(`[bullmqAdapter] Worker error: ${err.message}`);
  });

  activeAdapter = { queue, worker };
  logger.info(
    `[bullmqAdapter] BullMQ adapter ready (queue="${QUEUE_NAME}", redis=${redisUrl.replace(/:[^:@]*@/, ":***@")})`
  );

  return activeAdapter;
}

// ---------------------------------------------------------------------------
// bullmqScheduleJob — drop-in replacement for jobHandlers.scheduleJob.
// ---------------------------------------------------------------------------

/**
 * Enqueue a job in BullMQ.
 *
 * Signature mirrors `scheduleJob(type, payload, scheduledAt)` from
 * `jobHandlers.ts`. The third argument can be either:
 *   - a `Date` (for back-compat with the DB-poller signature) — converted
 *     to a `delay` of `Date - now`, clamped to ≥ 0.
 *   - a BullMQ `JobsOptions` object — passed through (allows
 *     `{ delay, priority, repeat, ... }`).
 */
export async function bullmqScheduleJob(
  name: JobType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  opts?: Date | BullJobsOptions
): Promise<void> {
  if (!activeAdapter) {
    throw new Error(
      "[bullmqAdapter] bullmqScheduleJob called before createBullmqAdapter(); " +
        "wire the adapter at boot or check JOB_QUEUE_BACKEND."
    );
  }

  let jobOpts: BullJobsOptions = { ...DEFAULT_JOB_OPTS };
  if (opts instanceof Date) {
    const delay = Math.max(0, opts.getTime() - Date.now());
    jobOpts = { ...jobOpts, delay };
  } else if (opts) {
    jobOpts = { ...jobOpts, ...opts };
  }

  await activeAdapter.queue.add(name, payload, jobOpts);
}

// ---------------------------------------------------------------------------
// bullmqShutdown — close worker + queue cleanly.
// ---------------------------------------------------------------------------

/**
 * Graceful shutdown. Idempotent — safe to call when no adapter is active.
 * Closes worker first (lets in-flight jobs finish) then queue.
 */
export async function bullmqShutdown(): Promise<void> {
  if (!activeAdapter) return;

  const { queue, worker } = activeAdapter;
  activeAdapter = null;

  try {
    await worker.close();
  } catch (err) {
    logger.error(
      `[bullmqAdapter] Error closing worker: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    await queue.close();
  } catch (err) {
    logger.error(
      `[bullmqAdapter] Error closing queue: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Test-visible helpers
// ---------------------------------------------------------------------------

/** Test-only: returns whether an adapter has been created. */
export function __hasActiveAdapter(): boolean {
  return activeAdapter !== null;
}

/** Test-only: clears the active-adapter handle without closing connections. */
export function __resetActiveAdapter(): void {
  activeAdapter = null;
}
