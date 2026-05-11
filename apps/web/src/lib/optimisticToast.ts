import { toast } from "sonner";

/**
 * Optimistic action + undo toast (UX_AUDIT_2 §R5).
 *
 * Most "destructive-feeling" actions in a CRM (move stage, deactivate member,
 * clear filters, mark complete) aren't actually destructive — they're
 * reversible state changes. Showing a `ConfirmDialog` for these adds friction
 * with no safety benefit; an inline Undo toast is the modern pattern (Gmail,
 * Linear, HubSpot all do this).
 *
 * Pattern:
 *   1. Call `do()` immediately — the UI updates and the server write fires.
 *   2. Show a sonner toast with an "Undo" action for `undoWindowMs` (default 5s).
 *   3. If the user clicks Undo within the window, call `undo()` to reverse the
 *      server-side state. If not, no-op.
 *
 * Reserve `ConfirmDialog` for **truly destructive** actions only — anything
 * that can't be cleanly reversed (hard-delete records, revoke API keys, etc.).
 *
 * Errors from `do()` propagate to the caller via the returned promise; errors
 * from `undo()` show a separate toast (the caller already got success
 * feedback, so a failure to revert is its own UX moment).
 */
export interface OptimisticActionOptions<T> {
  /** The state change. Awaited; resolved value is returned to the caller. */
  do: () => Promise<T>;
  /** The reversal. Only called if the user clicks Undo within the window. */
  undo: () => Promise<void>;
  /** Success-message text shown in the toast. */
  message: string;
  /** Optional secondary description below the message. */
  description?: string;
  /** How long the Undo button stays available. Default 5000 ms. */
  undoWindowMs?: number;
  /** Override the "Undo" button label (e.g. "Bring back"). */
  undoLabel?: string;
  /**
   * Called after undo completes successfully. Use this to flip optimistic UI
   * back to the original state when the caller stores intermediate state
   * outside React Query / where the server response isn't enough.
   */
  onUndone?: () => void;
}

export async function optimisticAction<T>(opts: OptimisticActionOptions<T>): Promise<T> {
  const result = await opts.do();
  const windowMs = opts.undoWindowMs ?? 5000;
  const undoLabel = opts.undoLabel ?? "Undo";

  toast.success(opts.message, {
    description: opts.description,
    duration: windowMs,
    action: {
      label: undoLabel,
      onClick: async () => {
        try {
          await opts.undo();
          opts.onUndone?.();
          toast.success("Undone");
        } catch (err) {
          toast.error("Could not undo — please refresh and retry", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      },
    },
  });

  return result;
}
