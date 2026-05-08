import { Router } from "express";
import {
  requestRefund,
  transitionRefund,
  getRefund,
  listRefundsForDeal,
  listOpenRefunds,
} from "../services/refundService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

router.get("/", async (_req, res) => {
  try {
    const list = await listOpenRefunds();
    res.json({ data: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.get("/deal/:dealId", async (req, res) => {
  try {
    const list = await listRefundsForDeal(req.params.dealId);
    res.json({ data: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const r = await getRefund(req.params.id);
    if (!r) return res.status(404).json({ error: "Refund not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const r = await requestRefund(req.body, userIdFromReq(req));
    res.status(201).json(r);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/:id/transition", async (req, res) => {
  try {
    const r = await transitionRefund(
      req.params.id,
      req.body?.newStatus,
      userIdFromReq(req),
      {
        rejectedReason: req.body?.rejectedReason,
        processedReference: req.body?.processedReference,
        comment: req.body?.comment,
      },
    );
    res.json(r);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
