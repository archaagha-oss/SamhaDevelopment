/**
 * escrowService.ts — Escrow transaction ledger.
 *
 * Per-deal credit / debit entries reconciling against the project's
 * escrow bank account (ProjectBankAccount with purpose=ESCROW). The
 * bank account itself is configured elsewhere; this module is the
 * transaction-level ledger.
 *
 * Balance calculations use DB aggregates (groupBy) rather than loading
 * the full transaction set into memory — important for projects that
 * have accumulated thousands of escrow movements over a build cycle.
 */

import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EscrowError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "ESCROW_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EscrowTransactionType = "CREDIT" | "DEBIT";

export interface RecordTransactionInput {
  dealId:          string;
  type:            EscrowTransactionType;
  amount:          number;
  transactionDate: string | Date;
  bankAccountId?:  string | null;
  reference?:      string | null;
  paymentId?:      string | null;
  notes?:          string | null;
}

export interface ListTransactionsFilter {
  dealId?:    string;
  projectId?: string;
  from?:      string | Date;
  to?:        string | Date;
}

export interface ListTransactionsOpts {
  take?:   number;
  cursor?: string | null;
}

export interface EscrowBalance {
  credits: number;
  debits:  number;
  balance: number;
}

// ---------------------------------------------------------------------------
// recordTransaction
// ---------------------------------------------------------------------------

/**
 * Create a new escrow ledger entry. Resolves projectId from the deal so
 * project-wide queries don't need a join. Validates type/amount.
 */
export async function recordTransaction(
  input: RecordTransactionInput,
  userId: string,
) {
  if (input.type !== "CREDIT" && input.type !== "DEBIT") {
    throw new EscrowError(
      "type must be CREDIT or DEBIT",
      400,
      "INVALID_TYPE",
    );
  }
  if (!(input.amount > 0)) {
    throw new EscrowError(
      "amount must be greater than 0",
      400,
      "INVALID_AMOUNT",
    );
  }

  const deal = await prisma.deal.findUnique({
    where:  { id: input.dealId },
    select: { id: true, unit: { select: { projectId: true } } },
  });
  if (!deal) {
    throw new EscrowError("Deal not found", 404, "DEAL_NOT_FOUND");
  }
  const projectId = deal.unit.projectId;

  return prisma.escrowTransaction.create({
    data: {
      dealId:          input.dealId,
      projectId,
      bankAccountId:   input.bankAccountId ?? null,
      type:            input.type,
      amount:          input.amount,
      transactionDate: new Date(input.transactionDate),
      reference:       input.reference ?? null,
      paymentId:       input.paymentId ?? null,
      notes:           input.notes ?? null,
      createdBy:       userId,
    },
  });
}

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

/**
 * Aggregate credits & debits via DB groupBy. Keeps memory flat regardless
 * of how many transactions a deal/project has accumulated.
 */
async function aggregateBalance(where: {
  dealId?: string;
  projectId?: string;
}): Promise<EscrowBalance> {
  const groups = await prisma.escrowTransaction.groupBy({
    by:      ["type"],
    where,
    _sum:    { amount: true },
  });

  let credits = 0;
  let debits  = 0;
  for (const g of groups) {
    const sum = g._sum.amount ?? 0;
    if (g.type === "CREDIT") credits = sum;
    else if (g.type === "DEBIT") debits = sum;
  }

  return { credits, debits, balance: credits - debits };
}

export async function getDealBalance(dealId: string): Promise<EscrowBalance> {
  return aggregateBalance({ dealId });
}

export async function getProjectBalance(projectId: string): Promise<EscrowBalance> {
  return aggregateBalance({ projectId });
}

// ---------------------------------------------------------------------------
// listTransactions
// ---------------------------------------------------------------------------

/**
 * Cursor-paginated transaction list, ordered by transactionDate desc then
 * id desc (stable tiebreak for transactions sharing a date).
 */
export async function listTransactions(
  filter: ListTransactionsFilter,
  opts: ListTransactionsOpts = {},
) {
  const take = Math.min(Math.max(opts.take ?? 100, 1), 500);

  const where: any = {};
  if (filter.dealId)    where.dealId    = filter.dealId;
  if (filter.projectId) where.projectId = filter.projectId;
  if (filter.from || filter.to) {
    where.transactionDate = {};
    if (filter.from) where.transactionDate.gte = new Date(filter.from);
    if (filter.to)   where.transactionDate.lte = new Date(filter.to);
  }

  const rows = await prisma.escrowTransaction.findMany({
    where,
    orderBy: [
      { transactionDate: "desc" },
      { id:              "desc" },
    ],
    take: take + 1,
    ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    const next = rows.pop()!;
    nextCursor = next.id;
  }

  return { data: rows, nextCursor };
}

// ---------------------------------------------------------------------------
// updateTransaction — limited (reference/notes only)
// ---------------------------------------------------------------------------

export async function updateTransaction(
  id: string,
  patch: { reference?: string | null; notes?: string | null },
) {
  const existing = await prisma.escrowTransaction.findUnique({ where: { id } });
  if (!existing) {
    throw new EscrowError("Escrow transaction not found", 404, "TX_NOT_FOUND");
  }

  const data: { reference?: string | null; notes?: string | null } = {};
  if (patch.reference !== undefined) data.reference = patch.reference;
  if (patch.notes !== undefined)     data.notes     = patch.notes;

  if (Object.keys(data).length === 0) {
    return existing;
  }

  return prisma.escrowTransaction.update({
    where: { id },
    data,
  });
}

// ---------------------------------------------------------------------------
// deleteTransaction — hard delete with audit log line
// ---------------------------------------------------------------------------

/**
 * Hard delete. Escrow auditability requires we log the full row contents
 * before deleting — for v1 we emit a structured logger.warn. A proper
 * EscrowAuditLog table can be added later without changing this contract.
 */
export async function deleteTransaction(id: string, userId: string) {
  const existing = await prisma.escrowTransaction.findUnique({ where: { id } });
  if (!existing) {
    throw new EscrowError("Escrow transaction not found", 404, "TX_NOT_FOUND");
  }

  // Lazy import — avoids pulling the logger into hot paths that don't need it.
  const { logger } = await import("../lib/logger");
  logger.warn("escrow.transaction.deleted", {
    domain:    "escrow",
    event:     "transaction_deleted",
    deletedBy: userId,
    row:       existing,
  });

  await prisma.escrowTransaction.delete({ where: { id } });
  return { ok: true, id };
}
