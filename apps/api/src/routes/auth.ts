import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { requireAuthentication } from "../middleware/auth";
import {
  login,
  refresh,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getMe,
  AuthError,
} from "../services/authService";
import { refreshTokenMaxAgeMs } from "../lib/jwt";
import { logger } from "../lib/logger";

const router = Router();

const REFRESH_COOKIE = "samha_refresh";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: refreshTokenMaxAgeMs(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({ email: z.string().email() });

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

function handleAuthError(err: unknown, res: Response) {
  if (err instanceof AuthError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
    });
  }
  logger.error("Auth route unexpected error", { err: (err as Error)?.message });
  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  });
}

router.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await login(req.body.email, req.body.password, {
      userAgent: req.get("user-agent") || undefined,
      ip: req.ip,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
    return res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) {
      return res.status(401).json({
        error: "No refresh token",
        code: "NO_REFRESH",
        statusCode: 401,
      });
    }
    const { accessToken } = await refresh(raw);
    return res.json({ accessToken });
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await logout(raw);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: 0 });
    return res.json({ ok: true });
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.post("/forgot-password", validate(forgotSchema), async (req: Request, res: Response) => {
  try {
    await requestPasswordReset(req.body.email);
    return res.json({ ok: true });
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.post("/reset-password", validate(resetSchema), async (req: Request, res: Response) => {
  try {
    await resetPassword(req.body.token, req.body.newPassword);
    return res.json({ ok: true });
  } catch (err) {
    return handleAuthError(err, res);
  }
});

router.post(
  "/change-password",
  requireAuthentication,
  validate(changePasswordSchema),
  async (req: Request, res: Response) => {
    try {
      await changePassword(
        req.auth!.userId,
        req.body.currentPassword,
        req.body.newPassword
      );
      res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: 0 });
      return res.json({ ok: true });
    } catch (err) {
      return handleAuthError(err, res);
    }
  }
);

router.get("/me", requireAuthentication, async (req: Request, res: Response) => {
  try {
    const user = await getMe(req.auth!.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
        statusCode: 404,
      });
    }
    return res.json(user);
  } catch (err) {
    return handleAuthError(err, res);
  }
});

export default router;
