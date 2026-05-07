import { Router } from "express";
import {
  createTitleDeed,
  updateTitleDeed,
  transitionTitleDeed,
  getTitleDeedsByUnit,
} from "../services/titleDeedService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

// List for a unit
router.get("/unit/:unitId", async (req, res) => {
  try {
    const deeds = await getTitleDeedsByUnit(req.params.unitId);
    res.json({ data: deeds });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createTitleDeed(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updated = await updateTitleDeed(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/:id/transition", async (req, res) => {
  try {
    const updated = await transitionTitleDeed(req.params.id, req.body?.newStatus, userIdFromReq(req));
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
