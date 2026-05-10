import { Request, Response, NextFunction } from "express";
import { clerkMiddleware } from "@clerk/express";
import { prisma } from "../lib/prisma";

// Clerk middleware - attach to express app in production
export const setupClerkAuth = () => clerkMiddleware();

// Middleware to require authentication on protected routes
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
 * Middleware factory: ensure the calling user has one of the allowed roles.
 *
 * Role resolution: looks up User by clerkId = req.auth.userId. If no row is
 * found, returns 403 — fail closed, in every environment, including dev.
 * The previous "dev mode grants ADMIN to unknown users" bypass has been
 * removed; the local seed now provisions a dev-user-1 record with role=ADMIN
 * so the mock auth path still works for local development.
 *
 * Roles: ADMIN, MANAGER, MEMBER, VIEWER. Finance-sensitive operations gate
 * to ["ADMIN", "MANAGER"] — promote a user to MANAGER to give them sign-off
 * authority on payments/commissions.
 *
 * Usage:
 *   router.post("/", requireRole(["ADMIN"]), handler)
 *   router.patch("/:id/approve", requireRole(["ADMIN", "MANAGER"]), handler)
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
      const user = await prisma.user.findFirst({
        where: { clerkId: req.auth.userId },
        select: { id: true, role: true, name: true },
      });

      if (!user) {
        return res.status(403).json({
          error: "User account not found",
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

      // Attach resolved user to request for downstream handlers
      (req as any).resolvedUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/** Shorthand: ADMIN or MANAGER. Used for finance-sensitive operations. */
export const requireFinanceAccess = requireRole(["ADMIN", "MANAGER"]);
