import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

/**
 * API key middleware. Authenticates requests via `Authorization: Bearer sk_…`
 * tokens issued from Settings → API Keys.
 *
 * On success:
 *   - attaches `req.apiKey` with id/name/scopes
 *   - updates the key's `lastUsedAt` (fire-and-forget, doesn't block the request)
 *
 * Scope check: pass the required scope strings. If empty, any non-revoked
 * non-expired key passes. Multiple scopes are AND'd — the key must have all of them.
 *
 * Usage:
 *   router.post("/leads", requireApiKey(["leads:create"]), handler);
 *   router.get("/units",  requireApiKey(["units:read"]),   handler);
 */

export interface AuthenticatedApiKey {
  id: string;
  name: string;
  scopes: string[];
  organizationId: string;
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: AuthenticatedApiKey;
    }
  }
}

function unauthorized(res: Response, message: string, code = "UNAUTHORIZED") {
  return res.status(401).json({ error: message, code, statusCode: 401 });
}

function forbidden(res: Response, message: string, code = "FORBIDDEN") {
  return res.status(403).json({ error: message, code, statusCode: 403 });
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  // Cheap shape check — short-circuit obvious garbage before hitting the DB.
  return token.startsWith("sk_") && token.length > 16 ? token : null;
}

export function requireApiKey(requiredScopes: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
      return unauthorized(res, "Missing or malformed API key. Use 'Authorization: Bearer sk_…'");
    }

    const hash = crypto.createHash("sha256").update(token).digest("hex");

    try {
      const key = await prisma.apiKey.findUnique({
        where: { hashedKey: hash },
      });

      if (!key) return unauthorized(res, "Invalid API key", "INVALID_KEY");
      if (key.revokedAt) return unauthorized(res, "API key has been revoked", "KEY_REVOKED");
      if (key.expiresAt && key.expiresAt < new Date()) {
        return unauthorized(res, "API key has expired", "KEY_EXPIRED");
      }

      const granted = Array.isArray(key.scopes) ? (key.scopes as string[]) : [];
      const missing = requiredScopes.filter((s) => !granted.includes(s));
      if (missing.length > 0) {
        return forbidden(
          res,
          `API key missing required scope(s): ${missing.join(", ")}. Granted: ${granted.join(", ") || "(none)"}`,
          "INSUFFICIENT_SCOPE",
        );
      }

      req.apiKey = {
        id: key.id,
        name: key.name,
        scopes: granted,
        organizationId: key.organizationId,
      };

      // Fire-and-forget — don't await. lastUsedAt is observability, not load-bearing.
      prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => { /* swallow — we don't want this to fail the request */ });

      next();
    } catch (err: any) {
      // Never leak internals on auth failures.
      return unauthorized(res, "API key verification failed", "VERIFICATION_FAILED");
    }
  };
}

/**
 * Variant: accept either a Clerk user session OR an API key. Useful for
 * dual-use endpoints (e.g. /api/leads can be hit by both the CRM frontend
 * and the public lead form).
 */
export function requireUserOrApiKey(requiredScopes: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.userId) return next();
    return requireApiKey(requiredScopes)(req, res, next);
  };
}
