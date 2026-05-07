import { Router } from "express";
import { setDealParties, getDealParties } from "../services/partyService";

const router = Router();

// ─── List parties on a deal ───────────────────────────────────────────────────
router.get("/deal/:dealId", async (req, res) => {
  try {
    const parties = await getDealParties(req.params.dealId);
    res.json({ data: parties });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Replace parties (atomic, sum-to-100, one PRIMARY) ───────────────────────
router.put("/deal/:dealId", async (req, res) => {
  try {
    const { parties } = req.body as {
      parties: Array<{
        leadId: string;
        role?: "PRIMARY" | "CO_BUYER" | "GUARANTOR";
        ownershipPercentage: number;
      }>;
    };
    const result = await setDealParties(req.params.dealId, parties);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
