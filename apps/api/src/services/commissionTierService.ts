import { prisma } from "../lib/prisma";

/**
 * Resolve the matching CommissionTier (rate + flat bonus) for a deal value
 * within a given project / tiered rule.
 *
 * Resolution order:
 *   1. Project-scoped active rules (lowest `priority` wins).
 *   2. Global active rules (projectId null).
 *
 * If no rule matches the deal's salePrice we return null and the caller
 * should fall back to BrokerCompany.commissionRate / Deal.commissionRateOverride.
 */
export interface ResolvedCommission {
  ratePercent: number;
  flatBonus: number;
  ruleId: string;
  ruleName: string;
  tierId: string;
  tierLabel: string;
}

export async function resolveCommissionForDeal(dealId: string): Promise<ResolvedCommission | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { unit: { select: { projectId: true } }, brokerCompany: true },
  });
  if (!deal) throw new Error(`Deal not found: ${dealId}`);

  const now = new Date();

  const rules = await prisma.tieredCommissionRule.findMany({
    where: {
      isActive: true,
      OR: [
        { projectId: deal.unit.projectId },
        { projectId: null },
      ],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ projectId: "desc" }, { priority: "asc" }], // project-scoped first
  });

  const value = deal.salePrice;

  for (const rule of rules) {
    for (const tier of rule.tiers) {
      const lower = tier.minSalePrice ?? 0;
      const upper = tier.maxSalePrice ?? Number.POSITIVE_INFINITY;
      if (value >= lower && value < upper) {
        return {
          ratePercent: tier.ratePercent,
          flatBonus: tier.flatBonus,
          ruleId: rule.id,
          ruleName: rule.name,
          tierId: tier.id,
          tierLabel: `${lower.toLocaleString()} – ${upper === Number.POSITIVE_INFINITY ? "∞" : upper.toLocaleString()}`,
        };
      }
    }
  }
  return null;
}

/**
 * Build (or replace) the CommissionSplit rows for a deal.  The percentages
 * across COMPANY / AGENT / SUB_AGENT / REFERRER must sum to 100.
 */
export interface SplitInput {
  party: "COMPANY" | "AGENT" | "SUB_AGENT" | "REFERRER";
  partyName?: string | null;
  partyId?: string | null;
  percentage: number;
}

export async function setCommissionSplits(dealId: string, splits: SplitInput[]) {
  const sum = splits.reduce((a, s) => a + s.percentage, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Commission splits must sum to 100. Got ${sum.toFixed(2)}`);
  }
  return prisma.$transaction(async (tx) => {
    await tx.commissionSplit.deleteMany({ where: { dealId } });
    await tx.commissionSplit.createMany({
      data: splits.map((s) => ({
        dealId,
        party: s.party,
        partyName: s.partyName ?? null,
        partyId: s.partyId ?? null,
        percentage: s.percentage,
      })),
    });
    return tx.commissionSplit.findMany({ where: { dealId } });
  });
}

export async function distributeCommissionAmount(dealId: string, totalAmount: number) {
  const splits = await prisma.commissionSplit.findMany({ where: { dealId } });
  if (splits.length === 0) return [];
  return prisma.$transaction(
    splits.map((s) =>
      prisma.commissionSplit.update({
        where: { id: s.id },
        data: { amount: +(totalAmount * (s.percentage / 100)).toFixed(2) },
      }),
    ),
  );
}
