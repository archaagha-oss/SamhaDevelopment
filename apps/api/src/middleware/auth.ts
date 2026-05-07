import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../lib/jwt";

/**
 * requireAuthentication
 *
 * Verifies a JWT bearer token in the Authorization header. On success, sets
 * `req.auth = { userId: <internal User.id>, role }`. Downstream handlers can
 * use `req.auth.userId` to identify the actor (e.g. for audit logs).
 */
export const requireAuthentication = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.get("authorization") || req.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  }

  const token = header.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
      statusCode: 401,
    });
  }
};

/**
 * requireRole — must run after requireAuthentication.
 *
 * Looks up the User by id (the JWT subject) and checks role membership.
 * Attaches the resolved User to `req.resolvedUser` for downstream use.
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

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: { id: true, role: true, name: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return res.status(403).json({
          error: "User account not found or disabled",
          code: "USER_NOT_FOUND",
          statusCode: 403,
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${user.role}`,
          code: "INSUFFICIENT_ROLE",
          statusCode: 403,
        });
      }

      (req as any).resolvedUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };
};
