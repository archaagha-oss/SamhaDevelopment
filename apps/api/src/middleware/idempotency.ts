/**
 * Idempotency middleware — caches `(Idempotency-Key → response)` for
 * mutating endpoints so retries don't duplicate work.
 *
 * Pattern:
 *   POST /api/leads
 *   Idempotency-Key: c0ffee-...
 *
 *   First request:  handler runs, response is cached.
 *   Retry with same key + same body: cached response is returned (no work).
 *   Retry with same key + different body: 409 Conflict.
 *
 * TTL is 24h by default; the sweep below removes expired keys.
 */

import { createHash } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface IdempotencyOptions {
  ttlMs?: number;
  /**
   * If true, missing Idempotency-Key header is allowed (request just runs).
   * If false, returns 400 demanding the header.
   */
  required?: boolean;
}

export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const required = options.required ?? false;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header("Idempotency-Key");
    if (!key) {
      if (required) {
        return res.status(400).json({
          error: "Idempotency-Key header is required for this endpoint",
          code: "IDEMPOTENCY_KEY_REQUIRED",
          statusCode: 400,
        });
      }
      return next();
    }

    if (!/^[A-Za-z0-9_\-:.]{8,200}$/.test(key)) {
      return res.status(400).json({
        error: "Idempotency-Key must be 8–200 chars of [A-Za-z0-9_-:.]",
        code: "IDEMPOTENCY_KEY_INVALID",
        statusCode: 400,
      });
    }

    const scope = req.baseUrl + req.path; // e.g. "/api/leads/" + ""
    const method = req.method;
    const requestHash = hashBody(req.body);

    try {
      const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

      if (existing) {
        if (existing.expiresAt < new Date()) {
          // expired — drop it and proceed
          await prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
        } else {
          if (existing.requestHash !== requestHash) {
            return res.status(409).json({
              error:
                "Idempotency-Key was previously used with a different request body",
              code: "IDEMPOTENCY_KEY_CONFLICT",
              statusCode: 409,
            });
          }
          // Replay cached response
          res.setHeader("X-Idempotent-Replay", "true");
          return res
            .status(existing.status)
            .json(existing.response);
        }
      }
    } catch (err) {
      logger.error("[idempotency] lookup error", { err, key });
      // On lookup failure, fall through and let the request run.
      return next();
    }

    // Capture the response so we can persist it.
    const originalJson = res.json.bind(res);
    let captured: { status: number; body: unknown } | null = null;
    res.json = (body: unknown) => {
      captured = { status: res.statusCode, body };
      return originalJson(body);
    };

    res.on("finish", () => {
      // Only cache 2xx responses — don't cache validation errors etc.
      if (!captured || captured.status < 200 || captured.status >= 300) {
        return;
      }
      const expiresAt = new Date(Date.now() + ttlMs);
      prisma.idempotencyKey
        .create({
          data: {
            key,
            scope,
            method,
            requestHash,
            status: captured.status,
            response: captured.body as any,
            expiresAt,
          },
        })
        .catch((err) => {
          // P2002 = unique constraint (someone raced us); ignore.
          if (err?.code !== "P2002") {
            logger.error("[idempotency] cache write failed", { err, key });
          }
        });
    });

    return next();
  };
}

function hashBody(body: unknown): string {
  const json = JSON.stringify(body ?? {});
  return createHash("sha256").update(json).digest("hex");
}

/**
 * Sweep expired idempotency keys. Run from a periodic job.
 */
export async function sweepExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
