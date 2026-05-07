import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  hashPassword,
  passwordMeetsPolicy,
  verifyPassword,
} from "../lib/password";
import { signSessionToken } from "../lib/jwt";
import { setSessionCookie, clearSessionCookie } from "../lib/cookies";
import { authLogger } from "../lib/logger";
import { requireAuthentication } from "../middleware/auth";

const router = Router();

const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Email and password are required",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Constant-ish behaviour: never reveal whether the email exists
    const invalid = () =>
      res.status(401).json({
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });

    if (!user) {
      // Run a dummy compare to keep timing consistent
      await verifyPassword(password, "$2a$10$invalidinvalidinvalidinvalidinvaliduuuuuuuuuuuuuuuuuuu");
      authLogger.warn("Login failed: unknown email", { email });
      return invalid();
    }

    if (!user.isActive) {
      authLogger.warn("Login blocked: inactive account", { userId: user.id });
      return res.status(401).json({
        error: "Account is disabled. Contact your administrator.",
        code: "ACCOUNT_DISABLED",
        statusCode: 401,
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      authLogger.warn("Login blocked: account locked", {
        userId: user.id,
        lockedUntil: user.lockedUntil,
      });
      return res.status(401).json({
        error: "Too many failed attempts. Try again later.",
        code: "ACCOUNT_LOCKED",
        statusCode: 401,
      });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLoginAttempts + 1;
      const shouldLock = failed >= LOGIN_LOCK_THRESHOLD;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failed,
          lockedUntil: shouldLock ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS) : null,
        },
      });
      authLogger.warn("Login failed: bad password", { userId: user.id, failed });
      return invalid();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const token = signSessionToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
    setSessionCookie(res, token);

    authLogger.info("Login success", { userId: user.id, role: user.role });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  if (req.auth?.userId) {
    authLogger.info("Logout", { userId: req.auth.userId });
  }
  return res.json({ ok: true });
});

router.get("/me", requireAuthentication, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        department: true,
        mustChangePassword: true,
        isActive: true,
        lastLoginAt: true,
      },
    });
    if (!user || !user.isActive) {
      clearSessionCookie(res);
      return res.status(401).json({
        error: "Session no longer valid",
        code: "ACCOUNT_DISABLED",
        statusCode: 401,
      });
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

router.post("/change-password", requireAuthentication, async (req, res, next) => {
  try {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "currentPassword and newPassword are required",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }
    const { currentPassword, newPassword } = parsed.data;

    const policy = passwordMeetsPolicy(newPassword);
    if (!policy.ok) {
      return res.status(400).json({
        error: policy.reason,
        code: "WEAK_PASSWORD",
        statusCode: 400,
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Session no longer valid",
        code: "ACCOUNT_DISABLED",
        statusCode: 401,
      });
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      authLogger.warn("Change-password failed: wrong current password", { userId: user.id });
      return res.status(401).json({
        error: "Current password is incorrect",
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      return res.status(400).json({
        error: "New password must be different from the current one",
        code: "PASSWORD_REUSED",
        statusCode: 400,
      });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    authLogger.info("Password changed", { userId: user.id });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
