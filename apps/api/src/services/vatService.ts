import { prisma } from "../lib/prisma";

/**
 * Resolve the VAT percent that applies to a given project.  Falls back to a
 * sensible default (5% UAE) when no ProjectConfig exists.
 */
export async function getProjectVatPercent(projectId: string): Promise<number> {
  const cfg = await prisma.projectConfig.findUnique({ where: { projectId } });
  if (!cfg) return 5;
  return cfg.vatPercent ?? 5;
}

export interface VATComputation {
  netAmount: number;
  vatPercent: number;
  vatAmount: number;
  grossAmount: number;
}

/**
 * Compute VAT on a NET amount.  Inputs assumed to be in the same currency.
 */
export function computeVat(netAmount: number, vatPercent: number): VATComputation {
  const vatAmount = +(netAmount * (vatPercent / 100)).toFixed(2);
  const grossAmount = +(netAmount + vatAmount).toFixed(2);
  return { netAmount: +netAmount.toFixed(2), vatPercent, vatAmount, grossAmount };
}
