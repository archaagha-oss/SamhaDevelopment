/**
 * GET /api/stream/events — SSE endpoint.
 *
 * Authenticated client opens an EventSource against this URL; the server keeps
 * the connection open and pushes events as they happen. Heartbeats keep
 * proxies from dropping idle connections.
 *
 * Mounted AFTER auth middleware so we can read req.auth?.userId.
 */

import { Router, type Request, type Response } from "express";
import { sseHub } from "../services/sseHub.js";

const router = Router();

router.get("/events", (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  }

  // SSE response headers
  res.set({
    "Content-Type":      "text/event-stream",
    "Cache-Control":     "no-cache, no-transform",
    "Connection":        "keep-alive",
    "X-Accel-Buffering": "no", // disable nginx buffering
  });
  // Some proxies need an immediate flush.
  res.flushHeaders?.();

  const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const client = { id: clientId, userId, res };

  // Greet so the client knows the connection is live (and to flush any proxy buffers)
  res.write(`event: hello\ndata: ${JSON.stringify({ clientId, ts: Date.now() })}\n\n`);

  sseHub.register(client);

  req.on("close", () => {
    sseHub.unregister(client);
  });
});

router.get("/health", (_req, res) => {
  res.json(sseHub.size());
});

export default router;
