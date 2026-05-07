import * as Sentry from "@sentry/node";
import { env, isProd } from "./env";
import { logger } from "./logger";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!env.SENTRY_DSN) {
    if (isProd) {
      logger.warn("SENTRY_DSN is not set — production errors will only go to logs");
    }
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  initialized = true;
  logger.info("Sentry initialised");
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  if (context) Sentry.setContext("extra", context);
  Sentry.captureException(err);
}

export { Sentry };
