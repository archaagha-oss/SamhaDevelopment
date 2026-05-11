import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openAPISpec } from "./docs/openapi";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { setupClerkAuth } from "./middleware/auth";
import {
  requestId,
  httpMetrics,
  metricsHandler,
  initObservability,
  captureError,
} from "./lib/observability";
import { registerDealHandlers } from "./events/handlers/dealHandlers";
import { startJobProcessor } from "./events/jobs/jobHandlers";
import { resolveJobQueueBackend } from "./events/jobs/queueBackend";
import { releaseExpiredHolds } from "./services/unitService";
import { checkAndExpireReservations } from "./services/reservationService";
import { sweepComplianceNotifications } from "./services/complianceNotificationService";

// Import routes
import projectRoutes from "./routes/projects";
import unitRoutes from "./routes/units";
import leadRoutes from "./routes/leads";
import dealRoutes from "./routes/deals";
import paymentRoutes from "./routes/payments";
import commissionRoutes from "./routes/commissions";
import brokerRoutes from "./routes/brokers";
import reportRoutes from "./routes/reports";
import userRoutes from "./routes/users";
import reservationRoutes from "./routes/reservations";
import paymentPlanRoutes from "./routes/paymentPlans";
import documentRoutes from "./routes/documents";
import taskRoutes from "./routes/tasks";
import activityRoutes from "./routes/activities";
import offerRoutes from "./routes/offers";
import settingsRoutes from "./routes/settings";
import contactRoutes from "./routes/contacts";
import publicShareRoutes from "./routes/publicShare";
import feedRoutes from "./routes/feeds";
import webhookRoutes from "./routes/webhooks";
import triageRoutes from "./routes/triage";
import communicationsRoutes from "./routes/communications";
import streamRoutes from "./routes/stream";
import complianceRoutes from "./routes/compliance";
import handoverRoutes from "./routes/handover";
import kycRoutes from "./routes/kyc";
import escrowRoutes from "./routes/escrow";
import constructionRoutes from "./routes/construction";
import snagRoutes from "./routes/snags";
import commissionTierRoutes from "./routes/commissionTiers";
// Integrated CRM routes (broker dashboard + finance)
import brokerDashboardRoutes from "./routes/brokerDashboard";
import financeRoutes from "./routes/finance";
import myDayRoutes from "./routes/myDay";
// Phase 4 routes — disabled pending schema migration (Phase, UnitTypePlan,
// CommissionTier, Invoice, Receipt, Refund, Escrow, Handover, Snag, KYC, etc.)
// Files are present under src/routes but require ~36 additional schema models.

dotenv.config();

// ── Bootstrap event system + background jobs ──────────────────────────────────
registerDealHandlers();

// Job-queue backend selection. Two choices:
//   - JOB_QUEUE_BACKEND=bullmq → Redis-backed BullMQ (REDIS_URL required)
//   - JOB_QUEUE_BACKEND=db (default) → existing DB-polling loop
// See ADMIN_MANUAL.md §6.6 and apps/api/src/events/jobs/bullmqAdapter.ts.
const jobBackend = resolveJobQueueBackend(process.env);
if (jobBackend === "bullmq") {
  // Operator explicitly asked for bullmq. If the adapter can't load (deps
  // missing, REDIS_URL not set, Redis unreachable on first connect) we exit
  // non-zero — silent fallback to the DB poller would be surprising.
  (async () => {
    try {
      const { createBullmqAdapter } = await import("./events/jobs/bullmqAdapter");
      await createBullmqAdapter();
      logger.info("[Boot] Job queue backend: bullmq");
    } catch (err) {
      logger.error(
        `[Boot] JOB_QUEUE_BACKEND=bullmq but adapter failed to start: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  })();
} else {
  startJobProcessor(30_000); // poll every 30 s
  logger.info("[Boot] Job queue backend: db (DB polling)");
}

// Hourly sweep: release expired ON_HOLD units
setInterval(() => {
  releaseExpiredHolds("system").catch((err: unknown) => {
    console.error("[Cron] ON_HOLD expiry sweep error:", err);
  });
}, 60 * 60 * 1000);

// Hourly sweep: expire reservations past their expiresAt and release the
// reserved unit back to AVAILABLE. Closes audit gap #6.
setInterval(() => {
  checkAndExpireReservations()
    .then((n) => {
      if (n > 0) logger.info(`[Cron] expired ${n} reservation(s)`);
    })
    .catch((err: unknown) => {
      console.error("[Cron] reservation expiry sweep error:", err);
    });
}, 60 * 60 * 1000);

// Daily sweep: scan compliance expiries (RERA / Trade / VAT / EID) and
// create Notification rows for ADMIN/MANAGER on items newly within the
// alert horizon. Idempotent — won't re-notify the same expiry within the
// dedup window. Closes audit gap #10.
setInterval(() => {
  sweepComplianceNotifications()
    .then((stats) => {
      if (stats.created > 0) {
        logger.info(`[Cron] compliance sweep: ${stats.created} new notification(s)`);
      }
    })
    .catch((err: unknown) => {
      console.error("[Cron] compliance notification sweep error:", err);
    });
}, 24 * 60 * 60 * 1000);

// Run the compliance sweep once shortly after boot so a freshly-deployed
// instance doesn't have to wait 24h to surface anything that's already due.
setTimeout(() => {
  sweepComplianceNotifications().catch(() => {});
}, 60_000).unref?.();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ───────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.removeHeader("X-Powered-By");
  next();
});

// ── Observability (request IDs + HTTP metrics) ────────────────────────────
app.use(requestId);
app.use(httpMetrics);
initObservability().catch(() => {});

// ── Metrics endpoint (auth via METRICS_TOKEN env var) ─────────────────────
app.get("/metrics", metricsHandler);

// ── Webhooks (mounted BEFORE rate-limit + auth + json parser) ──────────────
// Webhooks come from external providers (Twilio, SendGrid). They install
// their own per-route body parsers and bypass the user-targeted rate limiter
// so a burst of inbound messages doesn't push real users over the limit.
app.use("/api/webhooks", webhookRoutes);

// ── Rate limiting (configurable per IP) ───────────────────────────────────
// In-memory limiter — fine for a single instance. Replace with a Redis-backed
// `express-rate-limit` store before scaling horizontally.
const RATE_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10);
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic sweep — without this, every unique IP that hits once accumulates
// a Map entry forever (slow memory leak).
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, RATE_WINDOW_MS).unref?.();

app.use((req, res, next) => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests", code: "RATE_LIMITED", statusCode: 429 });
  }
  next();
});

// ── CORS for public share endpoints (must precede the mock-auth middleware
//    so they remain anonymous). The default CORS handler below covers `/api/*`.
app.use(
  "/public/share",
  cors({
    origin: true,
    credentials: false,
  })
);

// ── Body parser + static must be in place before publicShare so it can serve
//    media URLs and parse JSON. They are also required by /api/* below.
app.use(express.json());
app.use(express.static("public"));
// Local document storage (dev mode — replaces S3). Files written by
// documentService land here and are accessed at /uploads/<key>.
app.use("/uploads", express.static("uploads"));

// ── Public, unauthenticated share routes — mounted BEFORE the mock-auth
//    middleware so anonymous clients can hit them.
app.use("/public/share", publicShareRoutes);

// ── Authentication ────────────────────────────────────────────────────────
// In production we MUST use real Clerk. In dev a mock auth fallback is
// available, but only when explicitly opted in via ALLOW_MOCK_AUTH=true.
// The default in dev is now real Clerk (fail closed); turning the mock on
// is a deliberate choice an engineer makes for a local-only loop.
const isProduction = process.env.NODE_ENV === "production";
const useMockAuth =
  !isProduction && process.env.ALLOW_MOCK_AUTH === "true";

if (useMockAuth) {
  logger.warn(
    "ALLOW_MOCK_AUTH=true — mock auth active; every request becomes dev-user-1. " +
      "Never set this in production."
  );
  app.use((req, _res, next) => {
    req.auth = { userId: "dev-user-1" };
    next();
  });
} else {
  if (!process.env.CLERK_SECRET_KEY) {
    logger.error(
      "CLERK_SECRET_KEY is required. Set it, or for local dev only set " +
        "ALLOW_MOCK_AUTH=true to enable the mock-auth fallback."
    );
    process.exit(1);
  }
  app.use(setupClerkAuth());
}

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:3000",
];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// (Body parser + static already mounted above for /public/share — Express
// only invokes them once per request, so no need to re-register.)

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===== SWAGGER DOCUMENTATION =====
app.use("/api-docs", swaggerUi.serve);
app.get("/api-docs", swaggerUi.setup(openAPISpec, { swaggerOptions: { url: "/openapi.json" } }));
app.get("/openapi.json", (req, res) => {
  res.json(openAPISpec);
});

// ===== API ROUTES =====
app.use("/api/projects", projectRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/brokers", brokerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/payment-plans", paymentPlanRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/feeds", feedRoutes);
app.use("/api/triage", triageRoutes);
app.use("/api/communications", communicationsRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/handover", handoverRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/escrow", escrowRoutes);
app.use("/api/construction", constructionRoutes);
app.use("/api/snags", snagRoutes);
app.use("/api/commission-tiers", commissionTierRoutes);
app.use("/api/broker-dashboard", brokerDashboardRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/my-day", myDayRoutes);

// ===== ERROR HANDLING =====
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error",
    code: err.code || "INTERNAL_ERROR",
    statusCode: err.statusCode || 500,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    code: "NOT_FOUND",
    statusCode: 404,
  });
});

// Global error handler — must have 4 parameters
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  captureError(err, {
    path: req.path,
    method: req.method,
    requestId: (req as any).requestId,
  });
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR", statusCode: 500 });
});

// ===== SERVER STARTUP =====
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`CORS origins: ${allowedOrigins.join(", ")}`);
  logger.info(`Clerk auth: ${process.env.CLERK_SECRET_KEY ? "enabled" : "DISABLED (dev mode)"}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");

  // If the bullmq adapter is active, close worker + queue first so in-flight
  // jobs finish cleanly before Prisma disconnects.
  if (jobBackend === "bullmq") {
    try {
      const { bullmqShutdown } = await import("./events/jobs/bullmqAdapter");
      await bullmqShutdown();
    } catch (err) {
      console.error("[Shutdown] bullmqShutdown error:", err);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  captureError(reason, { source: "unhandledRejection" });
});

process.on("uncaughtException", (err) => {
  captureError(err, { source: "uncaughtException" });
});

export default app;
