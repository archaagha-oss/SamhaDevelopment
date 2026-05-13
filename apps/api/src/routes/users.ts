import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireRole, requireAuthentication } from "../middleware/auth";

const router = Router();

const VALID_ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
const VALID_STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "DEACTIVATED"] as const;
const VALID_EMPLOYMENT = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;

// In-memory throttle for the User.lastLoginAt write triggered by /me hits.
// Per-user, capped at one DB write per hour. Single-instance app (no Redis
// needed); restart resets the cache, which simply produces one extra write
// per active user on next request — harmless.
const lastLoginStamped = new Map<string, number>();

const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  jobTitle: true,
  status: true,
  phone: true,
  avatarUrl: true,
  employeeId: true,
  employmentType: true,
  joinedAt: true,
  lastSeenAt: true,
  createdAt: true,
  manager: { select: { id: true, name: true, email: true } },
  _count:  { select: { assignedLeads: true, reports: true } },
} satisfies Prisma.UserSelect;

// ─── Get the calling user (canonical role source) ───────────────────────────
// Frontend calls this on app load instead of trusting localStorage. The
// returned role is what the API enforces; mismatched local UI hints become
// irrelevant.
router.get("/me", requireAuthentication, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const user = await prisma.user.findFirst({
      where: { clerkId: userId },
      select: {
        id: true,
        clerkId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        jobTitle: true,
        avatarUrl: true,
        phone: true,
        managerId: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: "User account not found", code: "USER_NOT_FOUND", statusCode: 404 });
    }
    // Stamp lastLoginAt on each /me hit, but throttle to once per hour per
    // user so an active SPA polling /me doesn't write a row on every render.
    // Fire-and-forget — we don't block the response on this audit write.
    const lastSeen = lastLoginStamped.get(user.id);
    const now = Date.now();
    if (!lastSeen || now - lastSeen > 60 * 60 * 1000) {
      lastLoginStamped.set(user.id, now);
      prisma.user
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        .catch(() => { /* swallow — non-critical */ });
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user", code: "FETCH_ME_ERROR", statusCode: 500 });
  }
});

// ─── List with filters ────────────────────────────────────────────────────────
// Filters: ?role=, ?managerId=, ?status=, ?search=
router.get("/", requireAuthentication, async (req, res) => {
  try {
    const { role, managerId, status, search } = req.query as Record<string, string | undefined>;

    const where: Prisma.UserWhereInput = {};
    if (role && VALID_ROLES.includes(role as any))         where.role      = role as any;
    if (status && VALID_STATUSES.includes(status as any))  where.status    = status as any;
    if (managerId === "none")                              where.managerId = null;
    else if (managerId)                                    where.managerId = managerId;
    if (search) {
      where.OR = [
        { name:     { contains: search } },
        { email:    { contains: search } },
        { jobTitle: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users", code: "FETCH_USERS_ERROR", statusCode: 500 });
  }
});

// (The canonical "whoami" endpoint is defined above at the top of this file.
// A previous duplicate handler that fell back to the first ADMIN in dev has
// been removed — that fallback was a security hazard analogous to the
// dev-mode role bypass closed in middleware/auth.ts.)

// ─── Get user detail ──────────────────────────────────────────────────────────
router.get("/:id", requireAuthentication, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        manager:       { select: { id: true, name: true, email: true, jobTitle: true } },
        reports:       { select: { id: true, name: true, email: true, jobTitle: true, status: true, avatarUrl: true } },
        assignedLeads: true,
        notifications: { orderBy: { createdAt: "desc" }, take: 10 },
        _count:        { select: { assignedLeads: true, assignedUnits: true, tasks: true, reports: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user", code: "FETCH_USER_ERROR", statusCode: 500 });
  }
});

// ─── Direct reports tree ──────────────────────────────────────────────────────
router.get("/:id/reports", requireAuthentication, async (req, res) => {
  try {
    const reports = await prisma.user.findMany({
      where: { managerId: req.params.id },
      select: userListSelect,
      orderBy: { name: "asc" },
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports", code: "FETCH_REPORTS_ERROR", statusCode: 500 });
  }
});

// ─── Create user — ADMIN only ─────────────────────────────────────────────────
router.post("/", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const {
      name, email, role,
      jobTitle, managerId,
      status, employeeId, employmentType, joinedAt,
      phone, avatarUrl,
    } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: "name, email, and role are required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}`, code: "INVALID_ROLE", statusCode: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}`, code: "INVALID_STATUS", statusCode: 400 });
    }
    if (employmentType && !VALID_EMPLOYMENT.includes(employmentType)) {
      return res.status(400).json({ error: `employmentType must be one of: ${VALID_EMPLOYMENT.join(", ")}`, code: "INVALID_EMPLOYMENT", statusCode: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "A user with this email already exists", code: "EMAIL_CONFLICT", statusCode: 409 });

    if (employeeId) {
      const eidConflict = await prisma.user.findUnique({ where: { employeeId } });
      if (eidConflict) return res.status(409).json({ error: "A user with this employee ID already exists", code: "EMPLOYEE_ID_CONFLICT", statusCode: 409 });
    }

    const user = await prisma.user.create({
      data: {
        clerkId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        email,
        role,
        jobTitle:       jobTitle       || null,
        managerId:      managerId      || null,
        status:         status         || "ACTIVE",
        employeeId:     employeeId     || null,
        employmentType: employmentType || null,
        joinedAt:       joinedAt ? new Date(joinedAt) : null,
        phone:          phone          || null,
        avatarUrl:      avatarUrl      || null,
      },
      select: userListSelect,
    });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create user", code: "CREATE_USER_ERROR", statusCode: 400 });
  }
});

// ─── Update user — ADMIN only ─────────────────────────────────────────────────
router.patch("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const {
      name, role,
      jobTitle, managerId,
      status, employeeId, employmentType, joinedAt,
      phone, avatarUrl,
    } = req.body;

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}`, code: "INVALID_ROLE", statusCode: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}`, code: "INVALID_STATUS", statusCode: 400 });
    }
    if (employmentType && !VALID_EMPLOYMENT.includes(employmentType)) {
      return res.status(400).json({ error: `employmentType must be one of: ${VALID_EMPLOYMENT.join(", ")}`, code: "INVALID_EMPLOYMENT", statusCode: 400 });
    }
    if (managerId === req.params.id) {
      return res.status(400).json({ error: "A user cannot be their own manager", code: "INVALID_MANAGER", statusCode: 400 });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name           !== undefined && { name }),
        ...(role           !== undefined && { role }),
        ...(jobTitle       !== undefined && { jobTitle:       jobTitle     || null }),
        ...(managerId      !== undefined && { managerId:      managerId    || null }),
        ...(status         !== undefined && { status }),
        ...(employeeId     !== undefined && { employeeId:     employeeId   || null }),
        ...(employmentType !== undefined && { employmentType: employmentType || null }),
        ...(joinedAt       !== undefined && { joinedAt:       joinedAt ? new Date(joinedAt) : null }),
        ...(phone          !== undefined && { phone:          phone        || null }),
        ...(avatarUrl      !== undefined && { avatarUrl:      avatarUrl    || null }),
      },
      select: userListSelect,
    });
    res.json(user);
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    if (err.code === "P2002") return res.status(409).json({ error: "Employee ID already in use", code: "EMPLOYEE_ID_CONFLICT", statusCode: 409 });
    res.status(400).json({ error: err.message || "Failed to update user", code: "UPDATE_USER_ERROR", statusCode: 400 });
  }
});

// ─── Deactivate user — ADMIN only (soft delete preferred over hard delete) ────
router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    // Default to soft-deactivate to preserve audit trail and FK references.
    // Pass ?hard=true to actually delete (will fail if user owns records).
    const hard = req.query.hard === "true";

    if (hard) {
      await prisma.user.delete({ where: { id: req.params.id } });
      return res.json({ success: true, deleted: true });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "DEACTIVATED" },
      select: { id: true, name: true, email: true, status: true },
    });
    res.json({ success: true, deactivated: true, user });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    res.status(400).json({ error: err.message || "Failed to deactivate user", code: "DELETE_USER_ERROR", statusCode: 400 });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────
router.get("/:userId/notifications", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications", code: "FETCH_NOTIFICATIONS_ERROR", statusCode: 500 });
  }
});

router.patch("/:userId/notifications/:notificationId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const notification = await prisma.notification.update({
      where: { id: req.params.notificationId },
      data: { read: true },
    });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Failed to update notification", code: "NOTIFICATION_UPDATE_ERROR", statusCode: 500 });
  }
});

export default router;
