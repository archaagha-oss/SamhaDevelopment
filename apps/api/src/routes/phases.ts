import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

// List phases for a project
router.get("/project/:projectId", async (req, res) => {
  try {
    const phases = await prisma.phase.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { units: true } },
      },
    });
    res.json({ data: phases });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await prisma.phase.create({ data: req.body });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const data: any = { ...req.body };
    delete data.releaseStage; // dedicated endpoint

    const updated = await prisma.phase.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// Change release stage with audit trail
router.post("/:id/release-stage", async (req, res) => {
  try {
    const { newStage, reason } = req.body ?? {};
    const phase = await prisma.phase.findUnique({ where: { id: req.params.id } });
    if (!phase) return res.status(404).json({ error: "Phase not found", code: "NOT_FOUND", statusCode: 404 });
    if (newStage === phase.releaseStage) return res.json(phase);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.phase.update({
        where: { id: phase.id },
        data: { releaseStage: newStage, releaseStageAt: new Date() },
      });
      await tx.phaseReleaseHistory.create({
        data: {
          phaseId: phase.id,
          oldStage: phase.releaseStage,
          newStage,
          changedBy: userIdFromReq(req),
          reason: reason ?? null,
        },
      });
      return u;
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const inUse = await prisma.unit.count({ where: { phaseId: req.params.id } });
    if (inUse > 0) {
      return res.status(409).json({ error: `Cannot delete phase with ${inUse} units assigned`, code: "PHASE_IN_USE", statusCode: 409 });
    }
    await prisma.phase.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

export default router;
