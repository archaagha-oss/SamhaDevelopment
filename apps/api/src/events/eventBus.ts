/**
 * Domain event bus + outbox dispatcher.
 *
 * Outbox pattern:
 *   1. Business code calls `recordEvent(tx, event)` INSIDE a Prisma transaction.
 *      The DomainEvent row is committed atomically with the business mutation
 *      that produced it. If the transaction rolls back, the event row rolls
 *      back too — events can never be "lost" mid-transaction.
 *   2. After commit, callers can call `eventBus.dispatch(event)` to invoke
 *      in-process handlers immediately (best-effort, low-latency).
 *   3. The outbox dispatcher periodically scans `DomainEvent WHERE
 *      processedAt IS NULL` and re-dispatches anything missed (e.g. the
 *      process crashed before in-process dispatch ran).
 *
 * This is a deliberate downgrade from a real broker (Redis Streams /
 * RabbitMQ / Kafka): we trade throughput for simplicity, and we keep the
 * existing schema. Migrating to a real broker later only requires changing
 * `dispatchPendingOutboxEvents` to publish to the broker.
 *
 * The legacy `emit()` method is preserved for callers that only need
 * in-process dispatch (no atomic guarantee). New callers should prefer
 * `recordEvent()` + `dispatch()`.
 */

import { EventEmitter } from "node:events";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Domain event types
// ---------------------------------------------------------------------------

export type DomainEventType =
  | "DEAL_CREATED"
  | "DEAL_STAGE_CHANGED"
  | "DEAL_CANCELLED"
  | "UNIT_RESERVED"
  | "UNIT_STATUS_CHANGED"
  | "RESERVATION_CREATED"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_CONVERTED"
  | "OFFER_CREATED"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "SPA_SIGNED"
  | "OQOOD_REGISTERED"
  | "OQOOD_DEADLINE_WARNING"
  | "COMMISSION_UNLOCKED"
  | "COMMISSION_APPROVED"
  | "COMMISSION_PAID"
  | "LEAD_STAGE_CHANGED"
  | "LEAD_ASSIGNED";

export type AggregateType =
  | "DEAL"
  | "UNIT"
  | "LEAD"
  | "PAYMENT"
  | "RESERVATION"
  | "OFFER"
  | "COMMISSION";

export interface DomainEventPayload {
  eventType: DomainEventType;
  aggregateId: string;
  aggregateType: AggregateType;
  data: Record<string, unknown>;
  userId?: string;
  timestamp: Date;
}

export type DomainEventHandler = (
  payload: DomainEventPayload
) => Promise<void>;

// ---------------------------------------------------------------------------
// Outbox: write event INSIDE the same Prisma transaction
// ---------------------------------------------------------------------------

/**
 * Persist a domain event in the same transaction as its business mutation.
 *
 * This is the ONLY way to guarantee at-least-once delivery without a real
 * message broker. The caller still needs to invoke `eventBus.dispatch()`
 * after commit to wake handlers immediately; if the process crashes between
 * commit and dispatch, the outbox worker will pick the event up.
 */
export async function recordEvent(
  tx: Prisma.TransactionClient,
  event: DomainEventPayload
): Promise<{ id: string }> {
  const row = await tx.domainEvent.create({
    data: {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.data as any,
      userId: event.userId ?? null,
      occurredAt: event.timestamp,
    },
    select: { id: true },
  });
  return row;
}

// ---------------------------------------------------------------------------
// In-process EventBus
// ---------------------------------------------------------------------------

class EventBus {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /**
   * Legacy emit — used by code paths that have not yet been migrated to the
   * outbox pattern. Persists the event row best-effort (NOT inside a
   * transaction); fires in-process handlers immediately.
   *
   * Prefer `recordEvent(tx, event)` + `dispatch(event)` for new code.
   */
  emit(event: DomainEventPayload): void {
    this.dispatch(event);
    this.persistEventBestEffort(event).catch((err: unknown) => {
      logger.error("[EventBus] persistEventBestEffort error", {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        err,
      });
    });
  }

  /**
   * Dispatch an event to in-process handlers without persisting.
   * Used after a transaction has committed and `recordEvent` has already
   * persisted the row.
   */
  dispatch(event: DomainEventPayload): void {
    this.emitter.emit(event.eventType, event);
  }

  /**
   * Register an async handler for a specific event type.
   * Errors thrown inside the handler are caught and logged.
   */
  on(eventType: DomainEventType, handler: DomainEventHandler): void {
    const wrapper = (...args: unknown[]): void => {
      const payload = args[0] as DomainEventPayload;
      handler(payload).catch((err: unknown) => {
        logger.error("[EventBus] handler error", {
          eventType,
          aggregateId: payload.aggregateId,
          err,
        });
      });
    };
    const h = handler as HandlerWithWrapper;
    h.__wrapper = wrapper;
    this.emitter.on(eventType, wrapper);
  }

  off(eventType: DomainEventType, handler: DomainEventHandler): void {
    const wrapper = (handler as HandlerWithWrapper).__wrapper;
    if (wrapper) {
      this.emitter.off(eventType, wrapper);
    } else {
      this.emitter.off(
        eventType,
        handler as unknown as (...args: unknown[]) => void
      );
    }
  }

  // ---------------------------------------------------------------------------

  private async persistEventBestEffort(event: DomainEventPayload): Promise<void> {
    await prisma.domainEvent.create({
      data: {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: event.data as any,
        userId: event.userId ?? null,
        occurredAt: event.timestamp,
        // No processedAt — outbox worker will eventually mark it.
      },
    });
  }
}

interface HandlerWithWrapper extends DomainEventHandler {
  __wrapper?: (...args: unknown[]) => void;
}

export const eventBus = new EventBus();
export { EventBus };

// ---------------------------------------------------------------------------
// Outbox dispatcher worker
// ---------------------------------------------------------------------------

interface OutboxRow {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: unknown;
  userId: string | null;
  occurredAt: Date;
  dispatchAttempts: number;
}

/**
 * Process pending outbox rows. Called on an interval by `startOutboxWorker`.
 *
 * Strategy:
 *  - Pick up to `batchSize` unprocessed events ordered by createdAt.
 *  - Re-dispatch them to in-process handlers (idempotent at handler level).
 *  - Mark them processed.
 *  - On error, increment dispatchAttempts; rows past `maxAttempts` are left
 *    unprocessed (manual review) — don't block other events behind them.
 */
export async function processOutboxBatch(
  batchSize = 50,
  maxAttempts = 5
): Promise<{ dispatched: number; failed: number }> {
  const rows = await prisma.domainEvent.findMany({
    where: {
      processedAt: null,
      dispatchAttempts: { lt: maxAttempts },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  if (rows.length === 0) return { dispatched: 0, failed: 0 };

  let dispatched = 0;
  let failed = 0;

  for (const row of rows as OutboxRow[]) {
    try {
      const event: DomainEventPayload = {
        eventType: row.eventType as DomainEventType,
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType as AggregateType,
        data: (row.payload ?? {}) as Record<string, unknown>,
        userId: row.userId ?? undefined,
        timestamp: row.occurredAt,
      };
      eventBus.dispatch(event);
      await prisma.domainEvent.update({
        where: { id: row.id },
        data: { processedAt: new Date() },
      });
      dispatched++;
    } catch (err) {
      failed++;
      await prisma.domainEvent.update({
        where: { id: row.id },
        data: {
          dispatchAttempts: { increment: 1 },
          lastDispatchError: err instanceof Error ? err.message : String(err),
        },
      });
      logger.error("[Outbox] dispatch failed", { eventId: row.id, err });
    }
  }

  return { dispatched, failed };
}

let outboxTimer: NodeJS.Timeout | null = null;

/**
 * Start the outbox worker. Idempotent — calling twice is a no-op.
 */
export function startOutboxWorker(intervalMs = 5_000): void {
  if (outboxTimer) return;
  logger.info(`[Outbox] starting worker (interval ${intervalMs}ms)`);
  outboxTimer = setInterval(() => {
    processOutboxBatch().catch((err: unknown) => {
      logger.error("[Outbox] worker tick error", { err });
    });
  }, intervalMs);
}

export function stopOutboxWorker(): void {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
}
