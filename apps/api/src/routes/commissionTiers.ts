import { Router } from "express";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  createCommissionTierRuleSchema,
  updateCommissionTierRuleSchema,
  setCommissionSplitsSchema,
} from "../schemas/validation";
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  resolveForDeal,
  setSplitsForDeal,
  CommissionTierError,
} from "../services/commissionTierService";

const router = Router();

// Commission-tier configuration is an internal CRM operation — every
// endpoint requires auth. Writes additionally require ADMIN or MANAGER.
router.use(requireAuthentication);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callerId(req: any): string {
  return req.resolvedUser?.id ?? req.auth!.userId;
}

function sendError(res: any, err: any) {
  if (err instanceof CommissionTierError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
    });
  }
  return res.status(500).json({
    error: err?.message ?? "Internal server error",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  });
}

// ---------------------------------------------------------------------------
// GET / — list rules (optionally scoped to a project)
// ---------------------------------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const projectId =
      typeof req.query.projectId === "string" && req.query.projectId.length > 0
        ? req.query.projectId
        : undefined;
    const rules = await listRules({ projectId });
    res.json({ data: rules });
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST / — create rule (ADMIN / MANAGER)
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireRole(["ADMIN", "MANAGER"]),
  validate(createCommissionTierRuleSchema),
  async (req, res) => {
    try {
      const rule = await createRule(req.body, callerId(req));
      res.status(201).json(rule);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:id — update rule (ADMIN / MANAGER)
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireRole(["ADMIN", "MANAGER"]),
  validate(updateCommissionTierRuleSchema),
  async (req, res) => {
    try {
      const rule = await updateRule(req.params.id, req.body);
      res.json(rule);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:id — delete rule (ADMIN / MANAGER)
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const result = await deleteRule(req.params.id);
      res.json(result);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /resolve/deal/:dealId — resolve best-fitting rule + tier for a deal
// ---------------------------------------------------------------------------

router.get("/resolve/deal/:dealId", async (req, res) => {
  try {
    const result = await resolveForDeal(req.params.dealId);
    res.json(result);
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PUT /splits/deal/:dealId — replace splits (ADMIN / MANAGER)
// ---------------------------------------------------------------------------

router.put(
  "/splits/deal/:dealId",
  requireRole(["ADMIN", "MANAGER"]),
  validate(setCommissionSplitsSchema),
  async (req, res) => {
    try {
      const splits = await setSplitsForDeal(
        req.params.dealId,
        req.body.splits,
        callerId(req),
      );
      res.json({ data: splits });
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

export default router;
