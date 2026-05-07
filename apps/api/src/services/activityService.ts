// ---------------------------------------------------------------------------
// activityService — single write path for the Activity model.
//
// Why this exists:
//   - Replaces ~15 scattered prisma.activity.create calls.
//   - Stamps system vs. human authorship consistently.
//   - Validates that at least one polymorphic FK is provided.
//   - Maps free-text `type` to the structured `kind` enum so reporting works.
//
// Read paths (lists, lookups) still go via prisma — this service owns writes only.
// ---------------------------------------------------------------------------

import { prisma } from "../lib/prisma.js";
import type {
  ActivityChannel,
  ActivityDirection,
  ActivityKind,
  ActivityOutcome,
} from "@prisma/client";

export interface LogActivityInput {
  // Polymorphic links — at least one required
  leadId?:          string | null;
  dealId?:          string | null;
  unitId?:          string | null;
  contactId?:       string | null;
  reservationId?:   string | null;
  offerId?:         string | null;
  paymentId?:       string | null;
  commissionId?:    string | null;
  brokerCompanyId?: string | null;

  // Free-text type (legacy compat) — REQUIRED. Pass "NOTE" if unsure.
  type: string;
  // New structured fields (preferred)
  kind?:        ActivityKind;
  channel?:     ActivityChannel;
  direction?:   ActivityDirection;
  outcomeCode?: ActivityOutcome;

  summary: string;
  outcome?: string | null;

  callDuration?:    number | null;
  messageId?:       string | null;
  siteVisitUnitId?: string | null;

  activityDate?: Date | string;
  followUpDate?: Date | string | null;

  // Authorship
  createdBy:    string;          // legacy field — userId or "system"
  createdById?: string | null;   // FK to User.id (preferred)
  systemGenerated?: boolean;

  relatedTaskId?: string | null;
}

const POLY_FIELDS = [
  "leadId", "dealId", "unitId", "contactId",
  "reservationId", "offerId", "paymentId",
  "commissionId", "brokerCompanyId",
] as const;

/**
 * Map a legacy free-text `type` to a structured `kind` enum.
 * Falls back to OTHER for unknown strings.
 */
function deriveKind(type: string, fallback?: ActivityKind): ActivityKind {
  const t = type.toUpperCase();
  const known: Record<string, ActivityKind> = {
    NOTE: "NOTE",
    CALL: "CALL",
    EMAIL: "EMAIL",
    WHATSAPP: "WHATSAPP",
    MEETING: "MEETING",
    SITE_VISIT: "SITE_VISIT",
    STAGE_CHANGE: "STAGE_CHANGE",
    DOC_UPLOAD: "DOC_UPLOAD",
    DOC_GENERATED: "DOC_GENERATED",
    KYC_SUBMITTED: "KYC_SUBMITTED",
    PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
    PAYMENT_REMINDER: "PAYMENT_REMINDER",
    RESERVATION_CREATED: "RESERVATION_CREATED",
    RESERVATION_CONVERTED: "RESERVATION_CONVERTED",
    RESERVATION_CANCELLED: "RESERVATION_CANCELLED",
    OFFER_SENT: "OFFER_SENT",
    OFFER_ACCEPTED: "OFFER_ACCEPTED",
    OFFER_REJECTED: "OFFER_REJECTED",
    SPA_SIGNED: "SPA_SIGNED",
    OQOOD_REGISTERED: "OQOOD_REGISTERED",
    COMMISSION_UNLOCKED: "COMMISSION_UNLOCKED",
    COMMISSION_PAID: "COMMISSION_PAID",
  };
  return known[t] ?? fallback ?? "OTHER";
}

/**
 * Channel inferred from kind when not explicitly given.
 */
function deriveChannel(kind: ActivityKind): ActivityChannel {
  switch (kind) {
    case "CALL":      return "CALL";
    case "EMAIL":     return "EMAIL";
    case "WHATSAPP":  return "WHATSAPP";
    case "MEETING":
    case "SITE_VISIT":
      return "IN_PERSON";
    case "NOTE":
      return "PORTAL";
    default:
      return "SYSTEM";
  }
}

export async function logActivity(input: LogActivityInput) {
  // 1. At least one polymorphic FK must be set
  const hasOwner = POLY_FIELDS.some((k) => input[k]);
  if (!hasOwner) {
    throw Object.assign(
      new Error("Activity requires at least one entity link (lead/deal/unit/contact/reservation/offer/payment/commission/brokerCompany)"),
      { code: "MISSING_ENTITY", statusCode: 400 },
    );
  }

  if (!input.type || !input.summary) {
    throw Object.assign(
      new Error("type and summary are required"),
      { code: "MISSING_FIELDS", statusCode: 400 },
    );
  }

  const kind      = input.kind      ?? deriveKind(input.type);
  const channel   = input.channel   ?? deriveChannel(kind);
  const direction = input.direction ?? "N_A";

  return prisma.activity.create({
    data: {
      leadId:          input.leadId          ?? null,
      dealId:          input.dealId          ?? null,
      unitId:          input.unitId          ?? null,
      contactId:       input.contactId       ?? null,
      reservationId:   input.reservationId   ?? null,
      offerId:         input.offerId         ?? null,
      paymentId:       input.paymentId       ?? null,
      commissionId:    input.commissionId    ?? null,
      brokerCompanyId: input.brokerCompanyId ?? null,

      type:    input.type,
      kind,
      channel,
      direction,
      outcomeCode: input.outcomeCode ?? null,

      summary: input.summary,
      outcome: input.outcome ?? null,

      callDuration:    input.callDuration    ?? null,
      messageId:       input.messageId       ?? null,
      siteVisitUnitId: input.siteVisitUnitId ?? null,

      activityDate: input.activityDate ? new Date(input.activityDate) : new Date(),
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,

      createdBy:       input.createdBy,
      createdById:     input.createdById ?? null,
      systemGenerated: input.systemGenerated ?? input.createdBy === "system",

      relatedTaskId: input.relatedTaskId ?? null,
    },
  });
}

/**
 * Convenience wrapper — log a system-generated activity. Used by event handlers.
 */
export function logSystemActivity(
  input: Omit<LogActivityInput, "createdBy" | "systemGenerated">,
) {
  return logActivity({ ...input, createdBy: "system", systemGenerated: true });
}
