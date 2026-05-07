import { Router } from "express";
import {
  createSnagList,
  getSnagListsForUnit,
  addSnagItem,
  updateSnagStatus,
  attachSnagPhoto,
  deleteSnagPhoto,
  deleteSnagItem,
} from "../services/snagService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

// ─── Lists for a unit ─────────────────────────────────────────────────────────
router.get("/unit/:unitId", async (req, res) => {
  try {
    const lists = await getSnagListsForUnit(req.params.unitId);
    res.json({ data: lists });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Create a snag list on a unit ─────────────────────────────────────────────
router.post("/unit/:unitId", async (req, res) => {
  try {
    const list = await createSnagList(req.params.unitId, req.body?.label);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Add an item ──────────────────────────────────────────────────────────────
router.post("/:listId/items", async (req, res) => {
  try {
    const item = await addSnagItem(req.params.listId, req.body, userIdFromReq(req));
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Update item status ───────────────────────────────────────────────────────
router.patch("/items/:itemId/status", async (req, res) => {
  try {
    const updated = await updateSnagStatus(
      req.params.itemId,
      req.body?.status,
      userIdFromReq(req),
      { rejectionReason: req.body?.rejectionReason, fixedDate: req.body?.fixedDate },
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// ─── Attach a photo (key already uploaded to S3 by client) ────────────────────
router.post("/items/:itemId/photos", async (req, res) => {
  try {
    const photo = await attachSnagPhoto(
      req.params.itemId,
      req.body?.s3Key,
      req.body?.caption,
      (req.body?.kind ?? "BEFORE") as "BEFORE" | "AFTER",
    );
    res.status(201).json(photo);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.delete("/photos/:photoId", async (req, res) => {
  try {
    await deleteSnagPhoto(req.params.photoId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.delete("/items/:itemId", async (req, res) => {
  try {
    await deleteSnagItem(req.params.itemId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

export default router;
