import type { EscrowEntryDirection, EscrowEntryReason } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

export interface CreateEscrowAccountInput {
  projectId: string;
  bankName: string;
  branch?: string;
  accountName: string;
  accountNo: string;
  iban?: string;
  swift?: string;
  currency?: string;
  trusteeAccountId?: string | null;
}

export async function createEscrowAccount(input: CreateEscrowAccountInput) {
  return prisma.escrowAccount.create({
    data: {
      projectId: input.projectId,
      bankName: input.bankName,
      branch: input.branch ?? null,
      accountName: input.accountName,
      accountNo: input.accountNo,
      iban: input.iban ?? null,
      swift: input.swift ?? null,
      currency: input.currency ?? "AED",
      trusteeAccountId: input.trusteeAccountId ?? null,
    },
  });
}

export async function listEscrowAccountsForProject(projectId: string) {
  return prisma.escrowAccount.findMany({
    where: { projectId },
    include: { trusteeAccount: true },
    orderBy: { createdAt: "asc" },
  });
}

export interface PostEntryInput {
  accountId: string;
  direction: EscrowEntryDirection;
  reason: EscrowEntryReason;
  amount: number;
  currency?: string;
  paymentId?: string | null;
  refundRequestId?: string | null;
  externalRef?: string | null;
  notes?: string | null;
}

export async function postEntry(input: PostEntryInput, postedBy: string) {
  const account = await prisma.escrowAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new Error(`Escrow account not found: ${input.accountId}`);
  if (!account.isActive) throw new Error(`Escrow account is closed: ${account.id}`);
  if (input.amount <= 0) throw new Error("Escrow entry amount must be positive");

  const entry = await prisma.escrowLedgerEntry.create({
    data: {
      accountId: input.accountId,
      direction: input.direction,
      reason: input.reason,
      amount: +input.amount.toFixed(2),
      currency: input.currency ?? account.currency,
      paymentId: input.paymentId ?? null,
      refundRequestId: input.refundRequestId ?? null,
      externalRef: input.externalRef ?? null,
      notes: input.notes ?? null,
      postedBy,
    },
  });

  eventBus.emit({
    eventType: input.direction === "CREDIT" ? ("ESCROW_CREDITED" as any) : ("ESCROW_DEBITED" as any),
    aggregateId: input.accountId,
    aggregateType: "DEAL",
    data: { entryId: entry.id, amount: entry.amount, reason: entry.reason },
    userId: postedBy,
    timestamp: new Date(),
  });

  return entry;
}

export async function getAccountBalance(accountId: string): Promise<{
  credits: number;
  debits: number;
  balance: number;
}> {
  const grouped = await prisma.escrowLedgerEntry.groupBy({
    by: ["direction"],
    where: { accountId },
    _sum: { amount: true },
  });

  const credits = grouped.find((g) => g.direction === "CREDIT")?._sum.amount ?? 0;
  const debits = grouped.find((g) => g.direction === "DEBIT")?._sum.amount ?? 0;
  return {
    credits: +credits.toFixed(2),
    debits: +debits.toFixed(2),
    balance: +(credits - debits).toFixed(2),
  };
}

export async function listLedgerEntries(accountId: string, take = 200) {
  return prisma.escrowLedgerEntry.findMany({
    where: { accountId },
    orderBy: { postedAt: "desc" },
    take,
  });
}
