import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { verifySessionToken } from "../lib/jwt";
import { env } from "../lib/env";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: string;
        email: string;
      };
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[env.COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;

  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return null;
}

export const attachAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();
  const payload = verifySessionToken(token);
  if (!payload) return next();
  req.auth = { userId: payload.sub, role: payload.role, email: payload.email };
  next();
};

export const requireAuthentication = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.auth?.userId) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  }
  next();
};

/**
 * Require the authenticated user to have one of the allowed roles.
 *
 * Reads the role from the JWT first (no DB hit). For sensitive endpoints,
 * combine with a fresh DB lookup to confirm `isActive`.
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}.`,
        code: "INSUFFICIENT_ROLE",
        statusCode: 403,
      });
    }

    next();
  };
};

/**
 * Confirms the user still exists, is active, and matches the JWT role.
 * Use on high-trust admin endpoints (user create/delete, billing, etc.).
 */
export const requireActiveUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.auth?.userId) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, role: true, isActive: true, email: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Account disabled or removed",
        code: "ACCOUNT_DISABLED",
        statusCode: 401,
      });
    }
    if (user.role !== req.auth.role) {
      return res.status(401).json({
        error: "Session is stale, please sign in again",
        code: "STALE_SESSION",
        statusCode: 401,
      });
    }
    (req as Request & { resolvedUser?: unknown }).resolvedUser = user;
    next();
  } catch (err) {
    next(err);
  }
};
