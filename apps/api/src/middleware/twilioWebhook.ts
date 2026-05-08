/**
 * Twilio webhook signature validation middleware.
 *
 * Twilio signs every webhook with `X-Twilio-Signature`. The validator combines:
 *   - the full URL the request was sent to (proto + host + path + query)
 *   - the auth token
 *   - the parsed body params (alphabetically sorted)
 *
 * Mount AFTER the urlencoded body parser (validateRequest needs req.body).
 * In dev — when TWILIO_AUTH_TOKEN is not set — we skip validation with a
 * loud warning so local testing with curl/ngrok still works.
 */

import type { Request, Response, NextFunction } from "express";
import twilio from "twilio";

export function twilioWebhookValidator() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      console.warn(
        `[TwilioWebhook] TWILIO_AUTH_TOKEN not set — accepting unsigned webhook ${req.method} ${req.originalUrl}. ` +
        `DO NOT run this configuration in production.`
      );
      return next();
    }

    const signature = req.header("X-Twilio-Signature");
    if (!signature) {
      return res.status(403).json({ error: "Missing X-Twilio-Signature", code: "MISSING_SIGNATURE", statusCode: 403 });
    }

    // Reconstruct the URL Twilio used. If the API sits behind a proxy, the
    // x-forwarded-* headers are authoritative.
    const proto = (req.header("X-Forwarded-Proto") ?? req.protocol ?? "https").split(",")[0].trim();
    const host  = req.header("X-Forwarded-Host")  ?? req.header("Host")    ?? "";
    const url   = `${proto}://${host}${req.originalUrl}`;

    const params = (req.body ?? {}) as Record<string, string>;

    const valid = twilio.validateRequest(authToken, signature, url, params);

    if (!valid) {
      console.warn(`[TwilioWebhook] Invalid signature for ${req.method} ${req.originalUrl}`);
      return res.status(403).json({ error: "Invalid Twilio signature", code: "INVALID_SIGNATURE", statusCode: 403 });
    }

    return next();
  };
}
