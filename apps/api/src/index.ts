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
import webhookRoutes from "./routes/webhooks";
import triageRoutes from "./routes/triage";

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
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const window = 60_000;
  const limit = 100;
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return next();
  }
  entry.count++;
  if (entry.count > limit) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests", code: "RATE_LIMITED", statusCode: 429 });
  }
  next();
});

// ── Mock auth for development (Clerk disabled) ────────────────────────────
app.use((req, res, next) => {
  req.auth = { userId: "dev-user-1" };
  next();
});

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

// Body parser
app.use(express.json());

// Static file serving for uploads
app.use(express.static("public"));

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
app.use("/api/triage", triageRoutes);

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
  logger.error("Unhandled Express error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

export default app;
