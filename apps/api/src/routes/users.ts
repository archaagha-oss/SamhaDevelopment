import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/auth";

const router = Router();

// Get all users (agents)
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        _count: { select: { assignedLeads: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch users",
      code: "FETCH_USERS_ERROR",
      statusCode: 500,
    });
  }
});

// Get the authenticated user (must come before /:id route)
router.get("/me", async (req, res) => {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  }
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, name: true, email: true, role: true, department: true, phone: true },
    });
    if (!me) return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(me);
  } catch {
    res.status(500).json({ error: "Failed to fetch current user", code: "FETCH_ME_ERROR", statusCode: 500 });
  }
});

// Get user detail
router.get("/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        assignedLeads: true,
        notifications: { orderBy: { createdAt: "desc" }, take: 10 },
        _count: { select: { assignedLeads: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch user",
      code: "FETCH_USER_ERROR",
      statusCode: 500,
    });
  }
});

// Create user — ADMIN only
router.post("/", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { name, email, role, phone, department } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: "name, email, and role are required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    const VALID_ROLES = ["ADMIN", "SALES_AGENT", "OPERATIONS", "FINANCE", "DEVELOPER"];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}`, code: "INVALID_ROLE", statusCode: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "A user with this email already exists", code: "EMAIL_CONFLICT", statusCode: 409 });

    const user = await prisma.user.create({
      data: {
        clerkId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        email,
        role,
        phone: phone || null,
        department: department || null,
      },
    });
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create user", code: "CREATE_USER_ERROR", statusCode: 400 });
  }
});

// Update user — ADMIN only
router.patch("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { name, role, phone, department } = req.body;
    if (role) {
      const VALID_ROLES = ["ADMIN", "SALES_AGENT", "OPERATIONS", "FINANCE", "DEVELOPER"];
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}`, code: "INVALID_ROLE", statusCode: 400 });
      }
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name       !== undefined && { name }),
        ...(role       !== undefined && { role }),
        ...(phone      !== undefined && { phone }),
        ...(department !== undefined && { department }),
      },
      select: { id: true, name: true, email: true, role: true, phone: true, department: true, createdAt: true, updatedAt: true },
    });
    res.json(user);
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    res.status(400).json({ error: error.message || "Failed to update user", code: "UPDATE_USER_ERROR", statusCode: 400 });
  }
});

// Delete user — ADMIN only
router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    res.status(400).json({ error: error.message || "Failed to delete user", code: "DELETE_USER_ERROR", statusCode: 400 });
  }
});

// Get notifications for user
router.get("/:userId/notifications", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch notifications",
      code: "FETCH_NOTIFICATIONS_ERROR",
      statusCode: 500,
    });
  }
});

// Mark notification as read
router.patch("/:userId/notifications/:notificationId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    const notification = await prisma.notification.update({
      where: { id: req.params.notificationId },
      data: { read: true },
    });

    res.json(notification);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update notification",
      code: "NOTIFICATION_UPDATE_ERROR",
      statusCode: 500,
    });
  }
});

export default router;
