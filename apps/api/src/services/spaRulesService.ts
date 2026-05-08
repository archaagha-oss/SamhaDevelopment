import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// SPA business-rule calculator
//
// Pure read-only calculations for the four SPA rules:
//
//   1. Late fee on overdue instalments (Clause 3 / Particulars VIII):
//        2% per month of overdue amount, daily accrual, monthly compounding.
//
//   2. Disposal threshold (Clause 11):
//        Purchaser may not resell, transfer, or assign until 30% of the
//        Purchase Price has been paid.
//
//   3. Delay compensation (Clause 14):
//        If the seller delays handover beyond Anticipated Completion Date +
//        12-month grace period, buyer earns 1% per year of paid amount,
//        capped at 5% of the total Purchase Price.
//
//   4. Liquidated damages on purchaser default (Clause 10):
//        On termination after a 30-day cure period, seller may retain up to
//        40% of the Purchase Price as pre-agreed liquidated damages.
//
// The SAMHA SPA caps and rates above are defaults; ProjectConfig overrides
// them per project.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Defaults used when no ProjectConfig override is present (e.g. brand-new
// projects). Keep in sync with prisma/schema.prisma ProjectConfig defaults.
const DEFAULT_RULES = {
  lateFeeMonthlyPercent: 2,
  delayCompensationAnnualPercent: 1,
  delayCompensationCapPercent: 5,
  liquidatedDamagesPercent: 40,
  disposalThresholdPercent: 30,
  resaleProcessingFee: 3000,
  gracePeriodMonths: 12,
};

interface ConfigRules {
  lateFeeMonthlyPercent: number;
  delayCompensationAnnualPercent: number;
  delayCompensationCapPercent: number;
  liquidatedDamagesPercent: number;
  disposalThresholdPercent: number;
  resaleProcessingFee: number;
  gracePeriodMonths: number;
}

function loadRules(config: any): ConfigRules {
  return {
    lateFeeMonthlyPercent: config?.lateFeeMonthlyPercent ?? DEFAULT_RULES.lateFeeMonthlyPercent,
    delayCompensationAnnualPercent:
      config?.delayCompensationAnnualPercent ?? DEFAULT_RULES.delayCompensationAnnualPercent,
    delayCompensationCapPercent:
      config?.delayCompensationCapPercent ?? DEFAULT_RULES.delayCompensationCapPercent,
    liquidatedDamagesPercent: config?.liquidatedDamagesPercent ?? DEFAULT_RULES.liquidatedDamagesPercent,
    disposalThresholdPercent: config?.disposalThresholdPercent ?? DEFAULT_RULES.disposalThresholdPercent,
    resaleProcessingFee: config?.resaleProcessingFee ?? DEFAULT_RULES.resaleProcessingFee,
    gracePeriodMonths: config?.gracePeriodMonths ?? DEFAULT_RULES.gracePeriodMonths,
  };
}

// Late fee for a single payment, daily accrual + monthly compounding:
//   accrued = amount * ((1 + r)^months - 1) where r = monthlyPercent/100
//             and months = daysOverdue / 30
// Compounds smoothly across days within a month.
function lateFeeForPayment(opts: {
  amount: number;
  dueDate: Date;
  asOf: Date;
  monthlyPercent: number;
}): { daysOverdue: number; accruedFee: number } {
  const { amount, dueDate, asOf, monthlyPercent } = opts;
  const ms = asOf.getTime() - dueDate.getTime();
  if (ms <= 0 || amount <= 0) return { daysOverdue: 0, accruedFee: 0 };
  const daysOverdue = Math.floor(ms / MS_PER_DAY);
  const months = daysOverdue / 30;
  const r = monthlyPercent / 100;
  const factor = Math.pow(1 + r, months) - 1;
  return {
    daysOverdue,
    accruedFee: Math.round(amount * factor * 100) / 100,
  };
}

export interface DealSpaRules {
  dealId: string;
  asOf: string;
  rules: ConfigRules;
  purchasePrice: number;
  paidAmount: number;
  paidPercentage: number;

  lateFees: {
    totalAccrued: number;
    overdueCount: number;
    perPayment: Array<{
      paymentId: string;
      label: string;
      amount: number;
      dueDate: string;
      daysOverdue: number;
      accruedFee: number;
    }>;
  };

  disposal: {
    allowed: boolean;
    paidPercent: number;
    thresholdPercent: number;
    shortfallAmount: number;
    processingFee: number;
  };

  delayCompensation: {
    eligible: boolean;
    anticipatedCompletionDate: string;
    graceEndDate: string;
    monthsDelayedAfterGrace: number;
    annualPercent: number;
    capPercent: number;
    rawAmount: number;
    cappedAmount: number;
    capApplied: boolean;
  };

  liquidatedDamages: {
    percentage: number;
    amount: number;
    note: string;
  };
}

export async function calculateDealSpaRules(
  dealId: string,
  asOf: Date = new Date(),
): Promise<DealSpaRules> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      unit: { include: { project: { include: { config: true } } } },
      payments: true,
    },
  });
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const rules = loadRules(deal.unit.project.config);
  const purchasePrice = deal.salePrice - deal.discount;

  // ----- Paid amount ------------------------------------------------------
  // Counts only PAID and PDC_CLEARED instalments; partial payments are
  // already reflected in payment.amount adjustments at the row level.
  const paidAmount = deal.payments
    .filter((p) => p.status === "PAID" || p.status === "PDC_CLEARED")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidPercentage = purchasePrice > 0 ? (paidAmount / purchasePrice) * 100 : 0;

  // ----- 1. Late fees -----------------------------------------------------
  const overduePayments = deal.payments.filter(
    (p) =>
      (p.status === "PENDING" || p.status === "PARTIAL" || p.status === "OVERDUE") &&
      !p.isWaived &&
      p.dueDate.getTime() < asOf.getTime(),
  );
  const perPayment = overduePayments.map((p) => {
    const { daysOverdue, accruedFee } = lateFeeForPayment({
      amount: p.amount,
      dueDate: p.dueDate,
      asOf,
      monthlyPercent: rules.lateFeeMonthlyPercent,
    });
    return {
      paymentId: p.id,
      label: p.milestoneLabel,
      amount: p.amount,
      dueDate: p.dueDate.toISOString(),
      daysOverdue,
      accruedFee,
    };
  });
  const totalAccrued = perPayment.reduce((s, p) => s + p.accruedFee, 0);

  // ----- 2. Disposal eligibility -----------------------------------------
  const allowed = paidPercentage + 1e-9 >= rules.disposalThresholdPercent;
  const shortfallAmount = allowed
    ? 0
    : Math.max(0, (rules.disposalThresholdPercent / 100) * purchasePrice - paidAmount);

  // ----- 3. Delay compensation -------------------------------------------
  // Anticipated Completion Date + grace period -> deadline. Beyond it,
  // buyer earns annualPercent / year of paid amount, capped at capPercent
  // of purchase price.
  const anticipatedCompletion =
    deal.anticipatedCompletionDate ??
    deal.unit.anticipatedCompletionDate ??
    deal.unit.project.handoverDate;

  const graceEnd = new Date(anticipatedCompletion);
  graceEnd.setMonth(graceEnd.getMonth() + rules.gracePeriodMonths);

  const monthsDelayedAfterGrace = Math.max(
    0,
    (asOf.getTime() - graceEnd.getTime()) / (MS_PER_DAY * 30),
  );
  const eligible = monthsDelayedAfterGrace > 0 && paidAmount > 0;
  const rawCompensation = eligible
    ? paidAmount * (rules.delayCompensationAnnualPercent / 100) * (monthsDelayedAfterGrace / 12)
    : 0;
  const compensationCap = (rules.delayCompensationCapPercent / 100) * purchasePrice;
  const cappedAmount = Math.min(rawCompensation, compensationCap);
  const capApplied = rawCompensation > compensationCap;

  // ----- 4. Liquidated damages -------------------------------------------
  const ldAmount = (rules.liquidatedDamagesPercent / 100) * purchasePrice;

  return {
    dealId: deal.id,
    asOf: asOf.toISOString(),
    rules,
    purchasePrice,
    paidAmount: Math.round(paidAmount * 100) / 100,
    paidPercentage: Math.round(paidPercentage * 100) / 100,
    lateFees: {
      totalAccrued: Math.round(totalAccrued * 100) / 100,
      overdueCount: perPayment.length,
      perPayment,
    },
    disposal: {
      allowed,
      paidPercent: Math.round(paidPercentage * 100) / 100,
      thresholdPercent: rules.disposalThresholdPercent,
      shortfallAmount: Math.round(shortfallAmount * 100) / 100,
      processingFee: rules.resaleProcessingFee,
    },
    delayCompensation: {
      eligible,
      anticipatedCompletionDate: anticipatedCompletion.toISOString(),
      graceEndDate: graceEnd.toISOString(),
      monthsDelayedAfterGrace: Math.round(monthsDelayedAfterGrace * 100) / 100,
      annualPercent: rules.delayCompensationAnnualPercent,
      capPercent: rules.delayCompensationCapPercent,
      rawAmount: Math.round(rawCompensation * 100) / 100,
      cappedAmount: Math.round(cappedAmount * 100) / 100,
      capApplied,
    },
    liquidatedDamages: {
      percentage: rules.liquidatedDamagesPercent,
      amount: Math.round(ldAmount * 100) / 100,
      note: "Maximum amount the seller may retain on purchaser default after a 30-day cure period",
    },
  };
}

// ---------------------------------------------------------------------------
// Disposal gate — used by resale / assignment endpoints to reject the
// operation when the purchaser hasn't yet paid the threshold.
// ---------------------------------------------------------------------------
export async function assertDisposalAllowed(dealId: string): Promise<void> {
  const summary = await calculateDealSpaRules(dealId);
  if (!summary.disposal.allowed) {
    const err: any = new Error(
      `Cannot dispose of unit: only ${summary.disposal.paidPercent.toFixed(2)}% paid, ` +
      `threshold is ${summary.disposal.thresholdPercent}% (shortfall: AED ${summary.disposal.shortfallAmount})`,
    );
    err.code = "DISPOSAL_THRESHOLD_NOT_MET";
    err.statusCode = 403;
    err.detail = summary.disposal;
    throw err;
  }
}
