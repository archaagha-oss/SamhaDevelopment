/**
 * Compliance / Expiry radar API.
 *
 *   GET /api/compliance/expiring                — every credential expiring within horizon
 *   GET /api/compliance/expiring/counts         — { EXPIRED, CRITICAL, WARNING, ATTENTION, OK }
 *   GET /api/compliance/deal/:id/blockers       — issues touching this deal (warning+)
 */

import { Router } from "express";
import {
  collectExpiries,
  dealBlockers,
  severityCounts,
  type Severity,
} from "../services/complianceService.js";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

router.get("/expiring", async (req, res) => {
  try {
    const withinDays = req.query.withinDays ? Math.max(1, Math.min(730, parseInt(req.query.withinDays as string, 10) || 365)) : 365;
    const minSeverity = (req.query.minSeverity as Severity | undefined) ?? "ATTENTION";
    const category = (req.query.category as ("BROKER" | "AGENT" | "BUYER") | undefined);

    const rows = await collectExpiries({ withinDays, minSeverity, category });
    res.json({ data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load compliance", code: "COMPLIANCE_LIST_ERROR", statusCode: 500 });
  }
});

router.get("/expiring/counts", async (_req, res) => {
  try {
    const rows = await collectExpiries({ minSeverity: "ATTENTION" });
    res.json(severityCounts(rows));
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to count", code: "COMPLIANCE_COUNTS_ERROR", statusCode: 500 });
  }
});

router.get("/deal/:id/blockers", async (req, res) => {
  try {
    const rows = await dealBlockers(req.params.id);
    res.json({ data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to compute blockers", code: "COMPLIANCE_BLOCKER_ERROR", statusCode: 500 });
  }
});

export default router;
