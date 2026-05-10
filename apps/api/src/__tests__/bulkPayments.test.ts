import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseCsv, rowsToObjects } from "../lib/csv";
import { bulkPaymentRowSchema } from "../schemas/validation";

// ---------------------------------------------------------------------------
// Prisma is mocked at module load — every test in this file shares one mock
// instance, reset between tests via vi.clearAllMocks(). The bulkApplyPayments
// service is then imported AFTER vi.mock, which ensures it picks up the mock.
// This pattern matches what vitest recommends for module-mock injection.
// ---------------------------------------------------------------------------

vi.mock("../lib/prisma", () => {
  return {
    prisma: {
      payment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      deal: {
        findUnique: vi.fn(),
      },
      paymentAuditLog: {
        create: vi.fn(),
      },
      partialPayment: {
        create: vi.fn(),
      },
      // Transactions: we run the callback against the same mock object so
      // tx.* falls back to the same vi.fn instances.
      $transaction: vi.fn(),
    },
  };
});

vi.mock("../lib/logger", () => ({
  paymentLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  logger:        { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "../lib/prisma";
import { bulkApplyPayments, type BulkPaymentInputRow } from "../services/paymentService";

const pMock = prisma as unknown as {
  payment: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany:   ReturnType<typeof vi.fn>;
    update:     ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  deal:        { findUnique: ReturnType<typeof vi.fn> };
  paymentAuditLog: { create: ReturnType<typeof vi.fn> };
  partialPayment:  { create: ReturnType<typeof vi.fn> };
  $transaction:    ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default $transaction behaviour: if it's called with a callback, run it
  // against the prisma mock; if called with an array, resolve to that array.
  pMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === "function") return arg(pMock);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });

  // Default writes resolve to a stub object — markPaymentPaid / partial
  // helpers don't inspect the result.
  pMock.payment.update.mockResolvedValue({ id: "pm_stub" });
  pMock.payment.findUniqueOrThrow.mockResolvedValue({
    id: "pm_stub",
    partialPayments: [],
    auditLog: [],
  });
  pMock.paymentAuditLog.create.mockResolvedValue({});
  pMock.partialPayment.create.mockResolvedValue({ id: "pp_stub", amount: 0 });
});

// ---------------------------------------------------------------------------
// 1. Header parsing — pure CSV utility
// ---------------------------------------------------------------------------

describe("parseCsv (header parsing)", () => {
  it("parses a simple header + 2 rows", () => {
    const text = [
      "dealNumber,milestoneLabel,amount,paidDate,paymentMethod",
      "D-2025-001,Reservation,5000,2025-09-12,CASH",
      "D-2025-002,DLD Fee,4000,2025-09-13,BANK_TRANSFER",
    ].join("\n");
    const parsed = parseCsv(text);
    expect(parsed.header).toEqual([
      "dealNumber", "milestoneLabel", "amount", "paidDate", "paymentMethod",
    ]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual([
      "D-2025-001", "Reservation", "5000", "2025-09-12", "CASH",
    ]);
  });

  it("handles CRLF line endings and trailing blank lines", () => {
    const text = "a,b,c\r\n1,2,3\r\n4,5,6\r\n\r\n";
    const parsed = parseCsv(text);
    expect(parsed.header).toEqual(["a", "b", "c"]);
    expect(parsed.rows).toEqual([["1", "2", "3"], ["4", "5", "6"]]);
  });

  it("strips a UTF-8 BOM on the first cell", () => {
    const text = "﻿dealNumber,amount\nD-1,1000";
    const parsed = parseCsv(text);
    expect(parsed.header[0]).toBe("dealNumber");
  });

  it("preserves quoted fields containing commas", () => {
    const text = [
      "dealNumber,milestoneLabel,amount",
      'D-1,"DLD Fee, 4%",4000',
    ].join("\n");
    const parsed = parseCsv(text);
    expect(parsed.rows[0]).toEqual(["D-1", "DLD Fee, 4%", "4000"]);
  });

  it("decodes escaped quotes inside quoted fields", () => {
    const text = [
      "milestoneLabel",
      '"Buyer said ""hello"""',
    ].join("\n");
    const parsed = parseCsv(text);
    expect(parsed.rows[0]).toEqual(['Buyer said "hello"']);
  });

  it("returns empty header + rows on empty input", () => {
    expect(parseCsv("")).toEqual({ header: [], rows: [] });
  });

  it("rowsToObjects keys cells by header name", () => {
    const text = [
      "dealNumber,milestoneLabel,amount",
      "D-1,Reservation,5000",
    ].join("\n");
    const objs = rowsToObjects(parseCsv(text));
    expect(objs).toEqual([
      { dealNumber: "D-1", milestoneLabel: "Reservation", amount: "5000" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Zod row schema
// ---------------------------------------------------------------------------

describe("bulkPaymentRowSchema", () => {
  it("accepts a row with paymentId and YYYY-MM-DD paidDate", () => {
    const r = bulkPaymentRowSchema.safeParse({
      paymentId: "pm_123",
      amount: 5000,
      paidDate: "2025-09-12",
      paymentMethod: "CASH",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a row with dealNumber + milestoneLabel and ISO datetime paidDate", () => {
    const r = bulkPaymentRowSchema.safeParse({
      dealNumber: "D-2025-001",
      milestoneLabel: "Reservation",
      amount: 5000,
      paidDate: "2025-09-12T00:00:00Z",
      paymentMethod: "BANK_TRANSFER",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a row missing both paymentId and dealNumber", () => {
    const r = bulkPaymentRowSchema.safeParse({
      milestoneLabel: "Reservation",
      amount: 5000,
      paidDate: "2025-09-12",
      paymentMethod: "CASH",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a row with dealNumber but no milestoneLabel", () => {
    const r = bulkPaymentRowSchema.safeParse({
      dealNumber: "D-2025-001",
      amount: 5000,
      paidDate: "2025-09-12",
      paymentMethod: "CASH",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a row with non-positive amount", () => {
    const r = bulkPaymentRowSchema.safeParse({
      paymentId: "pm_1",
      amount: 0,
      paidDate: "2025-09-12",
      paymentMethod: "CASH",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a row with malformed paidDate", () => {
    const r = bulkPaymentRowSchema.safeParse({
      paymentId: "pm_1",
      amount: 100,
      paidDate: "September 12, 2025",
      paymentMethod: "CASH",
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. bulkApplyPayments — resolution + dispatch
// ---------------------------------------------------------------------------

const baseRow = (over: Partial<BulkPaymentInputRow>): BulkPaymentInputRow => ({
  row: 2,
  paymentId: undefined,
  dealNumber: undefined,
  milestoneLabel: undefined,
  amount: 0,
  paidDate: new Date("2025-09-12T00:00:00Z"),
  paymentMethod: "CASH",
  receiptKey: undefined,
  notes: undefined,
  ...over,
});

describe("bulkApplyPayments — dealNumber → paymentId resolution", () => {
  it("resolves paymentId via { dealNumber, milestoneLabel } when paymentId is absent", async () => {
    pMock.deal.findUnique.mockResolvedValue({ id: "deal_1" });
    pMock.payment.findMany.mockResolvedValue([
      { id: "pm_1", amount: 5000, adjustedAmount: null, status: "PENDING", partialPayments: [] },
    ]);
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_1", amount: 5000, adjustedAmount: null, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [baseRow({
        dealNumber: "D-2025-001",
        milestoneLabel: "Reservation",
        amount: 5000,
      })],
      "user_1"
    );

    expect(out.successCount).toBe(1);
    expect(out.errorCount).toBe(0);
    expect(out.successes[0]).toMatchObject({ paymentId: "pm_1", action: "MARKED_PAID" });
    expect(pMock.deal.findUnique).toHaveBeenCalledWith({
      where: { dealNumber: "D-2025-001" },
      select: { id: true },
    });
  });

  it("returns DEAL_NOT_FOUND when the dealNumber does not exist", async () => {
    pMock.deal.findUnique.mockResolvedValue(null);

    const out = await bulkApplyPayments(
      [baseRow({
        dealNumber: "D-MISSING",
        milestoneLabel: "Reservation",
        amount: 5000,
      })],
      "user_1"
    );

    expect(out.successCount).toBe(0);
    expect(out.errors).toEqual([
      expect.objectContaining({
        row: 2,
        reason: "DEAL_NOT_FOUND",
        dealNumber: "D-MISSING",
      }),
    ]);
  });

  it("returns PAYMENT_NOT_FOUND when no payment matches the milestoneLabel on the deal", async () => {
    pMock.deal.findUnique.mockResolvedValue({ id: "deal_1" });
    pMock.payment.findMany.mockResolvedValue([]);

    const out = await bulkApplyPayments(
      [baseRow({
        dealNumber: "D-1",
        milestoneLabel: "DoesNotExist",
        amount: 100,
      })],
      "user_1"
    );

    expect(out.errors[0]).toMatchObject({ reason: "PAYMENT_NOT_FOUND" });
  });
});

describe("bulkApplyPayments — partial vs full marking", () => {
  it("marks fully paid when amount equals payment.amount", async () => {
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_1", amount: 5000, adjustedAmount: null, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [baseRow({ paymentId: "pm_1", amount: 5000 })],
      "user_1"
    );

    expect(out.successes[0].action).toBe("MARKED_PAID");
    // markPaymentPaid uses prisma.$transaction with an array — verify it ran.
    expect(pMock.$transaction).toHaveBeenCalled();
  });

  it("records a partial payment when amount < payment.amount", async () => {
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_1", amount: 5000, adjustedAmount: null, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [baseRow({ paymentId: "pm_1", amount: 2000 })],
      "user_1"
    );

    expect(out.successes[0].action).toBe("PARTIAL_RECORDED");
    expect(pMock.partialPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: "pm_1",
          amount: 2000,
          paidBy: "user_1",
        }),
      })
    );
  });

  it("uses adjustedAmount when set (instead of original amount)", async () => {
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_1", amount: 5000, adjustedAmount: 4500, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [baseRow({ paymentId: "pm_1", amount: 4500 })],
      "user_1"
    );

    expect(out.successes[0].action).toBe("MARKED_PAID");
  });
});

describe("bulkApplyPayments — AMOUNT_EXCEEDS_BALANCE rejection", () => {
  it("rejects when amount > payment.amount", async () => {
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_1", amount: 5000, adjustedAmount: null, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [baseRow({ paymentId: "pm_1", amount: 6000 })],
      "user_1"
    );

    expect(out.successCount).toBe(0);
    expect(out.errors).toEqual([
      expect.objectContaining({
        row: 2,
        reason: "AMOUNT_EXCEEDS_BALANCE",
        paymentId: "pm_1",
      }),
    ]);
    // The handler must NOT have attempted any write.
    expect(pMock.partialPayment.create).not.toHaveBeenCalled();
  });

  it("does not reject within sub-cent floating-point drift", async () => {
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_1", amount: 100.1, adjustedAmount: null, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [baseRow({ paymentId: "pm_1", amount: 100.1 + 1e-9 })], // FP drift
      "user_1"
    );

    expect(out.successCount).toBe(1);
    expect(out.errors).toEqual([]);
  });
});

describe("bulkApplyPayments — one bad row does not abort the others", () => {
  it("processes row 3 even when row 2 fails", async () => {
    pMock.deal.findUnique
      .mockResolvedValueOnce(null)                      // row 2 → deal not found
      .mockResolvedValueOnce({ id: "deal_2" });        // row 3 → ok

    pMock.payment.findMany.mockResolvedValue([
      { id: "pm_2", amount: 1000, adjustedAmount: null, status: "PENDING", partialPayments: [] },
    ]);
    pMock.payment.findUnique.mockResolvedValue({
      id: "pm_2", amount: 1000, adjustedAmount: null, status: "PENDING", partialPayments: [],
    });

    const out = await bulkApplyPayments(
      [
        baseRow({ row: 2, dealNumber: "D-MISSING", milestoneLabel: "X", amount: 100 }),
        baseRow({ row: 3, dealNumber: "D-2",       milestoneLabel: "Y", amount: 1000 }),
      ],
      "user_1"
    );

    expect(out.totalRows).toBe(2);
    expect(out.successCount).toBe(1);
    expect(out.errorCount).toBe(1);
    expect(out.errors[0].row).toBe(2);
    expect(out.successes[0].row).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 4. Malformed CSV — header validation behaviour at the parser level
// ---------------------------------------------------------------------------

describe("malformed CSV behaviour", () => {
  it("returns no rows when only a header is present", () => {
    const parsed = parseCsv("dealNumber,amount\n");
    expect(parsed.rows).toEqual([]);
  });

  it("yields an empty header on a blank input (the route turns this into CSV_EMPTY)", () => {
    const parsed = parseCsv("");
    expect(parsed.header).toEqual([]);
    expect(parsed.rows).toEqual([]);
  });

  it("rowsToObjects gracefully handles a row with fewer cells than the header", () => {
    const text = [
      "dealNumber,milestoneLabel,amount",
      "D-1,Reservation",
    ].join("\n");
    const objs = rowsToObjects(parseCsv(text));
    expect(objs[0]).toEqual({
      dealNumber:     "D-1",
      milestoneLabel: "Reservation",
      amount:         "",
    });
  });
});
