// ---------------------------------------------------------------------------
// lifecycleHandlers — listens to domain events for lead, reservation, offer,
// payment, SPA, Oqood, and creates/cancels system tasks + activity entries.
//
// Keeps each handler small. All side effects go through taskService /
// activityService so the schema stays consistent and dedupeKey prevents
// duplicate auto-tasks on event replay.
// ---------------------------------------------------------------------------

import { prisma } from "../../lib/prisma.js";
import { eventBus, type DomainEventPayload } from "../eventBus.js";
import { logSystemActivity } from "../../services/activityService.js";
import {
  cancelSystemTasksForEntity,
  upsertSystemTask,
} from "../../services/taskService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

function days(n: number): Date {
  return new Date(Date.now() + n * DAY);
}

// ---------------------------------------------------------------------------
// LEAD events
// ---------------------------------------------------------------------------

async function handleLeadAssigned(payload: DomainEventPayload): Promise<void> {
  const leadId   = payload.aggregateId;
  const newAgent = (payload.data.newAgentId ?? payload.data.assignedAgentId) as string | undefined;
  if (!newAgent) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { firstName: true, lastName: true },
  });
  if (!lead) return;

  await logSystemActivity({
    leadId,
    type: "NOTE",
    kind: "NOTE",
    summary: `Lead assigned to agent`,
  });

  // Notify the agent
  await prisma.notification.create({
    data: {
      userId:     newAgent,
      message:    `New lead assigned: ${lead.firstName} ${lead.lastName}`,
      leadId,
      type:       "NEW_LEAD_ASSIGNED",
      entityId:   leadId,
      entityType: "LEAD",
      priority:   "NORMAL",
    },
  }).catch(() => { /* non-fatal */ });
}

async function handleLeadStageChanged(payload: DomainEventPayload): Promise<void> {
  const leadId = payload.aggregateId;
  const oldStage = payload.data.oldStage as string | undefined;
  const newStage = payload.data.newStage as string | undefined;
  if (!oldStage || !newStage) return;

  await logSystemActivity({
    leadId,
    type: "STAGE_CHANGE",
    kind: "STAGE_CHANGE",
    summary: `Lead stage: ${oldStage.replace(/_/g, " ")} → ${newStage.replace(/_/g, " ")}`,
  });
}

// ---------------------------------------------------------------------------
// RESERVATION events
// ---------------------------------------------------------------------------

async function handleReservationCreated(payload: DomainEventPayload): Promise<void> {
  const reservationId = payload.aggregateId;
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      unit: { select: { unitNumber: true } },
      lead: { select: { assignedAgentId: true } },
    },
  });
  if (!reservation) return;

  await logSystemActivity({
    reservationId,
    leadId: reservation.leadId,
    unitId: reservation.unitId,
    type: "RESERVATION_CREATED",
    kind: "RESERVATION_CREATED",
    summary: `Reservation created for unit ${reservation.unit.unitNumber}`,
  });

  // Auto-task: send EOI receipt to buyer
  await upsertSystemTask({
    templateKey: "RESERVATION_SEND_EOI",
    entityId: reservationId,
    title: `Send EOI receipt — unit ${reservation.unit.unitNumber}`,
    type: "DOCUMENT",
    priority: "HIGH",
    reservationId,
    leadId: reservation.leadId,
    unitId: reservation.unitId,
    assignedToId: reservation.lead.assignedAgentId,
    dueDate: days(1),
    slaDueAt: days(1),
  });

  // Auto-task: T-2 reminder before reservation expiry
  const expiresAt = new Date(reservation.expiresAt);
  const warnAt = new Date(expiresAt.getTime() - 2 * DAY);
  if (warnAt > new Date()) {
    await upsertSystemTask({
      templateKey: "RESERVATION_EXPIRY_T2",
      entityId: reservationId,
      title: `Reservation expires in 2 days — unit ${reservation.unit.unitNumber}`,
      type: "RESERVATION_FOLLOWUP",
      priority: "URGENT",
      reservationId,
      leadId: reservation.leadId,
      unitId: reservation.unitId,
      assignedToId: reservation.lead.assignedAgentId,
      dueDate: warnAt,
      slaDueAt: expiresAt,
    });
  }
}

async function handleReservationExpired(payload: DomainEventPayload): Promise<void> {
  const reservationId = payload.aggregateId;
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { unit: { select: { unitNumber: true } } },
  });
  if (!r) return;

  await logSystemActivity({
    reservationId,
    leadId: r.leadId,
    unitId: r.unitId,
    type: "RESERVATION_CANCELLED",
    kind: "RESERVATION_CANCELLED",
    summary: `Reservation expired — unit ${r.unit.unitNumber} released`,
  });

  await cancelSystemTasksForEntity({ reservationId }, "Reservation expired");
}

async function handleReservationCancelled(payload: DomainEventPayload): Promise<void> {
  const reservationId = payload.aggregateId;
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { unit: { select: { unitNumber: true } } },
  });
  if (!r) return;

  await logSystemActivity({
    reservationId,
    leadId: r.leadId,
    unitId: r.unitId,
    type: "RESERVATION_CANCELLED",
    kind: "RESERVATION_CANCELLED",
    summary: `Reservation cancelled — unit ${r.unit.unitNumber}`,
  });

  await cancelSystemTasksForEntity({ reservationId }, "Reservation cancelled");
}

async function handleReservationConverted(payload: DomainEventPayload): Promise<void> {
  const reservationId = payload.aggregateId;
  const dealId = payload.data.dealId as string | undefined;
  await logSystemActivity({
    reservationId,
    dealId: dealId ?? null,
    type: "RESERVATION_CONVERTED",
    kind: "RESERVATION_CONVERTED",
    summary: dealId ? `Reservation converted to deal` : "Reservation converted",
  });
  await cancelSystemTasksForEntity({ reservationId }, "Reservation converted to deal");
}

// ---------------------------------------------------------------------------
// OFFER events
// ---------------------------------------------------------------------------

async function handleOfferAccepted(payload: DomainEventPayload): Promise<void> {
  const offerId = payload.aggregateId;
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      lead: { select: { id: true, assignedAgentId: true } },
      unit: { select: { unitNumber: true } },
    },
  });
  if (!offer) return;

  await logSystemActivity({
    offerId,
    leadId: offer.leadId,
    unitId: offer.unitId,
    type: "OFFER_ACCEPTED",
    kind: "OFFER_ACCEPTED",
    summary: `Offer accepted — unit ${offer.unit.unitNumber}`,
  });

  await upsertSystemTask({
    templateKey: "OFFER_ISSUE_SPA",
    entityId: offerId,
    title: `Issue SPA — unit ${offer.unit.unitNumber}`,
    type: "SPA",
    priority: "HIGH",
    offerId,
    leadId: offer.leadId,
    unitId: offer.unitId,
    assignedToId: offer.lead.assignedAgentId,
    dueDate: days(2),
  });

  await upsertSystemTask({
    templateKey: "OFFER_KYC_CHECK",
    entityId: offerId,
    title: `KYC check (Passport / Emirates ID) — buyer`,
    type: "KYC",
    priority: "HIGH",
    offerId,
    leadId: offer.leadId,
    assignedToId: offer.lead.assignedAgentId,
    dueDate: days(2),
  });
}

async function handleOfferRejected(payload: DomainEventPayload): Promise<void> {
  const offerId = payload.aggregateId;
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { leadId: true, unitId: true, unit: { select: { unitNumber: true } } },
  });
  if (!offer) return;

  await logSystemActivity({
    offerId,
    leadId: offer.leadId,
    unitId: offer.unitId,
    type: "OFFER_REJECTED",
    kind: "OFFER_REJECTED",
    summary: `Offer rejected — unit ${offer.unit.unitNumber}`,
  });
  await cancelSystemTasksForEntity({ offerId }, "Offer rejected");
}

// ---------------------------------------------------------------------------
// PAYMENT events
// ---------------------------------------------------------------------------

async function handlePaymentReceived(payload: DomainEventPayload): Promise<void> {
  const paymentId = payload.aggregateId;
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { deal: { select: { leadId: true, dealNumber: true } } },
  });
  if (!p) return;

  await logSystemActivity({
    paymentId,
    dealId: p.dealId,
    leadId: p.deal.leadId,
    type: "PAYMENT_RECEIVED",
    kind: "PAYMENT_RECEIVED",
    summary: `Payment received: AED ${p.amount.toLocaleString()} — ${p.milestoneLabel}`,
  });

  // Cancel any pending overdue/reminder tasks for this payment
  await cancelSystemTasksForEntity({ paymentId }, "Payment received");
}

async function handlePaymentOverdue(payload: DomainEventPayload): Promise<void> {
  const paymentId = payload.aggregateId;
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      deal: {
        select: {
          dealNumber: true,
          leadId: true,
          lead: { select: { assignedAgentId: true } },
        },
      },
    },
  });
  if (!p) return;

  await upsertSystemTask({
    templateKey: "PAYMENT_OVERDUE_FOLLOWUP",
    entityId: paymentId,
    title: `Overdue payment: ${p.milestoneLabel} — AED ${p.amount.toLocaleString()}`,
    type: "PAYMENT",
    priority: "URGENT",
    paymentId,
    dealId: p.dealId,
    leadId: p.deal.leadId,
    assignedToId: p.deal.lead.assignedAgentId,
    dueDate: new Date(),
  });
}

// ---------------------------------------------------------------------------
// SPA / OQOOD / COMMISSION events
// ---------------------------------------------------------------------------

async function handleSpaSigned(payload: DomainEventPayload): Promise<void> {
  const dealId = payload.aggregateId;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      dealNumber: true,
      leadId: true,
      unitId: true,
      lead: { select: { assignedAgentId: true } },
    },
  });
  if (!deal) return;

  await logSystemActivity({
    dealId,
    leadId: deal.leadId,
    type: "SPA_SIGNED",
    kind: "SPA_SIGNED",
    summary: `SPA signed for ${deal.dealNumber}`,
  });

  // DLD requires Oqood within 60 days of SPA. Auto-task: T+53 (7-day buffer).
  await upsertSystemTask({
    templateKey: "OQOOD_REGISTRATION",
    entityId: dealId,
    title: `Submit Oqood registration — ${deal.dealNumber}`,
    type: "OQOOD",
    priority: "HIGH",
    dealId,
    leadId: deal.leadId,
    unitId: deal.unitId,
    assignedToId: deal.lead.assignedAgentId,
    dueDate: days(53),
    slaDueAt: days(60),
  });
}

async function handleOqoodRegistered(payload: DomainEventPayload): Promise<void> {
  const dealId = payload.aggregateId;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { dealNumber: true, leadId: true },
  });
  if (!deal) return;

  await logSystemActivity({
    dealId,
    leadId: deal.leadId,
    type: "OQOOD_REGISTERED",
    kind: "OQOOD_REGISTERED",
    summary: `Oqood registered for ${deal.dealNumber}`,
  });

  await cancelSystemTasksForEntity({ dealId }, "Oqood registered");
}

async function handleCommissionUnlocked(payload: DomainEventPayload): Promise<void> {
  const commissionId = payload.aggregateId;
  const c = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: {
      deal: { select: { id: true, dealNumber: true, leadId: true } },
      brokerCompany: { select: { id: true, name: true } },
    },
  });
  if (!c) return;

  await logSystemActivity({
    commissionId,
    dealId: c.deal.id,
    leadId: c.deal.leadId,
    brokerCompanyId: c.brokerCompanyId,
    type: "COMMISSION_UNLOCKED",
    kind: "COMMISSION_UNLOCKED",
    summary: `Commission unlocked for ${c.deal.dealNumber}: AED ${c.amount.toLocaleString()}`,
  });

  // Find any FINANCE user to assign — best effort.
  const finance = await prisma.user.findFirst({ where: { role: "FINANCE" }, select: { id: true } });

  await upsertSystemTask({
    templateKey: "COMMISSION_REVIEW",
    entityId: commissionId,
    title: `Approve commission — ${c.deal.dealNumber} (${c.brokerCompany?.name ?? "internal"})`,
    type: "COMMISSION_REVIEW",
    priority: "HIGH",
    dealId: c.deal.id,
    leadId: c.deal.leadId,
    assignedToId: finance?.id ?? null,
    dueDate: days(3),
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerLifecycleHandlers(): void {
  eventBus.on("LEAD_ASSIGNED",         handleLeadAssigned);
  eventBus.on("LEAD_STAGE_CHANGED",    handleLeadStageChanged);

  eventBus.on("RESERVATION_CREATED",   handleReservationCreated);
  eventBus.on("RESERVATION_EXPIRED",   handleReservationExpired);
  eventBus.on("RESERVATION_CANCELLED", handleReservationCancelled);
  eventBus.on("RESERVATION_CONVERTED", handleReservationConverted);

  eventBus.on("OFFER_ACCEPTED",        handleOfferAccepted);
  eventBus.on("OFFER_REJECTED",        handleOfferRejected);

  eventBus.on("PAYMENT_RECEIVED",      handlePaymentReceived);
  eventBus.on("PAYMENT_OVERDUE",       handlePaymentOverdue);

  eventBus.on("SPA_SIGNED",            handleSpaSigned);
  eventBus.on("OQOOD_REGISTERED",      handleOqoodRegistered);
  eventBus.on("COMMISSION_UNLOCKED",   handleCommissionUnlocked);
}
