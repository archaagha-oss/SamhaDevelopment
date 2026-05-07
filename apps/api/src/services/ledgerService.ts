/**
 * LedgerService — append-only double-entry ledger for all financial events.
 *
 * Every state-changing financial event (deal created, payment received,
 * commission paid, refund) calls `post()` with a balanced set of entries.
 * "Balanced" = sum(debits) == sum(credits) within the same txId.
 *
 * Reading the ledger by accountRef gives you the live balance for that
 * account; replaying gives you historical balances at any point in time.
 *
 * Money is integer fils (BigInt). Use `aedToFils()` from `lib/money.ts`
 * at every entrypoint that takes user-facing AED values.
 */

import { LedgerAccountType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sumFils } from "../lib/money";

export interface LedgerEntryInput {
  accountType: LedgerAccountType;
  accountRef: string;
  debitFils?: bigint;
  creditFils?: bigint;
  dealId?: string | null;
  paymentId?: string | null;
  commissionId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PostInput {
  txId: string;                 // unique grouping id; same id → all entries belong to one tx
  postedBy: string;             // userId or "system"
  occurredAt?: Date;            // defaults to now()
  entries: LedgerEntryInput[];
}

/**
 * Post a balanced set of ledger entries.
 *
 * Throws if the entries don't balance (sum debits != sum credits).
 * Caller may pass a Prisma transaction client to atomically post within an
 * existing transaction.
 */
export async function post(
  input: PostInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  if (!input.entries.length) return;

  const totalDebits = sumFils(input.entries.map((e) => e.debitFils ?? 0n));
  const totalCredits = sumFils(input.entries.map((e) => e.creditFils ?? 0n));
  if (totalDebits !== totalCredits) {
    throw new Error(
      `LedgerService.post: entries do not balance — ` +
        `debits=${totalDebits} credits=${totalCredits} (txId=${input.txId})`
    );
  }

  const client = tx ?? prisma;
  const occurredAt = input.occurredAt ?? new Date();

  await client.ledgerEntry.createMany({
    data: input.entries.map((e) => ({
      txId: input.txId,
      accountType: e.accountType,
      accountRef: e.accountRef,
      debitFils: e.debitFils ?? 0n,
      creditFils: e.creditFils ?? 0n,
      dealId: e.dealId ?? null,
      paymentId: e.paymentId ?? null,
      commissionId: e.commissionId ?? null,
      description: e.description ?? null,
      metadata: e.metadata ? (e.metadata as any) : undefined,
      postedBy: input.postedBy,
      occurredAt,
    })),
  });
}

/**
 * Compute the balance of an account.
 * Convention: balance = sum(debits) - sum(credits).
 *   For RECEIVABLE: positive balance = buyer owes money
 *   For CASH_RECEIVED: positive balance = cash collected
 *   For COMMISSION_PAYABLE: positive balance = broker is owed money
 */
export async function balanceFor(
  accountType: LedgerAccountType,
  accountRef: string
): Promise<bigint> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { accountType, accountRef },
    select: { debitFils: true, creditFils: true },
  });
  let total = 0n;
  for (const r of rows) {
    total += r.debitFils - r.creditFils;
  }
  return total;
}

/**
 * Total amount paid against a deal (sum of CASH_RECEIVED debits where dealId matches).
 */
export async function dealCashCollected(dealId: string): Promise<bigint> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { dealId, accountType: "CASH_RECEIVED" },
    select: { debitFils: true, creditFils: true },
  });
  let total = 0n;
  for (const r of rows) {
    total += r.debitFils - r.creditFils;
  }
  return total;
}

/**
 * Generate a stable txId for a given event.
 * Format: ${aggregateType}:${aggregateId}:${event}:${timestamp-ms}
 */
export function makeTxId(aggregateType: string, aggregateId: string, event: string): string {
  return `${aggregateType}:${aggregateId}:${event}:${Date.now()}`;
}
