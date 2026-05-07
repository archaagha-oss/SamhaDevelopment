import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  signAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
  refreshTokenExpiry,
  resetTokenExpiry,
} from "../lib/jwt";
import { logger } from "../lib/logger";
import { sendEmail } from "./mailerService";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class AuthError extends Error {
  constructor(public code: string, public statusCode: number, message: string) {
    super(message);
  }
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string; mustChangePassword: boolean };
}

export async function login(
  email: string,
  password: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", 401, "Invalid email or password");
  }
  if (!user.isActive) {
    throw new AuthError("ACCOUNT_DISABLED", 403, "Account is disabled");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError(
      "ACCOUNT_LOCKED",
      423,
      `Account locked. Try again after ${user.lockedUntil.toISOString()}`
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock =
      failed >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failed, lockedUntil: lock },
    });
    throw new AuthError("INVALID_CREDENTIALS", 401, "Invalid email or password");
  }

  const { raw, hash } = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: refreshTokenExpiry(),
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return {
    accessToken,
    refreshToken: raw,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function refresh(rawToken: string): Promise<{ accessToken: string }> {
  const tokenHash = hashOpaqueToken(rawToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new AuthError("INVALID_REFRESH", 401, "Refresh token invalid or expired");
  }
  if (!record.user.isActive) {
    throw new AuthError("ACCOUNT_DISABLED", 403, "Account is disabled");
  }

  const accessToken = signAccessToken({ sub: record.user.id, role: record.user.role });
  return { accessToken };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashOpaqueToken(rawToken);
  await prisma.refreshToken
    .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("USER_NOT_FOUND", 404, "User not found");

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new AuthError("INVALID_CREDENTIALS", 401, "Current password is incorrect");

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });
  await logoutAllSessions(userId);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  // Always succeed silently to avoid leaking which emails exist.
  if (!user || !user.isActive) {
    logger.info("Password reset requested for unknown/inactive email", { email: normalized });
    return;
  }

  const { raw, hash } = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: resetTokenExpiry() },
  });

  const base = process.env.PASSWORD_RESET_URL_BASE || "http://localhost:5173/reset-password";
  const link = `${base}/${raw}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Samha CRM password",
    text: `Open this link to reset your password: ${link}\nThis link expires in 60 minutes.`,
    html: `<p>Open this link to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 60 minutes.</p>`,
  });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AuthError("INVALID_RESET_TOKEN", 400, "Reset link is invalid or has expired");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      department: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });
}
