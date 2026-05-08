import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnitForPricing {
  id: string;
  projectId: string;
  floor: number;
  type: string;
  view: string;
  basePrice: number;
}

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  adjustment: number;
  reason: string;
}

export interface PriceComputation {
  basePrice: number;
  finalPrice: number;
  totalAdjustment: number;
  appliedRules: AppliedRule[];
}

/**
 * The shape of the conditions JSON stored in PricingRule.
 * All fields are optional; an empty object matches every unit.
 */
interface RuleConditions {
  floor_gte?: number;
  floor_lte?: number;
  floor_range?: [number, number];
  view?: string;
  type?: string;
  unitId?: string;
}

/**
 * Minimal PricingRule shape needed by this service.
 * This mirrors the Prisma-generated type; the service is typed against this
 * interface so it compiles even before the Phase 5 migration is applied.
 */
export interface PricingRule {
  id: string;
  projectId: string;
  name: string;
  scope: string;
  conditions: unknown; // stored as JSON in Prisma
  adjustmentType:
    | "PERCENTAGE_INCREASE"
    | "PERCENTAGE_DECREASE"
    | "FIXED_INCREASE"
    | "FIXED_DECREASE";
  adjustmentValue: number;
  priority: number;
  isActive: boolean;
  validFrom?: Date | null;
  validUntil?: Date | null;
}

// ---------------------------------------------------------------------------
// Pure / side-effect-free functions
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a single PricingRule condition set matches a given unit.
 * Empty conditions (or no conditions object) always match.
 */
export function evaluateRuleCondition(
  unit: UnitForPricing,
  rule: PricingRule
): boolean {
  // Safely parse the conditions JSON
  let conditions: RuleConditions;
  try {
    conditions =
      typeof rule.conditions === "string"
        ? (JSON.parse(rule.conditions) as RuleConditions)
        : (rule.conditions as RuleConditions) ?? {};
  } catch {
    // Malformed JSON → treat as no conditions (matches all)
    conditions = {};
  }

  // floor_range: [min, max] inclusive — takes precedence over floor_gte / floor_lte
  if (conditions.floor_range !== undefined) {
    const [min, max] = conditions.floor_range;
    if (unit.floor < min || unit.floor > max) return false;
  } else {
    if (
      conditions.floor_gte !== undefined &&
      unit.floor < conditions.floor_gte
    ) {
      return false;
    }
    if (
      conditions.floor_lte !== undefined &&
      unit.floor > conditions.floor_lte
    ) {
      return false;
    }
  }

  if (conditions.view !== undefined && unit.view !== conditions.view) {
    return false;
  }
  if (conditions.type !== undefined && unit.type !== conditions.type) {
    return false;
  }
  if (conditions.unitId !== undefined && unit.id !== conditions.unitId) {
    return false;
  }

  return true;
}

/**
 * Compute the final price for a unit by applying a sorted list of pricing rules.
 * Rules are applied cumulatively; each rule adjusts the running price, not the base.
 */
export function computeUnitPrice(
  unit: UnitForPricing,
  rules: PricingRule[]
): PriceComputation {
  // Sort descending by priority (highest priority applied first)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  let runningPrice = unit.basePrice;
  const appliedRules: AppliedRule[] = [];

  for (const rule of sorted) {
    if (!evaluateRuleCondition(unit, rule)) continue;

    const before = runningPrice;
    let adjustment = 0;

    switch (rule.adjustmentType) {
      case "PERCENTAGE_INCREASE":
        adjustment = runningPrice * (rule.adjustmentValue / 100);
        runningPrice = runningPrice + adjustment;
        break;
      case "PERCENTAGE_DECREASE":
        adjustment = -(runningPrice * (rule.adjustmentValue / 100));
        runningPrice = runningPrice + adjustment;
        break;
      case "FIXED_INCREASE":
        adjustment = rule.adjustmentValue;
        runningPrice = runningPrice + adjustment;
        break;
      case "FIXED_DECREASE":
        adjustment = -rule.adjustmentValue;
        runningPrice = runningPrice + adjustment;
        break;
    }

    appliedRules.push({
      ruleId: rule.id,
      ruleName: rule.name,
      adjustment,
      reason: `${rule.adjustmentType} of ${rule.adjustmentValue} (${before.toFixed(2)} → ${runningPrice.toFixed(2)})`,
    });
  }

  // Guard against negative prices
  const finalPrice = Math.max(0, runningPrice);

  return {
    basePrice: unit.basePrice,
    finalPrice,
    totalAdjustment: finalPrice - unit.basePrice,
    appliedRules,
  };
}

// ---------------------------------------------------------------------------
// Database-backed functions
// ---------------------------------------------------------------------------

/**
 * Fetch all active, non-expired pricing rules for a project, sorted by priority descending.
 */
export async function getActiveRulesForProject(
  projectId: string
): Promise<PricingRule[]> {
  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  if (typeof p.pricingRule?.findMany !== "function") {
    // PricingRule table does not exist yet (pre-migration)
    return [];
  }

  const rules: PricingRule[] = await p.pricingRule.findMany({
    where: {
      projectId,
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    orderBy: { priority: "desc" },
  });

  return rules;
}

/**
 * Compute and persist the updated price for a single unit.
 * Creates a UnitPriceHistory record if the price changes.
 */
export async function applyPricingToUnit(
  unitId: string,
  changedBy: string
): Promise<PriceComputation> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { project: true },
  });

  if (!unit) {
    throw new Error(`Unit not found: ${unitId}`);
  }

  // Use basePrice if present, fall back to current price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const basePrice: number = (unit as any).basePrice ?? unit.price;

  const unitForPricing: UnitForPricing = {
    id: unit.id,
    projectId: unit.projectId,
    floor: unit.floor,
    type: unit.type as string,
    view: unit.view as string,
    basePrice,
  };

  const rules = await getActiveRulesForProject(unit.projectId);
  const computation = computeUnitPrice(unitForPricing, rules);

  if (computation.finalPrice !== unit.price) {
    await prisma.$transaction(async (tx) => {
      await tx.unit.update({
        where: { id: unitId },
        data: { price: computation.finalPrice, updatedAt: new Date() },
      });

      // Create history record if model exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txAny = tx as any;
      if (typeof txAny.unitPriceHistory?.create === "function") {
        await txAny.unitPriceHistory.create({
          data: {
            unitId,
            oldPrice: unit.price,
            newPrice: computation.finalPrice,
            changedBy,
            reason: `Pricing rules applied: ${computation.appliedRules.map((r) => r.ruleName).join(", ") || "no matching rules"}`,
          },
        });
      }
    });
  }

  return computation;
}

/**
 * Apply active pricing rules to all AVAILABLE units in a project.
 * Returns the number of units updated and each unit's computation result.
 */
export async function applyPricingToProject(
  projectId: string,
  changedBy: string
): Promise<{ updated: number; results: PriceComputation[] }> {
  const units = await prisma.unit.findMany({
    where: { projectId, status: "AVAILABLE" },
  });

  if (units.length === 0) {
    return { updated: 0, results: [] };
  }

  const rules = await getActiveRulesForProject(projectId);
  const results: PriceComputation[] = [];
  let updated = 0;

  for (const unit of units) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePrice: number = (unit as any).basePrice ?? unit.price;

    const unitForPricing: UnitForPricing = {
      id: unit.id,
      projectId: unit.projectId,
      floor: unit.floor,
      type: unit.type as string,
      view: unit.view as string,
      basePrice,
    };

    const computation = computeUnitPrice(unitForPricing, rules);
    results.push(computation);

    if (computation.finalPrice !== unit.price) {
      await prisma.$transaction(async (tx) => {
        await tx.unit.update({
          where: { id: unit.id },
          data: { price: computation.finalPrice, updatedAt: new Date() },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txAny = tx as any;
        if (typeof txAny.unitPriceHistory?.create === "function") {
          await txAny.unitPriceHistory.create({
            data: {
              unitId: unit.id,
              oldPrice: unit.price,
              newPrice: computation.finalPrice,
              changedBy,
              reason: `Batch project pricing run for project ${projectId}`,
            },
          });
        }
      });

      updated++;
    }
  }

  return { updated, results };
}
