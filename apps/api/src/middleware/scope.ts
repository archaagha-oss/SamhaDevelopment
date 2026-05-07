// ---------------------------------------------------------------------------
// scopeFilter — minimal multi-tenancy guard for Task/Activity queries.
//
// Behavior:
//   - If the user is ADMIN or has no UserProjectAccess rows, no scoping (admin / dev).
//   - Otherwise, returns a Prisma `where` clause that limits rows to leads /
//     deals / units belonging to projects the user has access to.
//
// Tasks and Activities don't carry projectId directly — we filter via their
// polymorphic FKs (leadId/dealId/unitId). Rows with no project link (rare,
// e.g. orphan tasks) are visible to all to avoid losing audit history.
// ---------------------------------------------------------------------------

import { prisma } from "../lib/prisma";

export interface ScopeWhere {
  OR?: any[];
}

/**
 * Build a Prisma `where` fragment scoping by the user's project access.
 * Returns `null` for unscoped (admin / dev / no access rows).
 */
export async function buildProjectScope(userId: string): Promise<ScopeWhere | null> {
  if (!userId || userId === "dev-user-1" || userId === "system") return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  }).catch(() => null);
  if (!user) return null;
  if (user.role === "ADMIN" || user.role === "DEVELOPER") return null;

  const access = await prisma.userProjectAccess.findMany({
    where: { userId },
    select: { projectId: true },
  });
  if (access.length === 0) return null;

  const projectIds = access.map((a) => a.projectId);

  // Match rows whose linked entity belongs to one of the projects.
  return {
    OR: [
      { lead:  { projectId: { in: projectIds } } },
      { deal:  { unit: { projectId: { in: projectIds } } } },
      { unit:  { projectId: { in: projectIds } } },
      // Unscoped rows (no entity link) — visible to everyone.
      { AND: [{ leadId: null }, { dealId: null }, { unitId: null }] },
    ],
  };
}
