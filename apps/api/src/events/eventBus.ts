import { EventEmitter } from "node:events";
import { prisma } from "../lib/prisma.js";

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

// ---------------------------------------------------------------------------
// Handler type alias
// ---------------------------------------------------------------------------

export type DomainEventHandler = (
  payload: DomainEventPayload
) => Promise<void>;

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

class EventBus {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Increase limit to support multiple handlers per event type
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a domain event.
   *
   * Side effects:
   *  1. Dispatches the event to all registered handlers (errors are caught per-handler).
   *  2. Persists the event to the DomainEvent table — fire-and-forget.
   */
  emit(event: DomainEventPayload): void {
    // Dispatch to handlers
    this.emitter.emit(event.eventType, event);

    // Persist asynchronously — never block the caller
    this.persistEvent(event).catch((err: unknown) => {
      console.error(
        `[EventBus] Failed to persist event ${event.eventType}:`,
        err
      );
    });
  }

  /**
   * Register an async handler for a specific event type.
   * Errors thrown inside the handler are caught and logged.
   */
  on(eventType: DomainEventType, handler: DomainEventHandler): void {
    const wrapper = (payload: DomainEventPayload): void => {
      handler(payload).catch((err: unknown) => {
        console.error(
          `[EventBus] Handler error for ${eventType} (aggregate: ${payload.aggregateId}):`,
          err
        );
      });
    };

    // Store the wrapper on the original handler so `off` can remove the right listener
    const h = handler as any;
    h.__wrapper = wrapper;

    this.emitter.on(eventType, wrapper);
  }

  /**
   * Deregister a previously registered handler.
   */
  off(eventType: DomainEventType, handler: DomainEventHandler): void {
    const wrapper = (handler as HandlerWithWrapper).__wrapper;

    if (wrapper) {
      this.emitter.off(eventType, wrapper);
    } else {
      // If the handler was never wrapped (e.g. registered differently), try directly
      this.emitter.off(eventType, handler as unknown as (...args: unknown[]) => void);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async persistEvent(event: DomainEventPayload): Promise<void> {
    try {
      // DomainEvent model must exist in the Prisma schema.
      // If it doesn't yet (schema migration pending), this is a no-op.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = prisma as any;
      if (typeof p.domainEvent?.create === "function") {
        await p.domainEvent.create({
          data: {
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            data: JSON.stringify(event.data),
            userId: event.userId ?? null,
            occurredAt: event.timestamp,
          },
        });
      }
    } catch (err) {
      // Persistence failure must never break business logic
      console.error("[EventBus] persistEvent error:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal type helper for wrapper storage
// ---------------------------------------------------------------------------

interface HandlerWithWrapper extends DomainEventHandler {
  __wrapper?: (...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const eventBus = new EventBus();
export { EventBus };
