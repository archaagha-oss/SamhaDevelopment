/**
 * Stage Advancement Rules
 *
 * Defines the conditions for automatic deal stage advancement
 * based on payment milestones collected.
 *
 * Each rule specifies: "When X% of total deal value is paid, advance from stage A to stage B"
 */

import { DealStage } from "@prisma/client";

export interface StageAdvancementRule {
  fromStage: DealStage;
  toStage: DealStage;
  paymentThreshold: number; // percentage (0-100)
  description: string;
}

/**
 * Default stage advancement rules based on standard real estate payment milestones
 * These can be overridden per project in the future
 */
export const DEFAULT_STAGE_ADVANCEMENT_RULES: StageAdvancementRule[] = [
  {
    fromStage: "RESERVATION_PENDING",
    toStage: "RESERVATION_CONFIRMED",
    paymentThreshold: 5,
    description: "5% booking deposit received",
  },
  {
    fromStage: "RESERVATION_CONFIRMED",
    toStage: "SPA_PENDING",
    paymentThreshold: 20,
    description: "20% total paid (5% deposit + 15% booking payment)",
  },
  {
    fromStage: "SPA_PENDING",
    toStage: "SPA_SENT",
    paymentThreshold: 25,
    description: "SPA documents prepared and ready to send",
  },
  {
    fromStage: "SPA_SENT",
    toStage: "SPA_SIGNED",
    paymentThreshold: 25,
    description: "SPA signed by buyer (manual stage change)",
  },
  {
    fromStage: "SPA_SIGNED",
    toStage: "OQOOD_PENDING",
    paymentThreshold: 25,
    description: "Awaiting Oqood registration",
  },
  {
    fromStage: "OQOOD_PENDING",
    toStage: "OQOOD_REGISTERED",
    paymentThreshold: 25,
    description: "Oqood certificate received",
  },
  {
    fromStage: "OQOOD_REGISTERED",
    toStage: "INSTALLMENTS_ACTIVE",
    paymentThreshold: 25,
    description: "Construction installment payments ongoing",
  },
  {
    fromStage: "INSTALLMENTS_ACTIVE",
    toStage: "HANDOVER_PENDING",
    paymentThreshold: 95,
    description: "95% paid, unit ready for handover",
  },
  {
    fromStage: "HANDOVER_PENDING",
    toStage: "COMPLETED",
    paymentThreshold: 100,
    description: "100% paid, handover completed",
  },
];

/**
 * Get the next stage advancement rule for a given current stage
 * @param currentStage The current deal stage
 * @returns The rule for advancing from this stage, or undefined if no rule exists
 */
export function getStageAdvancementRule(currentStage: DealStage): StageAdvancementRule | undefined {
  return DEFAULT_STAGE_ADVANCEMENT_RULES.find((rule) => rule.fromStage === currentStage);
}

/**
 * Check if a payment percentage meets the threshold for stage advancement
 * @param currentStage The current deal stage
 * @param paidPercentage The percentage of total deal value that has been paid (0-100)
 * @returns The next stage if threshold is met, undefined otherwise
 */
export function checkStageAdvancement(currentStage: DealStage, paidPercentage: number): DealStage | undefined {
  const rule = getStageAdvancementRule(currentStage);
  if (!rule) return undefined;

  if (paidPercentage >= rule.paymentThreshold) {
    return rule.toStage;
  }

  return undefined;
}
