import { Router } from "express";
import {
  createKYC,
  updateKYC,
  getKYC,
  getKYCByLead,
  deleteKYC,
} from "../services/kycService";

const router = Router();

const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

// ─── List KYC records for a lead ──────────────────────────────────────────────
router.get("/lead/:leadId", async (req, res) => {
  try {
    const records = await getKYCByLead(req.params.leadId);
    res.json({ data: records });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Get one KYC record ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const record = await getKYC(req.params.id);
    if (!record) return res.status(404).json({ error: "KYC record not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Create KYC for a lead ────────────────────────────────────────────────────
router.post("/lead/:leadId", async (req, res) => {
  try {
    const created = await createKYC(req.params.leadId, req.body, userIdFromReq(req));
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Update a KYC record ──────────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const updated = await updateKYC(req.params.id, req.body, userIdFromReq(req));
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await deleteKYC(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

export default router;
