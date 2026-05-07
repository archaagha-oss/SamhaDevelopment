import { Router } from "express";
import {
  createMilestone,
  listMilestonesForProject,
  updateMilestonePercent,
} from "../services/constructionService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

router.get("/project/:projectId", async (req, res) => {
  try {
    const milestones = await listMilestonesForProject(req.params.projectId);
    res.json({ data: milestones });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const m = await createMilestone(req.body);
    res.status(201).json(m);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.patch("/:id/percent", async (req, res) => {
  try {
    const result = await updateMilestonePercent(
      req.params.id,
      Number(req.body?.percentComplete),
      userIdFromReq(req),
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
