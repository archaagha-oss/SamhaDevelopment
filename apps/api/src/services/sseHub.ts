/**
 * Server-Sent Events hub.
 *
 * Maintains an in-memory registry of active SSE connections, keyed by userId
 * (so we can target events to one user) plus a global broadcast channel.
 *
 * Backpressure: the SSE protocol is one-way and writes are best-effort. If a
 * client falls behind, Node's response stream applies backpressure — we don't
 * accumulate unbounded queues. On `res.write` errors the connection is removed.
 *
 * Heartbeat: sends a comment line every HEARTBEAT_MS so proxies (nginx, Cloudflare)
 * don't drop idle connections. Standard SSE comments start with `:` and are
 * silently ignored by EventSource.
 */

import type { Response } from "express";

export interface SseClient {
  id: string;          // unique per-connection
  userId: string;      // owning user
  res: Response;
}

const HEARTBEAT_MS = 25_000;
// Connection caps — closes audit P1 E.2. A user with multiple browser tabs
// usually has ≤ 4 connections; 10 leaves headroom and protects against runaway
// reconnect loops. Total cap of 5,000 keeps memory bounded even under burst.
const MAX_CLIENTS_PER_USER = parseInt(process.env.SSE_MAX_CLIENTS_PER_USER || "10", 10);
const MAX_TOTAL_CLIENTS = parseInt(process.env.SSE_MAX_TOTAL_CLIENTS || "5000", 10);

export class SseRegistrationError extends Error {
  constructor(message: string, public code: "PER_USER_LIMIT" | "GLOBAL_LIMIT") {
    super(message);
    this.name = "SseRegistrationError";
  }
}

class SseHub {
  private byUser = new Map<string, Map<string, SseClient>>();
  private heartbeat: NodeJS.Timeout | null = null;
  private totalClients = 0;

  register(client: SseClient): void {
    if (this.totalClients >= MAX_TOTAL_CLIENTS) {
      throw new SseRegistrationError(
        `Server SSE capacity exceeded (${MAX_TOTAL_CLIENTS} clients)`,
        "GLOBAL_LIMIT"
      );
    }
    let bucket = this.byUser.get(client.userId);
    if (!bucket) {
      bucket = new Map();
      this.byUser.set(client.userId, bucket);
    }
    if (bucket.size >= MAX_CLIENTS_PER_USER) {
      throw new SseRegistrationError(
        `User ${client.userId} has too many open SSE connections (${MAX_CLIENTS_PER_USER})`,
        "PER_USER_LIMIT"
      );
    }
    bucket.set(client.id, client);
    this.totalClients += 1;
    this.ensureHeartbeat();
  }

  unregister(client: SseClient): void {
    const bucket = this.byUser.get(client.userId);
    if (!bucket) return;
    if (bucket.delete(client.id)) {
      this.totalClients = Math.max(0, this.totalClients - 1);
    }
    if (bucket.size === 0) this.byUser.delete(client.userId);
    if (this.byUser.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  /** Push an event to one specific user (all their open tabs). */
  publishToUser(userId: string, event: string, data: unknown): void {
    const bucket = this.byUser.get(userId);
    if (!bucket) return;
    const payload = format(event, data);
    for (const client of bucket.values()) {
      this.write(client, payload);
    }
  }

  /** Push an event to every connected user. */
  broadcast(event: string, data: unknown): void {
    const payload = format(event, data);
    for (const bucket of this.byUser.values()) {
      for (const client of bucket.values()) {
        this.write(client, payload);
      }
    }
  }

  /** Number of connected clients (for /health debug). */
  size(): { users: number; clients: number } {
    let clients = 0;
    for (const bucket of this.byUser.values()) clients += bucket.size;
    return { users: this.byUser.size, clients };
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private write(client: SseClient, payload: string): void {
    try {
      client.res.write(payload);
    } catch (err) {
      console.warn(`[SSE] write failed for ${client.userId}/${client.id}; dropping client`, err);
      this.unregister(client);
    }
  }

  private ensureHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      const ping = `: heartbeat ${Date.now()}\n\n`;
      for (const bucket of this.byUser.values()) {
        for (const client of bucket.values()) {
          this.write(client, ping);
        }
      }
    }, HEARTBEAT_MS);
    // Don't keep the event loop alive just for heartbeats.
    this.heartbeat.unref?.();
  }
}

function format(event: string, data: unknown): string {
  // SSE wire format: "event: NAME\ndata: JSON\n\n"
  const json = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}

export const sseHub = new SseHub();
