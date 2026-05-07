/**
 * Idempotency middleware unit tests — uses an in-memory mock of the
 * IdempotencyKey table.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

interface FakeRow {
  key: string;
  scope: string;
  method: string;
  requestHash: string;
  status: number;
  response: unknown;
  expiresAt: Date;
}

// In-memory store
const store = new Map<string, FakeRow>();

vi.mock("../lib/prisma", () => ({
  prisma: {
    idempotencyKey: {
      findUnique: vi.fn(async ({ where }: any) => store.get(where.key) ?? null),
      create: vi.fn(async ({ data }: any) => {
        if (store.has(data.key)) {
          const err: any = new Error("unique");
          err.code = "P2002";
          throw err;
        }
        store.set(data.key, data);
        return data;
      }),
      delete: vi.fn(async ({ where }: any) => {
        store.delete(where.key);
        return null;
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

import { idempotency } from "../middleware/idempotency";

function makeReqRes(opts: {
  key?: string;
  body?: unknown;
  baseUrl?: string;
  path?: string;
  method?: string;
}) {
  const req: Partial<Request> = {
    header: (name: string) =>
      name === "Idempotency-Key" ? opts.key : undefined,
    body: opts.body ?? {},
    baseUrl: opts.baseUrl ?? "/api/leads",
    path: opts.path ?? "/",
    method: opts.method ?? "POST",
  } as any;

  let finishCb: (() => void) | null = null;
  const headers: Record<string, string> = {};
  const res: Partial<Response> & { _captured?: any; _status?: number } = {
    statusCode: 200,
    setHeader: ((name: string, value: string) => {
      headers[name] = value;
    }) as any,
    status: function (this: any, code: number) {
      this.statusCode = code;
      return this;
    } as any,
    json: function (this: any, body: unknown) {
      this._captured = body;
      this._status = this.statusCode;
      finishCb?.();
      return this;
    } as any,
    on: ((event: string, cb: () => void) => {
      if (event === "finish") finishCb = cb;
    }) as any,
  };
  return { req: req as Request, res: res as any, headers };
}

describe("idempotency middleware", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("passes through when no Idempotency-Key header is present", async () => {
    const mw = idempotency();
    const { req, res } = makeReqRes({});
    const next: NextFunction = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 400 when key is present but invalid", async () => {
    const mw = idempotency();
    const { req, res } = makeReqRes({ key: "short" });
    const next: NextFunction = vi.fn();
    await mw(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("requires the header when required:true", async () => {
    const mw = idempotency({ required: true });
    const { req, res } = makeReqRes({});
    const next: NextFunction = vi.fn();
    await mw(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 409 if same key is replayed with a different body", async () => {
    // pre-seed
    store.set("test-key-12345678", {
      key: "test-key-12345678",
      scope: "/api/leads/",
      method: "POST",
      requestHash: "different-hash",
      status: 201,
      response: { id: "1" },
      expiresAt: new Date(Date.now() + 1_000_000),
    });
    const mw = idempotency();
    const { req, res } = makeReqRes({
      key: "test-key-12345678",
      body: { name: "Alice" },
    });
    const next: NextFunction = vi.fn();
    await mw(req, res, next);
    expect(res.statusCode).toBe(409);
    expect(next).not.toHaveBeenCalled();
  });
});
