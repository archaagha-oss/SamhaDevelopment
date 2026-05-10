import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";

/**
 * Idempotency-Key middleware.
 *
 * Pattern: state-changing endpoints (POST /payments, POST /deals, etc.) accept
 * an "Idempotency-Key" header. We hash (key + method + path + body) and cache
 * the response under that hash for IDEMPOTENCY_TTL_MS. A repeated request with
 * the same key replays the cached response — no DB write — preventing
 * double-charges when a client retries on a flaky network.
 *
 * Storage. In-memory Map. Fine for a single-instance deployment with PM2's
 * cluster mode (sticky-session not required because the same client retry
 * usually hits the same worker — and on miss we fall through to the handler,
 * which is a no-op once the original write committed thanks to DB unique
 * constraints). For horizontal scaling, swap for Redis with the same key
 * shape — the surrounding code is unchanged.
 *
 * Limits. Map cap at 10k entries; oldest evicted. TTL 24h. A periodic sweep
 * keeps memory bounded.
 */

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 10_000;
const cache = new Map<string, CachedResponse>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
}, 60_000).unref?.();

function fingerprint(req: Request, key: string): string {
  const body = JSON.stringify(req.body ?? {});
  return crypto
    .createHash("sha256")
    .update(`${key}|${req.method}|${req.path}|${body}`)
    .digest("hex");
}

export function idempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.header("Idempotency-Key");

  // No key supplied → no-op. Idempotency is opt-in per request.
  if (!key) return next();

  if (key.length < 8 || key.length > 128) {
    return res.status(400).json({
      error: "Idempotency-Key must be 8–128 characters",
      code: "IDEMPOTENCY_KEY_INVALID",
      statusCode: 400,
    });
  }

  const fp = fingerprint(req, key);
  const cached = cache.get(fp);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader("Idempotent-Replay", "true");
    return res.status(cached.status).json(cached.body);
  }

  // Cache the next successful response. We patch res.json so the route
  // handler stays unaware of the middleware.
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const status = res.statusCode || 200;
    if (status >= 200 && status < 300) {
      if (cache.size >= MAX_ENTRIES) {
        // Drop oldest entry (insertion order in Map).
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(fp, {
        status,
        body,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      });
    }
    return originalJson(body);
  } as typeof res.json;

  next();
}

export function idempotencyStats() {
  return { size: cache.size };
}

logger.info("Idempotency middleware loaded (in-memory, 24h TTL, 10k cap)");
