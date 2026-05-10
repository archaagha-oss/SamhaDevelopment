import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openAPISpec } from "./docs/openapi";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { registerDealHandlers } from "./events/handlers/dealHandlers";
import { startJobProcessor } from "./events/jobs/jobHandlers";
import { releaseExpiredHolds } from "./services/unitService";
import { setupClerkAuth } from "./middleware/auth";
import { installDecimalJsonSerialization } from "./lib/decimalSerialization";

// Install before any router runs so JSON responses emit Decimal as number.
// Safe to call even before the schema flip — it has no effect until at least
// one Decimal column exists.
installDecimalJsonSerialization();

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
// Integrated CRM routes (broker dashboard + finance)
import brokerDashboardRoutes from "./routes/brokerDashboard";
import financeRoutes from "./routes/finance";
import onboardingRoutes from "./routes/onboarding";
// Phase 4 routes — disabled pending schema migration (Phase, UnitTypePlan,
// CommissionTier, Invoice, Receipt, Refund, Escrow, Handover, Snag, KYC, etc.)
// Files are present under src/routes but require ~36 additional schema models.

dotenv.config();

// ── Bootstrap event system + background jobs ──────────────────────────────────
registerDealHandlers();
startJobProcessor(30_000); // poll every 30 s

// Hourly sweep: release expired ON_HOLD units
setInterval(() => {
  releaseExpiredHolds("system").catch((err: unknown) => {
    console.error("[Cron] ON_HOLD expiry sweep error:", err);
  });
}, 60 * 60 * 1000);

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ───────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
  next();
});

// ── Webhooks (mounted BEFORE rate-limit + auth + json parser) ──────────────
// Webhooks come from external providers (Twilio, SendGrid). They install
// their own per-route body parsers and bypass the user-targeted rate limiter
// so a burst of inbound messages doesn't push real users over the limit.
app.use("/api/webhooks", webhookRoutes);

// ── Rate limiting (100 req / min per IP) ──────────────────────────────────
// In-memory limiter — fine for a single instance. Replace with a Redis-backed
// `express-rate-limit` store before scaling horizontally.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 100;
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
//
// Cap JSON / urlencoded payloads at 1MB. Express defaults to 100KB, which
// is too tight for some bulk-create payloads (deal milestones, multi-purchaser
// SPA particulars), but anything bigger than ~1MB is almost certainly an
// abuse vector — file uploads use multipart and are routed through documentService
// directly, so the JSON body parser never needs to handle binary blobs.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static("public"));
// Local document storage (dev mode — replaces S3). Files written by
// documentService land here and are accessed at /uploads/<key>.
app.use("/uploads", express.static("uploads"));

// ── Public, unauthenticated share routes — mounted BEFORE the mock-auth
//    middleware so anonymous clients can hit them.
app.use("/public/share", publicShareRoutes);

// ── Authentication ────────────────────────────────────────────────────────
//
// Production / staging: Clerk middleware verifies the session JWT on every
// request and populates `req.auth` with the real Clerk user id. Routes then
// gate via `requireAuthentication` and `requireRole`.
//
// Local dev (no CLERK_SECRET_KEY set): we fall back to a mock middleware that
// pins every request to `dev-user-1`. This is INTENTIONAL — it lets engineers
// run the API offline — but it must NEVER ship to production. The guard below
// hard-fails boot if the mock would otherwise activate in production.
const isProduction = process.env.NODE_ENV === "production";
const hasClerkSecret = !!process.env.CLERK_SECRET_KEY;

if (isProduction && !hasClerkSecret) {
  logger.error(
    "FATAL: NODE_ENV=production but CLERK_SECRET_KEY is not set. Refusing to boot — " +
      "the mock-auth fallback would expose every endpoint as 'dev-user-1'."
  );
  process.exit(1);
}

if (hasClerkSecret) {
  app.use(setupClerkAuth());
} else {
  logger.warn(
    "[auth] CLERK_SECRET_KEY not set — using mock 'dev-user-1' middleware. " +
      "This must only happen in local development."
  );
  app.use((req, _res, next) => {
    req.auth = { userId: "dev-user-1" };
    next();
  });
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
app.use("/api/broker-dashboard", brokerDashboardRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/onboarding", onboardingRoutes);

// ===== 404 HANDLER (must come before the error handler) =====
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    code: "NOT_FOUND",
    statusCode: 404,
  });
});

// ===== ERROR HANDLER (single, must have 4 parameters) =====
//
// Express identifies error-handling middleware by its arity (4 args). Routes
// that throw or call next(err) land here. We:
//   • log every error structurally via the project logger so it shows up in
//     downstream observability (was previously split between console.error
//     and logger.error in two separate handlers, the second of which was
//     unreachable because it sat after the 404 handler);
//   • surface err.statusCode / err.code / err.message when present (these are
//     attached by route handlers that throw http-friendly errors), defaulting
//     to a generic 500 + INTERNAL_ERROR when not.
//
// In production, if NODE_ENV !== "development", the err.message is replaced
// with a generic string so internal exception text never leaks to clients —
// route handlers that want to surface a friendly message must set err.expose
// = true on the thrown error.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const isDev = process.env.NODE_ENV !== "production";
  const safeMessage = err.expose || isDev || statusCode < 500
    ? (err.message || "Internal server error")
    : "Internal server error";

  logger.error("Unhandled Express error", {
    message: err.message,
    code,
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({ error: safeMessage, code, statusCode });
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

export default app;
