import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  resolveCommissionForDeal,
  setCommissionSplits,
  distributeCommissionAmount,
} from "../services/commissionTierService";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const where: any = {};
    if (projectId) where.OR = [{ projectId }, { projectId: null }];
    const rules = await prisma.tieredCommissionRule.findMany({
      where,
      include: { tiers: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ projectId: "desc" }, { priority: "asc" }],
    });
    res.json({ data: rules });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/", async (req, res) => {
  try {
    const { tiers, ...rule } = req.body ?? {};
    const created = await prisma.tieredCommissionRule.create({
      data: {
        ...rule,
        tiers: tiers && Array.isArray(tiers) ? { create: tiers } : undefined,
      },
      include: { tiers: { orderBy: { sortOrder: "asc" } } },
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { tiers, ...rule } = req.body ?? {};
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.tieredCommissionRule.update({ where: { id: req.params.id }, data: rule });
      if (Array.isArray(tiers)) {
        await tx.commissionTier.deleteMany({ where: { ruleId: r.id } });
        await tx.commissionTier.createMany({
          data: tiers.map((t: any, idx: number) => ({ ...t, ruleId: r.id, sortOrder: t.sortOrder ?? idx })),
        });
      }
      return tx.tieredCommissionRule.findUnique({
        where: { id: r.id },
        include: { tiers: { orderBy: { sortOrder: "asc" } } },
      });
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.tieredCommissionRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.get("/resolve/deal/:dealId", async (req, res) => {
  try {
    const r = await resolveCommissionForDeal(req.params.dealId);
    res.json({ resolved: r });
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.put("/splits/deal/:dealId", async (req, res) => {
  try {
    const splits = await setCommissionSplits(req.params.dealId, req.body?.splits ?? []);
    res.json({ data: splits });
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.post("/splits/deal/:dealId/distribute", async (req, res) => {
  try {
    const updated = await distributeCommissionAmount(req.params.dealId, Number(req.body?.totalAmount));
    res.json({ data: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
