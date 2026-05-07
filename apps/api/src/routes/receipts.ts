import { Router } from "express";
import { createReceipt, listReceiptsForDeal } from "../services/receiptService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

router.get("/deal/:dealId", async (req, res) => {
  try {
    const list = await listReceiptsForDeal(req.params.dealId);
    res.json({ data: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const r = await createReceipt(req.body, userIdFromReq(req));
    res.status(201).json(r);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
