import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { markPaymentPaidSchema } from "../schemas/validation";
import { markPaymentPaid, recordPartialPayment, waivePayment, adjustPaymentDueDate, adjustPaymentAmount } from "../services/paymentService";
import { prisma } from "../lib/prisma";

const router = Router();

// Get payments for deal
router.get("/deal/:dealId", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { dealId: req.params.dealId },
      orderBy: { dueDate: "asc" },
      include: { auditLog: true },
    });

    res.json(payments);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch payments",
      code: "FETCH_PAYMENTS_ERROR",
      statusCode: 500,
    });
  }
});

// Get payment detail
router.get("/:id", async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { deal: true, auditLog: true },
    });

    if (!payment) {
      return res.status(404).json({
        error: "Payment not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch payment",
      code: "FETCH_PAYMENT_ERROR",
      statusCode: 500,
    });
  }
});

// Mark payment as paid — FINANCE or ADMIN only
router.patch(
  "/:id/paid",
  requireRole(["FINANCE", "ADMIN"]),
  validate(markPaymentPaidSchema),
  async (req, res) => {
    try {
      const { paymentMethod, paidBy, paidDate, receiptKey, notes } = req.body;

      const payment = await markPaymentPaid(req.params.id, {
        paidDate: new Date(paidDate),
        paymentMethod,
        paidBy,
        receiptKey,
        notes,
      });

      res.json(payment);
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to mark payment as paid",
        code: "PAYMENT_UPDATE_ERROR",
        statusCode: 400,
      });
    }
  }
);

// Mark payment as PDC — FINANCE or ADMIN only
router.patch("/:id/pdc", requireRole(["FINANCE", "ADMIN"]), async (req, res) => {
  try {
    const { pdcNumber, pdcBank, pdcDate } = req.body;
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        status: "PDC_PENDING",
        pdcNumber: pdcNumber || null,
        pdcBank:   pdcBank   || null,
        pdcDate:   pdcDate ? new Date(pdcDate) : null,
      },
    });
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update PDC", code: "PDC_UPDATE_ERROR", statusCode: 400 });
  }
});

// Mark PDC as cleared — FINANCE or ADMIN only
router.patch("/:id/pdc-cleared", requireRole(["FINANCE", "ADMIN"]), async (req, res) => {
  try {
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status: "PDC_CLEARED", pdcClearedDate: new Date() },
    });
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to clear PDC", code: "PDC_CLEAR_ERROR", statusCode: 400 });
  }
});

// Mark PDC as bounced — FINANCE or ADMIN only
router.patch("/:id/pdc-bounced", requireRole(["FINANCE", "ADMIN"]), async (req, res) => {
  try {
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status: "PDC_BOUNCED", pdcBouncedDate: new Date() },
    });
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to bounce PDC", code: "PDC_BOUNCE_ERROR", statusCode: 400 });
  }
});

// Record partial payment — FINANCE or ADMIN only
router.post("/:id/partial", requireRole(["FINANCE", "ADMIN"]), async (req, res) => {
  try {
    const { amount, paymentMethod, receiptKey, notes } = req.body;
    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: "amount is required", code: "MISSING_AMOUNT", statusCode: 400 });
    }
    const payment = await recordPartialPayment(req.params.id, {
      amount: parseFloat(amount),
      paidDate: new Date(),
      paymentMethod: paymentMethod || "CASH",
      paidBy: req.auth!.userId,
      receiptKey: receiptKey || undefined,
      notes: notes || undefined,
    });
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to record partial payment", code: "PARTIAL_PAYMENT_ERROR", statusCode: 400 });
  }
});

// Waive a payment — FINANCE or ADMIN only
router.patch("/:id/waive", requireRole(["FINANCE", "ADMIN"]), async (req, res) => {
  try {
    const resolvedUser = (req as any).resolvedUser;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "reason is required", code: "MISSING_REASON", statusCode: 400 });
    }
    const payment = await waivePayment(req.params.id, reason, resolvedUser?.id ?? req.auth!.userId);
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to waive payment", code: "WAIVE_ERROR", statusCode: 400 });
  }
});

// Approve a payment — FINANCE or ADMIN only
router.patch("/:id/approve", requireRole(["FINANCE", "ADMIN"]), async (req, res) => {
  try {
    const resolvedUser = (req as any).resolvedUser;
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: "Payment not found", code: "NOT_FOUND", statusCode: 404 });
    if (!["PENDING", "PARTIAL", "OVERDUE"].includes(payment.status)) {
      return res.status(400).json({ error: "Payment cannot be approved in its current state", code: "INVALID_STATUS", statusCode: 400 });
    }
    const { notes } = req.body;
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: req.params.id },
        data: { notes: notes ?? payment.notes, updatedAt: new Date() },
      }),
      prisma.paymentAuditLog.create({
        data: { paymentId: req.params.id, action: "APPROVED", changedBy: resolvedUser?.id ?? req.auth!.userId, reason: notes ?? undefined },
      }),
    ]);
    const updated = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { auditLog: true } });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to approve payment", code: "APPROVE_ERROR", statusCode: 400 });
  }
});

// Adjust due date
router.patch("/:id/adjust-date", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const { newDueDate, reason } = req.body;
    if (!newDueDate || !reason) return res.status(400).json({ error: "newDueDate and reason are required", code: "MISSING_FIELDS", statusCode: 400 });
    const payment = await adjustPaymentDueDate(req.params.id, new Date(newDueDate), reason, req.auth.userId);
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to adjust due date", code: "ADJUST_DATE_ERROR", statusCode: 400 });
  }
});

// Adjust amount
router.patch("/:id/adjust-amount", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const { newAmount, reason } = req.body;
    if (!newAmount || !reason) return res.status(400).json({ error: "newAmount and reason are required", code: "MISSING_FIELDS", statusCode: 400 });
    const payment = await adjustPaymentAmount(req.params.id, parseFloat(newAmount), reason, req.auth.userId);
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to adjust amount", code: "ADJUST_AMOUNT_ERROR", statusCode: 400 });
  }
});

// Get overdue payments
router.get("/status/overdue", async (req, res) => {
  try {
    const now = new Date();
    const overdue = await prisma.payment.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: { deal: { include: { lead: true } } },
      orderBy: { dueDate: "asc" },
    });

    res.json(overdue);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch overdue payments",
      code: "FETCH_OVERDUE_ERROR",
      statusCode: 500,
    });
  }
});

export default router;
