import { Router } from "express";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  updateConstructionMilestoneSchema,
  createConstructionMilestoneSchema,
} from "../schemas/validation";
import {
  getProjectProgress,
  updateMilestone,
  createMilestone,
  deleteMilestone,
  ConstructionError,
} from "../services/constructionService";

const router = Router();

// Construction tracking is an internal CRM operation — every endpoint
// requires auth. Writes are additionally gated to ADMIN/MANAGER.
router.use(requireAuthentication);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callerId(req: any): string {
  return req.resolvedUser?.id ?? req.auth!.userId;
}

function sendError(res: any, err: any) {
  if (err instanceof ConstructionError) {
    return res.status(err.statusCode).json({
      error:      err.message,
      code:       err.code,
      statusCode: err.statusCode,
    });
  }
  return res.status(500).json({
    error:      err?.message ?? "Internal server error",
    code:       "INTERNAL_ERROR",
    statusCode: 500,
  });
}

// ---------------------------------------------------------------------------
// GET /:projectId — composite read (seeds on first access)
// ---------------------------------------------------------------------------

router.get("/:projectId", async (req, res) => {
  try {
    const data = await getProjectProgress(req.params.projectId);
    res.json(data);
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /milestones/:id — update progress / dates / notes / label
// ---------------------------------------------------------------------------

router.patch(
  "/milestones/:id",
  requireRole(["ADMIN", "MANAGER"]),
  validate(updateConstructionMilestoneSchema),
  async (req, res) => {
    try {
      const result = await updateMilestone(req.params.id, req.body, callerId(req));
      // Response shape: { ...milestone, paymentsTriggered: [...] }. The
      // milestone fields are spread onto the top level so legacy callers that
      // read e.g. `res.data.progressPercent` keep working; `paymentsTriggered`
      // is a sibling array of { paymentId, dealId, amount, threshold }.
      res.json({ ...result.milestone, paymentsTriggered: result.paymentsTriggered });
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:projectId/milestones — add a custom milestone
// ---------------------------------------------------------------------------

router.post(
  "/:projectId/milestones",
  requireRole(["ADMIN", "MANAGER"]),
  validate(createConstructionMilestoneSchema),
  async (req, res) => {
    try {
      const milestone = await createMilestone(req.params.projectId, req.body, callerId(req));
      res.status(201).json(milestone);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /milestones/:id
// ---------------------------------------------------------------------------

router.delete(
  "/milestones/:id",
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const result = await deleteMilestone(req.params.id);
      res.json(result);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

export default router;
