import { Router } from "express";
import {
  createInvoice,
  createInvoiceForPayment,
  issueInvoice,
  markInvoicePaid,
  cancelInvoice,
  getInvoice,
  listInvoicesForDeal,
} from "../services/invoiceService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

router.get("/deal/:dealId", async (req, res) => {
  try {
    const list = await listInvoicesForDeal(req.params.dealId);
    res.json({ data: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const inv = await getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: "Invoice not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const inv = await createInvoice(req.body, userIdFromReq(req));
    res.status(201).json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/from-payment/:paymentId", async (req, res) => {
  try {
    const inv = await createInvoiceForPayment(req.params.paymentId, userIdFromReq(req));
    res.status(201).json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/:id/issue", async (req, res) => {
  try {
    const inv = await issueInvoice(req.params.id);
    res.json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/:id/mark-paid", async (req, res) => {
  try {
    const inv = await markInvoicePaid(req.params.id);
    res.json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const inv = await cancelInvoice(req.params.id);
    res.json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
