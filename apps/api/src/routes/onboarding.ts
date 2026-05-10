import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

/**
 * Onboarding status — tells the dashboard which day-1 setup steps are still
 * outstanding so it can render an onboarding checklist.
 *
 * The shape is a flat object of booleans rather than counts. The dashboard
 * doesn't care if the org has 1 or 50 projects — it cares whether the user
 * has crossed the "from zero" threshold for each onboarding step. Counts
 * would force the frontend to compare > 0 and tempt callers to render
 * meaningless "you have 47 leads!" copy.
 *
 * All four checks run in parallel and use Prisma's `findFirst({ select:
 * { id: true } })` rather than `count` — for the typical 0-or-many case
 * we only need to know if AT LEAST ONE row exists, which is dramatically
 * cheaper than COUNT(*) on a large table once the org grows.
 */
router.get("/status", async (_req, res) => {
  try {
    const [project, unit, plan, lead, userCount] = await Promise.all([
      prisma.project.findFirst({ select: { id: true } }),
      prisma.unit.findFirst({ select: { id: true } }),
      prisma.paymentPlan.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.lead.findFirst({ select: { id: true } }),
      prisma.user.count(),
    ]);

    res.json({
      hasProject: !!project,
      hasUnit: !!unit,
      hasPaymentPlan: !!plan,
      hasLead: !!lead,
      hasTeam: userCount > 1,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch onboarding status",
      code: "FETCH_ONBOARDING_ERROR",
      statusCode: 500,
    });
  }
});

export default router;
