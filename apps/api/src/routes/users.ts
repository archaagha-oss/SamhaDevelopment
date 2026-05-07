import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { generateTempPassword, hashPassword, passwordMeetsPolicy } from "../lib/password";
import { authLogger } from "../lib/logger";

const router = Router();

const VALID_ROLES = ["ADMIN", "SALES_AGENT", "OPERATIONS", "FINANCE", "DEVELOPER"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

// All user-management endpoints require authentication
router.use(requireAuthentication);

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  department: true,
  isActive: true,
  lastLoginAt: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

// List users (any authenticated user — UI needs assignee picker)
router.get("/", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        ...PUBLIC_FIELDS,
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

router.get("/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        ...PUBLIC_FIELDS,
        notifications: { orderBy: { createdAt: "desc" }, take: 10 },
        _count: { select: { assignedLeads: true } },
      },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
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

const CreateUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  role: z.enum(VALID_ROLES),
  phone: z.string().max(40).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  password: z.string().min(8).max(200).optional(),
});

// Create user (ADMIN only). Returns a one-time temporary password if not provided.
router.post("/", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }
    const { name, email, role, phone, department } = parsed.data;
    const normalisedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });
    if (existing) {
      return res.status(409).json({
        error: "A user with this email already exists",
        code: "EMAIL_CONFLICT",
        statusCode: 409,
      });
    }

    let password = parsed.data.password;
    let generated = false;
    if (!password) {
      password = generateTempPassword();
      generated = true;
    } else {
      const policy = passwordMeetsPolicy(password);
      if (!policy.ok) {
        return res.status(400).json({ error: policy.reason, code: "WEAK_PASSWORD", statusCode: 400 });
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalisedEmail,
        role: role as ValidRole,
        phone: phone || null,
        department: department || null,
        passwordHash,
        mustChangePassword: true,
      },
      select: PUBLIC_FIELDS,
    });

    authLogger.info("User created", {
      adminId: req.auth?.userId,
      newUserId: user.id,
      role: user.role,
    });

    res.status(201).json({
      user,
      // Returned exactly once so the admin can hand it to the new user.
      temporaryPassword: generated ? password : undefined,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || "Failed to create user",
      code: "CREATE_USER_ERROR",
      statusCode: 400,
    });
  }
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(VALID_ROLES).optional(),
  phone: z.string().max(40).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  isActive: z.boolean().optional(),
});

router.patch("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }

    // Prevent an admin from disabling/demoting themselves and locking everyone out
    if (req.params.id === req.auth?.userId) {
      if (parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== "ADMIN")) {
        return res.status(400).json({
          error: "Admins cannot disable or demote their own account",
          code: "SELF_LOCKOUT",
          statusCode: 400,
        });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: PUBLIC_FIELDS,
    });
    res.json(user);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.status(400).json({
      error: error.message || "Failed to update user",
      code: "UPDATE_USER_ERROR",
      statusCode: 400,
    });
  }
});

// Reset password — ADMIN only. Returns new temp password (one-time display).
router.post("/:id/reset-password", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    authLogger.info("Password reset", { adminId: req.auth?.userId, userId: user.id });
    res.json({ temporaryPassword: tempPassword });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || "Failed to reset password",
      code: "RESET_PASSWORD_ERROR",
      statusCode: 400,
    });
  }
});

// Soft-disable instead of hard delete (preserves audit history)
router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    if (req.params.id === req.auth?.userId) {
      return res.status(400).json({
        error: "Admins cannot delete their own account",
        code: "SELF_LOCKOUT",
        statusCode: 400,
      });
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    authLogger.info("User disabled", { adminId: req.auth?.userId, userId: req.params.id });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.status(400).json({
      error: error.message || "Failed to disable user",
      code: "DELETE_USER_ERROR",
      statusCode: 400,
    });
  }
});

router.get("/:userId/notifications", async (req, res) => {
  try {
    if (req.auth?.userId !== req.params.userId && req.auth?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN", statusCode: 403 });
    }
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

router.patch("/:userId/notifications/:notificationId", async (req, res) => {
  try {
    if (req.auth?.userId !== req.params.userId && req.auth?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN", statusCode: 403 });
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
