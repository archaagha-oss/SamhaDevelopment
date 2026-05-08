import { Router } from "express";
import {
  createHandoverChecklist,
  getChecklist,
  getChecklistByDeal,
  updateChecklistItem,
  isChecklistReady,
  completeChecklist,
} from "../services/handoverService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

// ─── Get checklist for a deal (latest) ────────────────────────────────────────
router.get("/deal/:dealId", async (req, res) => {
  try {
    const checklist = await getChecklistByDeal(req.params.dealId);
    if (!checklist) return res.status(404).json({ error: "Checklist not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(checklist);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Get specific checklist by id ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const checklist = await getChecklist(req.params.id);
    if (!checklist) return res.status(404).json({ error: "Checklist not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(checklist);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Force-create a checklist for a deal (idempotent) ─────────────────────────
router.post("/deal/:dealId", async (req, res) => {
  try {
    const checklist = await createHandoverChecklist(req.params.dealId);
    res.status(201).json(checklist);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Update an item ───────────────────────────────────────────────────────────
router.patch("/items/:itemId", async (req, res) => {
  try {
    const updated = await updateChecklistItem(req.params.itemId, req.body, userIdFromReq(req));
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Readiness check (returns pending items) ──────────────────────────────────
router.get("/deal/:dealId/ready", async (req, res) => {
  try {
    const r = await isChecklistReady(req.params.dealId);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Complete the checklist (customer sign-off) ───────────────────────────────
router.post("/:id/complete", async (req, res) => {
  try {
    const { customerName, customerSignatureKey } = req.body ?? {};
    const updated = await completeChecklist(
      req.params.id,
      userIdFromReq(req),
      customerName,
      customerSignatureKey,
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
