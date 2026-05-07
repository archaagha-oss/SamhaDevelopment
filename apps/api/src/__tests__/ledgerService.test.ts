/**
 * Unit tests for LedgerService — focus on balance enforcement.
 * Uses Prisma mock so we don't need a database for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the prisma module BEFORE importing the service under test
vi.mock("../lib/prisma", () => {
  return {
    prisma: {
      ledgerEntry: {
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

import { post, balanceFor, dealCashCollected, makeTxId } from "../services/ledgerService";
import { prisma } from "../lib/prisma";

const ledgerEntry = (prisma as any).ledgerEntry;

describe("LedgerService.post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a balanced set of entries", async () => {
    await post({
      txId: "tx-1",
      postedBy: "test-user",
      entries: [
        {
          accountType: "RECEIVABLE",
          accountRef: "deal-1",
          debitFils: 1_000_000n,
        },
        {
          accountType: "REVENUE",
          accountRef: "deal-1",
          creditFils: 1_000_000n,
        },
      ],
    });

    expect(ledgerEntry.createMany).toHaveBeenCalledOnce();
    const arg = ledgerEntry.createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(2);
  });

  it("rejects unbalanced entries", async () => {
    await expect(
      post({
        txId: "tx-2",
        postedBy: "test-user",
        entries: [
          {
            accountType: "RECEIVABLE",
            accountRef: "deal-1",
            debitFils: 1_000_000n,
          },
          {
            accountType: "REVENUE",
            accountRef: "deal-1",
            creditFils: 999_999n, // 1 fil short
          },
        ],
      })
    ).rejects.toThrow(/do not balance/);

    expect(ledgerEntry.createMany).not.toHaveBeenCalled();
  });

  it("no-ops on empty entries", async () => {
    await post({ txId: "tx-3", postedBy: "test-user", entries: [] });
    expect(ledgerEntry.createMany).not.toHaveBeenCalled();
  });

  it("validates a complex multi-leg deal-creation tx", async () => {
    // Deal: salePrice 1M, discount 50K, DLD 4% on 950K = 38K, admin 5K
    // Expected entries balance:
    //   RECEIVABLE 1,000,000 + 38,000 + 5,000 = 1,043,000 debits
    //   REVENUE 950,000 credit
    //   DISCOUNT 50,000 credit
    //   DLD_FEE 38,000 credit
    //   ADMIN_FEE 5,000 credit
    //   total credits = 1,043,000 ✓
    await post({
      txId: "tx-4",
      postedBy: "test-user",
      entries: [
        { accountType: "RECEIVABLE", accountRef: "deal-1", debitFils: 100_000_000n },
        { accountType: "REVENUE", accountRef: "deal-1", creditFils: 95_000_000n },
        { accountType: "DISCOUNT", accountRef: "deal-1", creditFils: 5_000_000n },
        { accountType: "RECEIVABLE", accountRef: "deal-1", debitFils: 3_800_000n },
        { accountType: "DLD_FEE", accountRef: "deal-1", creditFils: 3_800_000n },
        { accountType: "RECEIVABLE", accountRef: "deal-1", debitFils: 500_000n },
        { accountType: "ADMIN_FEE", accountRef: "deal-1", creditFils: 500_000n },
      ],
    });
    expect(ledgerEntry.createMany).toHaveBeenCalledOnce();
  });
});

describe("LedgerService.balanceFor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes net balance from debits minus credits", async () => {
    ledgerEntry.findMany.mockResolvedValueOnce([
      { debitFils: 100_000n, creditFils: 0n },
      { debitFils: 50_000n, creditFils: 0n },
      { debitFils: 0n, creditFils: 30_000n },
    ]);
    const balance = await balanceFor("RECEIVABLE", "deal-1");
    expect(balance).toBe(120_000n);
  });
});

describe("LedgerService.dealCashCollected", () => {
  it("filters CASH_RECEIVED entries by dealId", async () => {
    ledgerEntry.findMany.mockResolvedValueOnce([
      { debitFils: 100_000n, creditFils: 0n },
      { debitFils: 50_000n, creditFils: 0n },
    ]);
    const total = await dealCashCollected("deal-1");
    expect(total).toBe(150_000n);
  });
});

describe("makeTxId", () => {
  it("produces a uniquely scoped id", () => {
    const id = makeTxId("DEAL", "abc", "CREATED");
    expect(id).toMatch(/^DEAL:abc:CREATED:\d+$/);
  });
});
