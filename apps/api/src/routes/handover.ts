import { Router } from "express";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { updateChecklistItemSchema } from "../schemas/validation";
import {
  getOrCreateChecklist,
  updateItem,
  markChecklistComplete,
  HandoverError,
} from "../services/handoverService";

const router = Router();

// Handover is an internal CRM operation — every endpoint requires auth.
router.use(requireAuthentication);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callerId(req: any): string {
  return req.resolvedUser?.id ?? req.auth!.userId;
}

function sendError(res: any, err: any) {
  if (err instanceof HandoverError) {
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
// GET /:dealId — get-or-seed the checklist
// ---------------------------------------------------------------------------

router.get("/:dealId", async (req, res) => {
  try {
    const checklist = await getOrCreateChecklist(req.params.dealId, req.auth!.userId);
    res.json(checklist);
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /items/:itemId — toggle item / set notes
// ---------------------------------------------------------------------------

router.patch(
  "/items/:itemId",
  requireRole(["ADMIN", "MANAGER"]),
  validate(updateChecklistItemSchema),
  async (req, res) => {
    try {
      const item = await updateItem(req.params.itemId, req.body, callerId(req));
      res.json(item);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:dealId/complete — mark checklist complete + bump deal to COMPLETED
// ---------------------------------------------------------------------------
//
// Note: the route is keyed by dealId for a clean URL contract. The service
// layer is keyed by checklistId, so we resolve the checklist first.

router.post(
  "/:dealId/complete",
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      // Ensure a checklist exists (no-op if it already does).
      const checklist = await getOrCreateChecklist(req.params.dealId, req.auth!.userId);
      const updated   = await markChecklistComplete(checklist.id, callerId(req));
      res.json(updated);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

export default router;
