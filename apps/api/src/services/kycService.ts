import type { KYCStatus, RiskRating } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

export interface KYCInput {
  status?: KYCStatus;
  riskRating?: RiskRating;
  idType?: string | null;
  idNumber?: string | null;
  idIssueDate?: Date | string | null;
  idExpiryDate?: Date | string | null;
  idIssuingCountry?: string | null;
  nationality?: string | null;
  residencyStatus?: string | null;
  visaNumber?: string | null;
  visaExpiryDate?: Date | string | null;
  occupation?: string | null;
  employer?: string | null;
  pepFlag?: boolean;
  pepNotes?: string | null;
  sourceOfFunds?: string | null;
  sourceOfFundsDocKey?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes?: string | null;
}

function parseDate(d: Date | string | null | undefined): Date | null | undefined {
  if (d === undefined) return undefined;
  if (d === null) return null;
  return d instanceof Date ? d : new Date(d);
}

function computeExpiresAt(input: KYCInput): Date | null {
  const candidates: Date[] = [];
  const id = parseDate(input.idExpiryDate);
  const visa = parseDate(input.visaExpiryDate);
  if (id instanceof Date && !isNaN(id.getTime())) candidates.push(id);
  if (visa instanceof Date && !isNaN(visa.getTime())) candidates.push(visa);
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

export async function createKYC(leadId: string, input: KYCInput, createdBy: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const record = await prisma.kYCRecord.create({
    data: {
      leadId,
      status: input.status ?? "PENDING",
      riskRating: input.riskRating ?? "LOW",
      idType: input.idType ?? null,
      idNumber: input.idNumber ?? null,
      idIssueDate: parseDate(input.idIssueDate) as Date | null,
      idExpiryDate: parseDate(input.idExpiryDate) as Date | null,
      idIssuingCountry: input.idIssuingCountry ?? null,
      nationality: input.nationality ?? null,
      residencyStatus: input.residencyStatus ?? null,
      visaNumber: input.visaNumber ?? null,
      visaExpiryDate: parseDate(input.visaExpiryDate) as Date | null,
      occupation: input.occupation ?? null,
      employer: input.employer ?? null,
      pepFlag: input.pepFlag ?? false,
      pepNotes: input.pepNotes ?? null,
      sourceOfFunds: input.sourceOfFunds ?? null,
      sourceOfFundsDocKey: input.sourceOfFundsDocKey ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      postalCode: input.postalCode ?? null,
      expiresAt: computeExpiresAt(input),
      reviewedAt: input.status === "APPROVED" ? new Date() : null,
      reviewedBy: input.status === "APPROVED" ? createdBy : null,
      notes: input.notes ?? null,
    },
  });
  return record;
}

export async function updateKYC(
  recordId: string,
  input: KYCInput,
  changedBy: string,
) {
  const existing = await prisma.kYCRecord.findUnique({ where: { id: recordId } });
  if (!existing) throw new Error(`KYC record not found: ${recordId}`);

  const merged: KYCInput = {
    idExpiryDate: input.idExpiryDate ?? existing.idExpiryDate,
    visaExpiryDate: input.visaExpiryDate ?? existing.visaExpiryDate,
  };

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (
      key === "idIssueDate" ||
      key === "idExpiryDate" ||
      key === "visaExpiryDate"
    ) {
      update[key] = parseDate(value as Date | string | null);
    } else {
      update[key] = value;
    }
  }
  update.expiresAt = computeExpiresAt(merged);

  // Auto-approve metadata
  if (input.status === "APPROVED" && existing.status !== "APPROVED") {
    update.reviewedAt = new Date();
    update.reviewedBy = changedBy;
  }

  return prisma.kYCRecord.update({ where: { id: recordId }, data: update });
}

export async function getKYCByLead(leadId: string) {
  return prisma.kYCRecord.findMany({
    where: { leadId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getKYC(recordId: string) {
  return prisma.kYCRecord.findUnique({ where: { id: recordId } });
}

export async function deleteKYC(recordId: string) {
  return prisma.kYCRecord.delete({ where: { id: recordId } });
}

/**
 * Background-job hook: scan for KYC records whose IDs / visas are about to expire.
 * Emits one KYC_EXPIRING event per record (de-duplicated via expiryAlertedAt).
 *
 * @param windowDays  alert when expiresAt is within `windowDays` days
 * @returns number of alerts emitted
 */
export async function checkExpiringKYC(windowDays = 30): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const expiring = await prisma.kYCRecord.findMany({
    where: {
      expiresAt: { not: null, lte: horizon },
      status: { not: "EXPIRED" },
      OR: [{ expiryAlertedAt: null }, { expiryAlertedAt: { lt: now } }],
    },
    take: 500,
  });

  for (const r of expiring) {
    if (!r.expiresAt) continue;
    eventBus.emit({
      eventType: "KYC_EXPIRING" as any,
      aggregateId: r.id,
      aggregateType: "LEAD",
      data: { kycId: r.id, leadId: r.leadId, expiresAt: r.expiresAt },
      timestamp: now,
    });
    await prisma.kYCRecord.update({
      where: { id: r.id },
      data: {
        expiryAlertedAt: now,
        status: r.expiresAt <= now ? "EXPIRED" : r.status,
      },
    });
  }
  return expiring.length;
}
