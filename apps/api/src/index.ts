// Env validation runs at import — must come before anything that reads env
import { env, allowedOrigins, isProd } from "./lib/env";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { openAPISpec } from "./docs/openapi";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { initSentry, Sentry, captureError } from "./lib/sentry";
import { registerDealHandlers } from "./events/handlers/dealHandlers";
import { startJobProcessor } from "./events/jobs/jobHandlers";
import { releaseExpiredHolds } from "./services/unitService";
import { attachAuth } from "./middleware/auth";
import { apiRateLimiter, authRateLimiter } from "./middleware/rateLimit";

// Routes
import authRoutes from "./routes/auth";
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

initSentry();

// ── Bootstrap event system + background jobs ──────────────────────────────────
registerDealHandlers();
startJobProcessor(30_000);

setInterval(() => {
  releaseExpiredHolds("system").catch((err: unknown) => {
    logger.error("ON_HOLD expiry sweep error", { err });
    captureError(err);
  });
}, 60 * 60 * 1000);

const app = express();

// Trust proxy headers when running behind a load balancer (PM2 + nginx)
app.set("trust proxy", 1);

// ── Security headers (helmet) ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Swagger UI breaks under default CSP; tune later
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ── Body + cookie parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ── Health check (before rate limiter so probes never get throttled) ──────
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    captureError(err);
    res.status(503).json({ status: "degraded", error: "db_unreachable" });
  }
});

// ── Rate limiting ──────────────────────────────────────────────────────────
app.use("/api/auth", authRateLimiter);
app.use("/api", apiRateLimiter);

// ── Static + Swagger ───────────────────────────────────────────────────────
app.use(express.static("public"));
app.use("/api-docs", swaggerUi.serve);
app.get("/api-docs", swaggerUi.setup(openAPISpec, { swaggerOptions: { url: "/openapi.json" } }));
app.get("/openapi.json", (_req, res) => res.json(openAPISpec));

// ── Auth: parse session token from cookie/header ──────────────────────────
app.use(attachAuth);

// ── API routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
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

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
    code: "NOT_FOUND",
    statusCode: 404,
  });
});

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.statusCode || 500;
  const isServerError = status >= 500;

  logger.error("Express error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: status,
  });

  if (isServerError) {
    if (env.SENTRY_DSN) Sentry.captureException(err);
  }

  res.status(status).json({
    error: isServerError ? "Internal server error" : err.message,
    code: err.code || (isServerError ? "INTERNAL_ERROR" : "BAD_REQUEST"),
    statusCode: status,
  });
});

// ── Server startup ─────────────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
  logger.info(`CORS origins: ${allowedOrigins.join(", ")}`);
  logger.info(`Auth: cookie session (JWT) — ${isProd ? "prod" : "dev"} mode`);
});

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force exit if not closed within 10s
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  captureError(reason);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err.message, stack: err.stack });
  captureError(err);
});

export default app;
