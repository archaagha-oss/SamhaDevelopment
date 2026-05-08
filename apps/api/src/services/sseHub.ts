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

class SseHub {
  private byUser = new Map<string, Map<string, SseClient>>();
  private heartbeat: NodeJS.Timeout | null = null;

  register(client: SseClient): void {
    let bucket = this.byUser.get(client.userId);
    if (!bucket) {
      bucket = new Map();
      this.byUser.set(client.userId, bucket);
    }
    bucket.set(client.id, client);
    this.ensureHeartbeat();
  }

  unregister(client: SseClient): void {
    const bucket = this.byUser.get(client.userId);
    if (!bucket) return;
    bucket.delete(client.id);
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
