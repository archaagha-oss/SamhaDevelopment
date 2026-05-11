/**
 * kycService.ts — KYC verification lifecycle.
 *
 * One KYC record per lead. The record is seeded in PENDING state the first
 * time it's read. As an ADMIN/MANAGER flips the four `*Verified` flags and
 * advances the status through IN_REVIEW, the service auto-approves the
 * record when all four flags are true (sets reviewedBy/reviewedAt and an
 * expiresAt one year out). Supporting documents (passport, EID, etc.) are
 * stored as `KycDocument` rows pointing at S3.
 */

import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class KycError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "KYC_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kycInclude() {
  return {
    documents: {
      orderBy: [
        { type: "asc" as const },
        { uploadedAt: "desc" as const },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// getOrCreateKyc
// ---------------------------------------------------------------------------

/**
 * Returns the KYC record for a lead, creating a PENDING one the first time
 * it's accessed. Idempotent: subsequent calls return the same row.
 */
export async function getOrCreateKyc(leadId: string) {
  const existing = await prisma.leadKyc.findUnique({
    where:   { leadId },
    include: kycInclude(),
  });
  if (existing) return existing;

  // Confirm the lead exists before seeding (FK would catch this anyway, but
  // a clean error message beats a 500).
  const lead = await prisma.lead.findUnique({
    where:  { id: leadId },
    select: { id: true },
  });
  if (!lead) {
    throw new KycError("Lead not found", 404, "LEAD_NOT_FOUND");
  }

  return prisma.leadKyc.create({
    data:    { leadId },
    include: kycInclude(),
  });
}

// ---------------------------------------------------------------------------
// updateKyc
// ---------------------------------------------------------------------------

/**
 * Update the four `*Verified` flags, status, and/or notes. When all four
 * flags become true and the status is IN_REVIEW, automatically promote the
 * record to APPROVED, set reviewedBy/reviewedAt, and stamp expiresAt one
 * year from now (KYC docs typically need annual re-verification).
 */
export async function updateKyc(
  kycId: string,
  patch: {
    status?:                "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
    emiratesIdVerified?:    boolean;
    passportVerified?:      boolean;
    addressProofVerified?:  boolean;
    sourceOfFundsVerified?: boolean;
    notes?:                 string | null;
  },
  userId: string,
) {
  const existing = await prisma.leadKyc.findUnique({ where: { id: kycId } });
  if (!existing) {
    throw new KycError("KYC record not found", 404, "KYC_NOT_FOUND");
  }

  const data: {
    status?:                string;
    emiratesIdVerified?:    boolean;
    passportVerified?:      boolean;
    addressProofVerified?:  boolean;
    sourceOfFundsVerified?: boolean;
    notes?:                 string | null;
    reviewedBy?:            string | null;
    reviewedAt?:            Date | null;
    expiresAt?:             Date | null;
  } = {};

  if (patch.status !== undefined) data.status = patch.status;
  if (patch.emiratesIdVerified !== undefined) data.emiratesIdVerified = patch.emiratesIdVerified;
  if (patch.passportVerified !== undefined) data.passportVerified = patch.passportVerified;
  if (patch.addressProofVerified !== undefined) data.addressProofVerified = patch.addressProofVerified;
  if (patch.sourceOfFundsVerified !== undefined) data.sourceOfFundsVerified = patch.sourceOfFundsVerified;
  if (patch.notes !== undefined) data.notes = patch.notes;

  // Determine effective flag values + status after this patch.
  const effective = {
    emiratesIdVerified:    patch.emiratesIdVerified    ?? existing.emiratesIdVerified,
    passportVerified:      patch.passportVerified      ?? existing.passportVerified,
    addressProofVerified:  patch.addressProofVerified  ?? existing.addressProofVerified,
    sourceOfFundsVerified: patch.sourceOfFundsVerified ?? existing.sourceOfFundsVerified,
    status:                patch.status                ?? existing.status,
  };

  const allVerified =
    effective.emiratesIdVerified &&
    effective.passportVerified &&
    effective.addressProofVerified &&
    effective.sourceOfFundsVerified;

  // Auto-approve when all four flags are true AND status is currently
  // IN_REVIEW (either set in this patch or already on the record). We don't
  // auto-approve from PENDING — a reviewer must explicitly bump it to
  // IN_REVIEW first.
  if (allVerified && effective.status === "IN_REVIEW") {
    data.status     = "APPROVED";
    data.reviewedBy = userId;
    data.reviewedAt = new Date();
    data.expiresAt  = new Date(Date.now() + ONE_YEAR_MS);
  }

  // Explicit transitions to APPROVED also stamp review metadata if missing.
  if (patch.status === "APPROVED" && !existing.reviewedAt) {
    data.reviewedBy = data.reviewedBy ?? userId;
    data.reviewedAt = data.reviewedAt ?? new Date();
    data.expiresAt  = data.expiresAt  ?? new Date(Date.now() + ONE_YEAR_MS);
  }

  return prisma.leadKyc.update({
    where:   { id: kycId },
    data,
    include: kycInclude(),
  });
}

// ---------------------------------------------------------------------------
// addDocument
// ---------------------------------------------------------------------------

/**
 * Attach a supporting document (already uploaded to S3) to a KYC record.
 * Returns the new KycDocument row.
 */
export async function addDocument(
  kycId: string,
  input: {
    type:             string;
    s3Key:            string;
    originalFilename?: string | null;
    expiryDate?:       string | null;
  },
  userId: string,
) {
  const kyc = await prisma.leadKyc.findUnique({
    where:  { id: kycId },
    select: { id: true },
  });
  if (!kyc) {
    throw new KycError("KYC record not found", 404, "KYC_NOT_FOUND");
  }

  return prisma.kycDocument.create({
    data: {
      kycId,
      type:             input.type,
      s3Key:            input.s3Key,
      originalFilename: input.originalFilename ?? null,
      uploadedBy:       userId,
      expiryDate:       input.expiryDate ? new Date(input.expiryDate) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// removeDocument
// ---------------------------------------------------------------------------

/**
 * Hard-delete a KycDocument row. The S3 object itself is left in place —
 * lifecycle / cleanup of orphaned S3 keys is a separate concern handled by
 * the storage layer's retention policy.
 */
export async function removeDocument(documentId: string, _userId: string) {
  const doc = await prisma.kycDocument.findUnique({
    where:  { id: documentId },
    select: { id: true },
  });
  if (!doc) {
    throw new KycError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  await prisma.kycDocument.delete({ where: { id: documentId } });
  return { ok: true };
}
