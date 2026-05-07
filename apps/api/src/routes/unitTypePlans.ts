import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// List
router.get("/project/:projectId", async (req, res) => {
  try {
    const plans = await prisma.unitTypePlan.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { code: "asc" },
      include: { _count: { select: { units: true } } },
    });
    res.json({ data: plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await prisma.unitTypePlan.create({ data: req.body });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updated = await prisma.unitTypePlan.update({ where: { id: req.params.id }, data: req.body });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const inUse = await prisma.unit.count({ where: { unitTypePlanId: req.params.id } });
    if (inUse > 0) {
      return res.status(409).json({ error: `Cannot delete type plan with ${inUse} units assigned`, code: "PLAN_IN_USE", statusCode: 409 });
    }
    await prisma.unitTypePlan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

export default router;
