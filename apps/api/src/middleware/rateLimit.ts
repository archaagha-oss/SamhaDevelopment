import rateLimit from "express-rate-limit";
import { env } from "../lib/env";

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    code: "RATE_LIMITED",
    statusCode: 429,
  },
});

// Stricter limit for auth endpoints to slow down brute-force attempts
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Try again in a few minutes.",
    code: "RATE_LIMITED",
    statusCode: 429,
  },
});
