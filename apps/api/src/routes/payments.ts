import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { markPaymentPaidSchema } from "../schemas/validation";
import { markPaymentPaid, recordPartialPayment, waivePayment, adjustPaymentDueDate, adjustPaymentAmount } from "../services/paymentService";
import { createGeneratedDocument } from "../services/documentService";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityService";

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

// Get a single document for a payment (looked up via payment.dealId)
// Allows InvoicePrintPage / ReceiptPrintPage to fetch a frozen dataSnapshot
// using only the paymentId (no dealId required on the client).
router.get("/:id/documents/:docId", async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) {
      return res.status(404).json({ error: "Payment not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const doc = await prisma.document.findFirst({
      where: { id: req.params.docId, dealId: payment.dealId, softDeleted: false },
    });
    if (!doc) {
      return res.status(404).json({ error: "Document not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch document", code: "FETCH_DOC_ERROR", statusCode: 500 });
  }
});

// Get payment detail
router.get("/:id", async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        auditLog: true,
        deal: {
          include: {
            lead: true,
            unit: { include: { project: { select: { id: true, name: true, location: true } } } },
          },
        },
      },
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

// Generate an invoice for an installment (pre-payment document)
// Uses DocumentType.OTHER with dataSnapshot.docSubtype = "INVOICE" (no schema migration needed)
// POST /api/payments/:id/generate-invoice
router.post("/:id/generate-invoice", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        deal: {
          include: {
            lead: true,
            unit: { include: { project: { select: { id: true, name: true, location: true } } } },
          },
        },
      },
    });
    if (!payment) {
      return res.status(404).json({ error: "Payment not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const { deal } = payment;

    // Fetch payment instructions from AppSettings to embed in snapshot
    const appSettings = await prisma.appSettings.findFirst().catch(() => null);

    const dataSnapshot = {
      docSubtype:          "INVOICE",
      paymentId:           payment.id,
      dealId:              deal.id,
      dealNumber:          deal.dealNumber,
      milestoneLabel:      payment.milestoneLabel,
      amount:              payment.amount,
      dueDate:             payment.dueDate,
      status:              payment.status,
      buyerDetails:        { name: `${deal.lead.firstName} ${deal.lead.lastName}`, phone: deal.lead.phone, email: deal.lead.email },
      unitDetails:         { unitNumber: deal.unit.unitNumber, type: deal.unit.type, floor: deal.unit.floor },
      projectDetails:      (deal.unit as any).project,
      paymentInstructions: appSettings?.paymentInstructions ?? null,
    };

    // Count existing invoices for this payment to set version
    const existingCount = await prisma.document.count({
      where: { dealId: deal.id, type: "OTHER", softDeleted: false, name: { contains: `INVOICE — ${deal.dealNumber} — ${payment.milestoneLabel}` } },
    });

    const doc = await createGeneratedDocument({
      type:        "OTHER" as any,
      name:        `INVOICE — ${deal.dealNumber} — ${payment.milestoneLabel}`,
      dealId:      deal.id,
      leadId:      deal.leadId,
      dataSnapshot,
      createdBy:   req.auth.userId,
    });

    await logActivity({
      dealId:      deal.id,
      leadId:      deal.leadId,
      paymentId:   payment.id,
      type:        "DOC_GENERATED",
      kind:        "DOC_GENERATED",
      summary:     `Invoice generated for installment "${payment.milestoneLabel}" (${deal.dealNumber})`,
      createdBy:   req.auth.userId,
      createdById: req.auth.userId,
    });

    res.status(201).json({ ...doc, previewUrl: `/payments/${payment.id}/print/invoice?docId=${doc.id}` });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to generate invoice", code: "GENERATE_INVOICE_ERROR", statusCode: 400 });
  }
});

// Generate a receipt for a paid installment (post-payment document)
// Uses DocumentType.PAYMENT_RECEIPT
// POST /api/payments/:id/generate-receipt
router.post("/:id/generate-receipt", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        deal: {
          include: {
            lead: true,
            unit: { include: { project: { select: { id: true, name: true, location: true } } } },
          },
        },
      },
    });
    if (!payment) {
      return res.status(404).json({ error: "Payment not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (!["PAID", "PARTIAL"].includes(payment.status)) {
      return res.status(400).json({
        error: "Receipt can only be generated after payment is recorded",
        code: "PAYMENT_NOT_RECEIVED",
        statusCode: 400,
      });
    }

    const { deal } = payment;
    const dataSnapshot = {
      paymentId:      payment.id,
      dealId:         deal.id,
      dealNumber:     deal.dealNumber,
      milestoneLabel: payment.milestoneLabel,
      amount:         payment.amount,
      paidDate:       payment.paidDate,
      paymentMethod:  payment.paymentMethod,
      receiptKey:     payment.receiptKey,
      status:         payment.status,
      buyerDetails:   { name: `${deal.lead.firstName} ${deal.lead.lastName}`, phone: deal.lead.phone, email: deal.lead.email },
      unitDetails:    { unitNumber: deal.unit.unitNumber, type: deal.unit.type, floor: deal.unit.floor },
      projectDetails: (deal.unit as any).project,
    };

    const doc = await createGeneratedDocument({
      type:        "PAYMENT_RECEIPT" as any,
      name:        `RECEIPT — ${deal.dealNumber} — ${payment.milestoneLabel}`,
      dealId:      deal.id,
      leadId:      deal.leadId,
      dataSnapshot,
      createdBy:   req.auth.userId,
    });

    await logActivity({
      dealId:      deal.id,
      leadId:      deal.leadId,
      paymentId:   payment.id,
      type:        "DOC_GENERATED",
      kind:        "DOC_GENERATED",
      summary:     `Receipt generated for payment AED ${payment.amount.toLocaleString()} — "${payment.milestoneLabel}" (${deal.dealNumber})`,
      createdBy:   req.auth.userId,
      createdById: req.auth.userId,
    });

    res.status(201).json({ ...doc, previewUrl: `/payments/${payment.id}/print/receipt?docId=${doc.id}` });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to generate receipt", code: "GENERATE_RECEIPT_ERROR", statusCode: 400 });
  }
});

export default router;
