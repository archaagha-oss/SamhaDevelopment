import type { PartyRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface PartyInput {
  leadId: string;
  role?: PartyRole;
  ownershipPercentage: number;
}

const TOLERANCE = 0.01; // accept tiny floating-point drift

/**
 * Replace all parties on a deal in a single transaction.
 *
 * Invariants enforced:
 *   - At least one party.
 *   - Sum of ownershipPercentage is exactly 100 (within TOLERANCE).
 *   - Exactly one party has role = PRIMARY.
 *
 * Use this for both initial creation and edits — it is idempotent.
 */
export async function setDealParties(dealId: string, parties: PartyInput[]) {
  if (!parties || parties.length === 0) {
    throw new Error("At least one party is required.");
  }

  const sum = parties.reduce((acc, p) => acc + p.ownershipPercentage, 0);
  if (Math.abs(sum - 100) > TOLERANCE) {
    throw new Error(
      `Ownership percentages must sum to 100. Got ${sum.toFixed(2)}.`,
    );
  }

  const primaries = parties.filter((p) => (p.role ?? "PRIMARY") === "PRIMARY");
  if (primaries.length !== 1) {
    throw new Error(
      `Exactly one party must have role = PRIMARY. Got ${primaries.length}.`,
    );
  }

  // Validate every leadId exists
  const leadIds = parties.map((p) => p.leadId);
  const found = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((l) => l.id));
  const missing = leadIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Lead(s) not found: ${missing.join(", ")}`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.dealParty.deleteMany({ where: { dealId } });
    await tx.dealParty.createMany({
      data: parties.map((p) => ({
        dealId,
        leadId: p.leadId,
        role: p.role ?? "PRIMARY",
        ownershipPercentage: p.ownershipPercentage,
      })),
    });
    return tx.dealParty.findMany({
      where: { dealId },
      include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
  });
}

export async function getDealParties(dealId: string) {
  return prisma.dealParty.findMany({
    where: { dealId },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          nationality: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Convenience: ensure that a deal has at least its primary party defined,
 * derived from Deal.leadId if no party rows exist.  Idempotent.
 */
export async function ensurePrimaryPartyFromDeal(dealId: string) {
  const existing = await prisma.dealParty.count({ where: { dealId } });
  if (existing > 0) return;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { leadId: true },
  });
  if (!deal) return;
  await prisma.dealParty.create({
    data: {
      dealId,
      leadId: deal.leadId,
      role: "PRIMARY",
      ownershipPercentage: 100,
    },
  });
}
