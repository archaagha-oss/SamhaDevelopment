import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveJobQueueBackend } from "../events/jobs/queueBackend";

// ---------------------------------------------------------------------------
// resolveJobQueueBackend — env-var gating used by index.ts
// ---------------------------------------------------------------------------

describe("resolveJobQueueBackend (env gate)", () => {
  it("defaults to 'db' when JOB_QUEUE_BACKEND is unset", () => {
    expect(resolveJobQueueBackend({})).toBe("db");
  });

  it("returns 'db' when JOB_QUEUE_BACKEND='db'", () => {
    expect(resolveJobQueueBackend({ JOB_QUEUE_BACKEND: "db" })).toBe("db");
  });

  it("returns 'bullmq' when JOB_QUEUE_BACKEND='bullmq'", () => {
    expect(resolveJobQueueBackend({ JOB_QUEUE_BACKEND: "bullmq" })).toBe("bullmq");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(resolveJobQueueBackend({ JOB_QUEUE_BACKEND: "  BullMQ  " })).toBe("bullmq");
    expect(resolveJobQueueBackend({ JOB_QUEUE_BACKEND: "DB" })).toBe("db");
  });

  it("falls back to 'db' on unrecognised values (so a typo doesn't break boot)", () => {
    expect(resolveJobQueueBackend({ JOB_QUEUE_BACKEND: "kafka" })).toBe("db");
    expect(resolveJobQueueBackend({ JOB_QUEUE_BACKEND: "" })).toBe("db");
  });
});

// ---------------------------------------------------------------------------
// createBullmqAdapter — lazy-load behaviour
// ---------------------------------------------------------------------------
//
// We mock dynamic imports of `bullmq` and `ioredis` so the test can run on a
// CI host that doesn't have those optional deps installed.

describe("createBullmqAdapter (lazy-load behaviour)", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    vi.doUnmock("bullmq");
    vi.doUnmock("ioredis");
  });

  it("throws a clear error when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { createBullmqAdapter } = await import("../events/jobs/bullmqAdapter");
    await expect(createBullmqAdapter()).rejects.toThrow(/REDIS_URL is not set/);
  });

  it("throws a friendly error when 'bullmq' optional dep is missing", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    // Simulate "module not installed" — vitest will throw a resolution error
    // when the dynamic import inside createBullmqAdapter() runs.
    vi.doMock("bullmq", () => {
      throw new Error("Cannot find module 'bullmq'");
    });

    const { createBullmqAdapter } = await import("../events/jobs/bullmqAdapter");
    await expect(createBullmqAdapter()).rejects.toThrow(
      /Failed to load 'bullmq' \/ 'ioredis' optional dependencies/
    );
  });

  it("throws a friendly error when 'ioredis' optional dep is missing", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    // bullmq loads fine, but ioredis fails — should still surface the
    // generic "optional dependencies" error message.
    vi.doMock("bullmq", () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Queue: class {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Worker: class {} as any,
    }));
    vi.doMock("ioredis", () => {
      throw new Error("Cannot find module 'ioredis'");
    });

    const { createBullmqAdapter } = await import("../events/jobs/bullmqAdapter");
    await expect(createBullmqAdapter()).rejects.toThrow(
      /Failed to load 'bullmq' \/ 'ioredis' optional dependencies/
    );
  });

  it("module loads fine when bullmq isn't installed (no top-level import)", async () => {
    // The whole point of lazy-loading: importing the file must NOT explode
    // even if bullmq + ioredis aren't installed. We don't call
    // createBullmqAdapter(); we just verify the module evaluates.
    delete process.env.REDIS_URL;

    vi.doMock("bullmq", () => {
      throw new Error("Cannot find module 'bullmq'");
    });
    vi.doMock("ioredis", () => {
      throw new Error("Cannot find module 'ioredis'");
    });

    const mod = await import("../events/jobs/bullmqAdapter");
    expect(typeof mod.createBullmqAdapter).toBe("function");
    expect(typeof mod.bullmqScheduleJob).toBe("function");
    expect(typeof mod.bullmqShutdown).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// bullmqShutdown — idempotent when no adapter active
// ---------------------------------------------------------------------------

describe("bullmqShutdown", () => {
  it("is safe to call when no adapter has been created", async () => {
    const { bullmqShutdown, __resetActiveAdapter } = await import(
      "../events/jobs/bullmqAdapter"
    );
    __resetActiveAdapter();
    await expect(bullmqShutdown()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// bullmqScheduleJob — guards against being called before adapter created
// ---------------------------------------------------------------------------

describe("bullmqScheduleJob", () => {
  it("throws if called before createBullmqAdapter()", async () => {
    const { bullmqScheduleJob, __resetActiveAdapter } = await import(
      "../events/jobs/bullmqAdapter"
    );
    __resetActiveAdapter();
    await expect(
      bullmqScheduleJob("PAYMENT_REMINDER_SWEEP", {})
    ).rejects.toThrow(/called before createBullmqAdapter/);
  });
});
