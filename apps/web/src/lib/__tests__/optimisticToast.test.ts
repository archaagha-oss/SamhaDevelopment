import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const success = vi.fn();
  const error = vi.fn();
  return {
    toast: Object.assign((..._a: unknown[]) => {}, { success, error }),
  };
});

import { toast } from "sonner";
import { optimisticAction } from "../optimisticToast";

describe("optimisticAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs do() and returns its resolved value", async () => {
    const doFn = vi.fn().mockResolvedValue({ id: 42 });
    const undoFn = vi.fn();

    const result = await optimisticAction({
      do: doFn,
      undo: undoFn,
      message: "Lead moved",
    });

    expect(doFn).toHaveBeenCalledOnce();
    expect(result).toEqual({ id: 42 });
    expect(undoFn).not.toHaveBeenCalled();
  });

  it("surfaces a sonner toast with an Undo action and the configured window", async () => {
    await optimisticAction({
      do: async () => "ok",
      undo: async () => {},
      message: "Lead moved to QUALIFIED",
      description: "+1 stage",
      undoWindowMs: 8000,
    });

    expect(toast.success).toHaveBeenCalledOnce();
    const [msg, opts] = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toBe("Lead moved to QUALIFIED");
    expect(opts).toMatchObject({
      description: "+1 stage",
      duration: 8000,
      action: { label: "Undo" },
    });
  });

  it("defaults the window to 5000ms and the label to 'Undo'", async () => {
    await optimisticAction({
      do: async () => null,
      undo: async () => {},
      message: "Done",
    });
    const [, opts] = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.duration).toBe(5000);
    expect(opts.action.label).toBe("Undo");
  });

  it("calls undo() and the onUndone callback when the action button fires", async () => {
    const undoFn = vi.fn().mockResolvedValue(undefined);
    const onUndone = vi.fn();

    await optimisticAction({
      do: async () => null,
      undo: undoFn,
      message: "Reverted",
      onUndone,
    });

    const [, opts] = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    await opts.action.onClick();

    expect(undoFn).toHaveBeenCalledOnce();
    expect(onUndone).toHaveBeenCalledOnce();
    // First call: the original success toast. Second call: the "Undone" success.
    expect((toast.success as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces a sonner error toast when undo() throws", async () => {
    const undoFn = vi.fn().mockRejectedValue(new Error("server 500"));

    await optimisticAction({
      do: async () => null,
      undo: undoFn,
      message: "Reverted",
    });

    const [, opts] = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    await opts.action.onClick();

    expect(toast.error).toHaveBeenCalledOnce();
    expect((toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1].description).toBe("server 500");
  });

  it("propagates errors from do() to the caller", async () => {
    const doFn = vi.fn().mockRejectedValue(new Error("create failed"));
    const undoFn = vi.fn();

    await expect(
      optimisticAction({ do: doFn, undo: undoFn, message: "Won't be shown" }),
    ).rejects.toThrow("create failed");

    expect(undoFn).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
