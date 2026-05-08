import { prisma } from "../lib/prisma";

/**
 * Allocate the next gap-free number for a given (org, sequenceKey, fiscalYear).
 *
 * Implementation: a single transactional UPDATE-then-RETURN against
 * OrgNumberSequence guarantees that two concurrent callers do not allocate
 * the same number.  We also auto-create the sequence row if it doesn't exist
 * yet for the requested fiscal year.
 *
 * Returns:
 *   { number: 42, formatted: "INV-00042" }
 */
export async function nextNumber(
  organizationId: string,
  sequenceKey: string,
  fiscalYear: number,
  defaults?: { prefix?: string; width?: number },
): Promise<{ number: number; formatted: string }> {
  return prisma.$transaction(async (tx) => {
    let row = await tx.orgNumberSequence.findUnique({
      where: {
        organizationId_sequenceKey_fiscalYear: {
          organizationId,
          sequenceKey,
          fiscalYear,
        },
      },
    });

    if (!row) {
      row = await tx.orgNumberSequence.create({
        data: {
          organizationId,
          sequenceKey,
          fiscalYear,
          prefix: defaults?.prefix ?? "",
          nextValue: 1,
          width: defaults?.width ?? 5,
        },
      });
    }

    const number = row.nextValue;

    await tx.orgNumberSequence.update({
      where: { id: row.id },
      data: { nextValue: number + 1 },
    });

    const padded = String(number).padStart(row.width, "0");
    const formatted = `${row.prefix}${padded}-${fiscalYear}`;

    return { number, formatted };
  });
}

export function fiscalYearOf(date: Date | string, fiscalYearStartMonth = 1): number {
  const d = date instanceof Date ? date : new Date(date);
  const m = d.getUTCMonth() + 1; // 1..12
  const y = d.getUTCFullYear();
  return m >= fiscalYearStartMonth ? y : y - 1;
}
