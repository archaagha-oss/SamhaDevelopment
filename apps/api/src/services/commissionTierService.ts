/**
 * commissionTierService.ts — Tiered commission rule configuration.
 *
 * Rules define how commissions are computed for a deal based on its
 * salePrice. Each CommissionTierRule holds an ordered set of sale-price
 * brackets (CommissionTier). When resolving for a deal, the highest-priority
 * active rule matching the deal's project (or a global rule with
 * projectId=null) is picked, then the tier whose [minSalePrice, maxSalePrice]
 * band contains deal.salePrice is used to compute the total commission.
 *
 * CommissionSplit captures per-agent splits for a deal, snapshotting the
 * ruleId in effect at split-creation time for audit.
 *
 * This service is *configuration only* — it does not write to the existing
 * Commission table.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CommissionTierError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "COMMISSION_TIER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Shared types (kept loose — Zod schemas at the route layer enforce shape)
// ---------------------------------------------------------------------------

export interface TierInput {
  minSalePrice?: number | null;
  maxSalePrice?: number | null;
  ratePercent: number;
  flatBonus?: number;
  sortOrder?: number;
}

export interface CreateRuleInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  priority?: number;
  projectId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  tiers?: TierInput[];
}

export interface UpdateRuleInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  priority?: number;
  projectId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  tiers?: TierInput[];
}

export interface SplitInput {
  userId: string;
  percent: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ruleInclude() {
  return {
    tiers: {
      orderBy: [{ sortOrder: "asc" as const }],
    },
  };
}

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new CommissionTierError(`Invalid date: ${v}`, 400, "INVALID_DATE");
  }
  return d;
}

function normalizeTier(t: TierInput, idx: number) {
  return {
    minSalePrice: t.minSalePrice ?? null,
    maxSalePrice: t.maxSalePrice ?? null,
    ratePercent: t.ratePercent,
    flatBonus: t.flatBonus ?? 0,
    sortOrder: t.sortOrder ?? idx,
  };
}

// ---------------------------------------------------------------------------
// listRules
// ---------------------------------------------------------------------------

/**
 * List commission tier rules.
 *
 * When `projectId` is supplied, returns rules scoped to that project OR
 * global rules (projectId === null). When omitted, returns every rule.
 * Tiers are ordered by sortOrder ascending.
 */
export async function listRules(filter: { projectId?: string | null } = {}) {
  const where: Prisma.CommissionTierRuleWhereInput = {};

  if (filter.projectId !== undefined && filter.projectId !== null) {
    where.OR = [{ projectId: filter.projectId }, { projectId: null }];
  }

  return prisma.commissionTierRule.findMany({
    where,
    include: ruleInclude(),
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

// ---------------------------------------------------------------------------
// createRule
// ---------------------------------------------------------------------------

/**
 * Create a new tier rule, optionally with initial tiers. Wrapped in a
 * transaction so the rule and its tiers land atomically.
 */
export async function createRule(body: CreateRuleInput, _creatorId: string) {
  if (!body.name || !body.name.trim()) {
    throw new CommissionTierError("Rule name is required", 400, "NAME_REQUIRED");
  }

  const data: Prisma.CommissionTierRuleCreateInput = {
    name: body.name.trim(),
    description: body.description ?? null,
    isActive: body.isActive ?? true,
    priority: body.priority ?? 0,
    validFrom: (toDate(body.validFrom) ?? null) as Date | null,
    validUntil: (toDate(body.validUntil) ?? null) as Date | null,
  };

  if (body.projectId) {
    data.project = { connect: { id: body.projectId } };
  }

  if (body.tiers && body.tiers.length > 0) {
    data.tiers = {
      create: body.tiers.map((t, idx) => normalizeTier(t, idx)),
    };
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.commissionTierRule.create({
      data,
      include: ruleInclude(),
    });
    return created;
  });
}

// ---------------------------------------------------------------------------
// updateRule
// ---------------------------------------------------------------------------

/**
 * Patch a rule. When `tiers` is present, the existing tiers are replaced
 * wholesale (delete-then-recreate inside one transaction). Other top-level
 * fields are updated in place.
 */
export async function updateRule(id: string, body: UpdateRuleInput) {
  const existing = await prisma.commissionTierRule.findUnique({ where: { id } });
  if (!existing) {
    throw new CommissionTierError("Commission tier rule not found", 404, "RULE_NOT_FOUND");
  }

  const update: Prisma.CommissionTierRuleUpdateInput = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.description !== undefined) update.description = body.description;
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.priority !== undefined) update.priority = body.priority;
  if (body.validFrom !== undefined) update.validFrom = toDate(body.validFrom) as Date | null;
  if (body.validUntil !== undefined) update.validUntil = toDate(body.validUntil) as Date | null;
  if (body.projectId !== undefined) {
    update.project = body.projectId
      ? { connect: { id: body.projectId } }
      : { disconnect: true };
  }

  return prisma.$transaction(async (tx) => {
    if (body.tiers !== undefined) {
      // Replace-all semantics: drop the existing tiers, recreate from input.
      await tx.commissionTier.deleteMany({ where: { ruleId: id } });
      if (body.tiers.length > 0) {
        await tx.commissionTier.createMany({
          data: body.tiers.map((t, idx) => ({
            ruleId: id,
            ...normalizeTier(t, idx),
          })),
        });
      }
    }

    if (Object.keys(update).length > 0) {
      await tx.commissionTierRule.update({ where: { id }, data: update });
    }

    return tx.commissionTierRule.findUnique({
      where: { id },
      include: ruleInclude(),
    });
  });
}

// ---------------------------------------------------------------------------
// deleteRule
// ---------------------------------------------------------------------------

/**
 * Delete a rule. Tiers cascade. CommissionSplit rows that reference this
 * rule keep their percent/dealId but their ruleId is set to null (audit
 * snapshot preserved).
 */
export async function deleteRule(id: string) {
  const existing = await prisma.commissionTierRule.findUnique({ where: { id } });
  if (!existing) {
    throw new CommissionTierError("Commission tier rule not found", 404, "RULE_NOT_FOUND");
  }
  await prisma.commissionTierRule.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// resolveForDeal
// ---------------------------------------------------------------------------

/**
 * Resolve the best-matching rule + tier for a deal, then compute the
 * commission amount.
 *
 * Resolution algorithm:
 *   1. Find active rules whose (projectId == deal.projectId) OR
 *      (projectId == null), and whose validity window covers "now".
 *   2. Sort by priority desc (highest wins), then createdAt desc as a
 *      deterministic tiebreaker.
 *   3. Within the chosen rule, find the tier whose
 *      [minSalePrice, maxSalePrice] band contains deal.salePrice. Null
 *      bounds = unbounded on that side.
 *   4. Compute totalCommission = salePrice * rate/100 + flatBonus.
 *
 * Throws CommissionTierError(404) when nothing matches.
 */
export async function resolveForDeal(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { unit: { select: { projectId: true } } },
  });
  if (!deal) {
    throw new CommissionTierError("Deal not found", 404, "DEAL_NOT_FOUND");
  }

  const projectId = deal.unit?.projectId ?? null;
  const now = new Date();

  const rules = await prisma.commissionTierRule.findMany({
    where: {
      isActive: true,
      AND: [
        projectId
          ? { OR: [{ projectId }, { projectId: null }] }
          : { projectId: null },
        {
          OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        },
        {
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
      ],
    },
    include: ruleInclude(),
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  // Pick the first rule that actually has a tier matching the sale price.
  for (const rule of rules) {
    const tier = rule.tiers.find((t) => {
      const minOk = t.minSalePrice == null || deal.salePrice >= t.minSalePrice;
      const maxOk = t.maxSalePrice == null || deal.salePrice <= t.maxSalePrice;
      return minOk && maxOk;
    });
    if (tier) {
      const rate = tier.ratePercent;
      const baseAmount = deal.salePrice;
      const flatBonus = tier.flatBonus;
      const totalCommission = (baseAmount * rate) / 100 + flatBonus;
      return {
        rule,
        tier,
        computed: { rate, baseAmount, flatBonus, totalCommission },
      };
    }
  }

  throw new CommissionTierError("No matching tier", 404, "NO_MATCHING_TIER");
}

// ---------------------------------------------------------------------------
// setSplitsForDeal
// ---------------------------------------------------------------------------

/**
 * Replace the commission splits for a deal. Validates that the percentages
 * sum to exactly 100 (±0.01 floating-point tolerance). Snapshots the
 * currently-resolved ruleId on each row so the split has audit context
 * independent of any future rule changes.
 *
 * Returns the new split rows ordered by createdAt ascending.
 */
export async function setSplitsForDeal(
  dealId: string,
  splits: SplitInput[],
  _actorId: string,
) {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new CommissionTierError(
      "At least one split is required",
      400,
      "SPLITS_REQUIRED",
    );
  }

  // Validate sum to 100 ± 0.01
  const sum = splits.reduce((acc, s) => acc + (Number(s.percent) || 0), 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new CommissionTierError(
      `Split percentages must sum to 100 (got ${sum})`,
      400,
      "INVALID_SPLIT_SUM",
    );
  }

  // Detect duplicate userIds early — the @@unique constraint would catch
  // this anyway, but a clean 400 is friendlier than a constraint-violation 500.
  const seen = new Set<string>();
  for (const s of splits) {
    if (!s.userId) {
      throw new CommissionTierError("userId is required on every split", 400, "MISSING_USER_ID");
    }
    if (seen.has(s.userId)) {
      throw new CommissionTierError(
        `Duplicate userId in splits: ${s.userId}`,
        400,
        "DUPLICATE_USER_ID",
      );
    }
    seen.add(s.userId);
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) {
    throw new CommissionTierError("Deal not found", 404, "DEAL_NOT_FOUND");
  }

  // Snapshot the resolved ruleId, if any. Resolution may fail (no matching
  // tier) — that's OK; we still record the splits with ruleId=null.
  let snapshotRuleId: string | null = null;
  try {
    const resolved = await resolveForDeal(dealId);
    snapshotRuleId = resolved.rule.id;
  } catch (err) {
    if (!(err instanceof CommissionTierError)) throw err;
    // Swallow — splits can exist without a resolvable rule.
  }

  await prisma.$transaction(async (tx) => {
    await tx.commissionSplit.deleteMany({ where: { dealId } });
    if (splits.length > 0) {
      await tx.commissionSplit.createMany({
        data: splits.map((s) => ({
          dealId,
          userId: s.userId,
          percent: s.percent,
          ruleId: snapshotRuleId,
        })),
      });
    }
  });

  return prisma.commissionSplit.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  });
}
