/**
 * snags.ts — Routes for the snag list backend.
 *
 * Mounted at /api/snags. All endpoints require authentication. Reads are
 * open to every authenticated role (VIEWER included); writes are gated to
 * ADMIN, MANAGER, and MEMBER (matches the handover pattern's write/read split).
 */

import { Router } from "express";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  createSnagListSchema,
  addSnagItemSchema,
  updateSnagStatusSchema,
  addSnagPhotoSchema,
} from "../schemas/validation";
import {
  listForUnit,
  createList,
  addItem,
  setItemStatus,
  addPhoto,
  deletePhoto,
  deleteItem,
  SnagError,
} from "../services/snagService";

const router = Router();

// Every snag endpoint requires authentication.
router.use(requireAuthentication);

// Writes require an internal role. Reads (GET) allow viewers — they fall
// through this guard via the requireRole-on-individual-routes pattern below.
const requireWriteRole = requireRole(["ADMIN", "MANAGER", "MEMBER"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callerId(req: any): string {
  return req.resolvedUser?.id ?? req.auth!.userId;
}

function sendError(res: any, err: any) {
  if (err instanceof SnagError) {
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
// GET /unit/:unitId — list snag lists for a unit (read; viewers allowed)
// ---------------------------------------------------------------------------

router.get("/unit/:unitId", async (req, res) => {
  try {
    const lists = await listForUnit(req.params.unitId);
    res.json({ data: lists });
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /unit/:unitId — create a new snag list
// ---------------------------------------------------------------------------

router.post(
  "/unit/:unitId",
  requireWriteRole,
  validate(createSnagListSchema),
  async (req, res) => {
    try {
      const list = await createList(
        req.params.unitId,
        req.body.label,
        callerId(req),
      );
      res.status(201).json(list);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:listId/items — add an item to a list
// ---------------------------------------------------------------------------

router.post(
  "/:listId/items",
  requireWriteRole,
  validate(addSnagItemSchema),
  async (req, res) => {
    try {
      const item = await addItem(req.params.listId, req.body, callerId(req));
      res.status(201).json(item);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /items/:itemId/status — transition an item's status
// ---------------------------------------------------------------------------

router.patch(
  "/items/:itemId/status",
  requireWriteRole,
  validate(updateSnagStatusSchema),
  async (req, res) => {
    try {
      const { status, rejectionReason, fixedDate } = req.body;
      const item = await setItemStatus(
        req.params.itemId,
        status,
        { rejectionReason, fixedDate },
        callerId(req),
      );
      res.json(item);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /items/:itemId/photos — attach a photo to an item
// ---------------------------------------------------------------------------

router.post(
  "/items/:itemId/photos",
  requireWriteRole,
  validate(addSnagPhotoSchema),
  async (req, res) => {
    try {
      const photo = await addPhoto(req.params.itemId, req.body, callerId(req));
      res.status(201).json(photo);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /photos/:photoId
// ---------------------------------------------------------------------------

router.delete(
  "/photos/:photoId",
  requireWriteRole,
  async (req, res) => {
    try {
      const result = await deletePhoto(req.params.photoId);
      res.json(result);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /items/:itemId
// ---------------------------------------------------------------------------

router.delete(
  "/items/:itemId",
  requireWriteRole,
  async (req, res) => {
    try {
      const result = await deleteItem(req.params.itemId);
      res.json(result);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

export default router;
