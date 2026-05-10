import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "./logger";

/**
 * Lightweight observability layer — zero new dependencies.
 *
 * Provides:
 *  - Request ID middleware (correlates frontend / backend / log entries)
 *  - In-process metrics collection (HTTP request count + latency histogram)
 *  - /metrics endpoint in Prometheus exposition format
 *  - Sentry hook that auto-activates if @sentry/node is installed (optional dep)
 *
 * For richer features (distributed tracing, multi-instance aggregation), swap
 * the metrics store for prom-client + Redis, and the Sentry hook for the full
 * SDK init. The middleware contracts here are stable so call sites don't change.
 */

// ─── Request IDs ──────────────────────────────────────────────────────────
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("X-Request-Id");
  const id = incoming || crypto.randomBytes(8).toString("hex");
  (req as any).requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

// ─── Metrics store ────────────────────────────────────────────────────────
// One bucket per route+method+status_class; simple in-memory aggregation.
// Memory bounded by the number of distinct routes (~30 here), not request count.
interface RouteBucket {
  count: number;
  sumMs: number;
  // Histogram buckets in milliseconds (le): 50, 100, 250, 500, 1000, 2500, 5000, 10000
  hist: number[];
  errors: number;
}
const HIST_BOUNDS_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

const buckets = new Map<string, RouteBucket>();
const startTime = Date.now();

function bucketKey(method: string, route: string, statusClass: string) {
  return `${method}|${route}|${statusClass}`;
}

function recordRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number
) {
  const sc = `${Math.floor(status / 100)}xx`;
  const key = bucketKey(method, route, sc);
  let b = buckets.get(key);
  if (!b) {
    b = { count: 0, sumMs: 0, hist: new Array(HIST_BOUNDS_MS.length + 1).fill(0), errors: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  b.sumMs += durationMs;
  if (status >= 500) b.errors += 1;

  let placed = false;
  for (let i = 0; i < HIST_BOUNDS_MS.length; i++) {
    if (durationMs <= HIST_BOUNDS_MS[i]) {
      b.hist[i] += 1;
      placed = true;
      break;
    }
  }
  if (!placed) b.hist[HIST_BOUNDS_MS.length] += 1; // +Inf bucket
}

// ─── HTTP middleware ──────────────────────────────────────────────────────
export function httpMetrics(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    // Use route pattern, not the raw URL with IDs — avoids bucket explosion.
    // Express sets req.route only when the handler matched.
    const route =
      (req.route?.path && `${req.baseUrl ?? ""}${req.route.path}`) ||
      req.path.replace(/\/[a-f0-9-]{8,}/gi, "/:id"); // best-effort param scrub
    recordRequest(req.method, route, res.statusCode, durationMs);
  });
  next();
}

// ─── /metrics handler ─────────────────────────────────────────────────────
// Simple Prometheus text exposition. Auth is by API-key header — set
// METRICS_TOKEN in env to require it.
export function metricsHandler(req: Request, res: Response) {
  const requiredToken = process.env.METRICS_TOKEN;
  if (requiredToken) {
    const provided = req.header("Authorization")?.replace(/^Bearer\s+/i, "") || req.query.token;
    if (provided !== requiredToken) {
      return res.status(401).json({ error: "metrics endpoint requires Bearer token" });
    }
  }

  const lines: string[] = [];
  lines.push("# HELP samha_http_requests_total Total HTTP requests by route, method, status class");
  lines.push("# TYPE samha_http_requests_total counter");
  for (const [key, b] of buckets) {
    const [method, route, sc] = key.split("|");
    lines.push(`samha_http_requests_total{method="${method}",route="${route}",status="${sc}"} ${b.count}`);
  }

  lines.push("# HELP samha_http_request_errors_total Total 5xx HTTP responses");
  lines.push("# TYPE samha_http_request_errors_total counter");
  for (const [key, b] of buckets) {
    if (b.errors === 0) continue;
    const [method, route] = key.split("|");
    lines.push(`samha_http_request_errors_total{method="${method}",route="${route}"} ${b.errors}`);
  }

  lines.push("# HELP samha_http_request_duration_ms_bucket HTTP latency histogram (ms)");
  lines.push("# TYPE samha_http_request_duration_ms_bucket histogram");
  for (const [key, b] of buckets) {
    const [method, route, sc] = key.split("|");
    let cumulative = 0;
    for (let i = 0; i < HIST_BOUNDS_MS.length; i++) {
      cumulative += b.hist[i];
      lines.push(
        `samha_http_request_duration_ms_bucket{method="${method}",route="${route}",status="${sc}",le="${HIST_BOUNDS_MS[i]}"} ${cumulative}`
      );
    }
    cumulative += b.hist[HIST_BOUNDS_MS.length];
    lines.push(
      `samha_http_request_duration_ms_bucket{method="${method}",route="${route}",status="${sc}",le="+Inf"} ${cumulative}`
    );
    lines.push(
      `samha_http_request_duration_ms_sum{method="${method}",route="${route}",status="${sc}"} ${b.sumMs.toFixed(0)}`
    );
    lines.push(
      `samha_http_request_duration_ms_count{method="${method}",route="${route}",status="${sc}"} ${b.count}`
    );
  }

  // Process metrics
  const mem = process.memoryUsage();
  lines.push("# HELP samha_process_resident_memory_bytes Resident memory in bytes");
  lines.push("# TYPE samha_process_resident_memory_bytes gauge");
  lines.push(`samha_process_resident_memory_bytes ${mem.rss}`);
  lines.push("# HELP samha_process_heap_used_bytes Heap memory used in bytes");
  lines.push("# TYPE samha_process_heap_used_bytes gauge");
  lines.push(`samha_process_heap_used_bytes ${mem.heapUsed}`);
  lines.push("# HELP samha_process_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE samha_process_uptime_seconds counter");
  lines.push(`samha_process_uptime_seconds ${(Date.now() - startTime) / 1000}`);

  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(lines.join("\n") + "\n");
}

// ─── Sentry hook ──────────────────────────────────────────────────────────
// Works without @sentry/node installed (no-op). When the package IS present and
// SENTRY_DSN is set, captures errors. This pattern lets prod opt in without
// forcing the dep on dev.
let sentryActive = false;
let sentryCapture: ((err: unknown, ctx?: Record<string, unknown>) => void) | null = null;

export async function initObservability() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("Observability: Sentry disabled (no SENTRY_DSN)");
    return;
  }
  try {
    // @ts-ignore — optional dep, may not be installed
    const Sentry = await import("@sentry/node").catch(() => null);
    if (!Sentry) {
      logger.warn(
        "Observability: SENTRY_DSN set but @sentry/node not installed — `npm i @sentry/node` to enable"
      );
      return;
    }
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: 0.1,
    });
    sentryActive = true;
    sentryCapture = (err, ctx) => Sentry.captureException(err, { extra: ctx });
    logger.info("Observability: Sentry initialized");
  } catch (err) {
    logger.error("Observability: Sentry init failed", { err: String(err) });
  }
}

export function captureError(err: unknown, ctx?: Record<string, unknown>) {
  if (sentryActive && sentryCapture) sentryCapture(err, ctx);
  // Always log too — Sentry is additive, not a replacement for structured logs.
  logger.error("captureError", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...ctx,
  });
}
