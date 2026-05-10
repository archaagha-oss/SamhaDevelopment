import { useCallback } from "react";
import { toast } from "sonner";
import axios, { AxiosError } from "axios";

export interface OptimisticConflictPayload<T = unknown> {
  error: string;
  code: "OPTIMISTIC_LOCK_CONFLICT";
  statusCode: 409;
  currentVersion: number;
  currentRow: T | null;
}

interface Options<T> {
  /**
   * Called when the conflict is acknowledged ("Reload" clicked, or auto-reload
   * if `autoReload` is true). Receives the server's snapshot of the row so the
   * caller can hydrate without a second roundtrip.
   */
  onReload: (current: T | null) => void;
  /**
   * Skip the toast prompt and call onReload immediately. Useful for screens
   * that have no in-progress edit state to lose (e.g. a read-only detail view).
   * Defaults to false.
   */
  autoReload?: boolean;
}

/**
 * Wrap a mutation that may collide with another agent's edit. The backend
 * returns 409 + { code: "OPTIMISTIC_LOCK_CONFLICT", currentVersion, currentRow }
 * — see apps/api/src/lib/optimisticLock.ts.
 *
 * Usage:
 *   const handleConflict = useOptimisticConflict({
 *     onReload: (fresh) => fresh && hydrateForm(fresh),
 *   });
 *   try {
 *     await axios.patch(`/api/leads/${id}`, { ...payload, expectedVersion });
 *   } catch (err) {
 *     if (handleConflict(err)) return;  // toast was shown; bail out
 *     throw err;                         // not a conflict — propagate
 *   }
 *
 * Returns true if the error was a 409 conflict (toast was shown / autoReload
 * fired), false otherwise. The caller should treat `true` as "handled, don't
 * surface a generic error".
 */
export function useOptimisticConflict<T = unknown>(opts: Options<T>) {
  const { onReload, autoReload = false } = opts;

  return useCallback(
    (err: unknown): boolean => {
      if (!axios.isAxiosError(err)) return false;
      const ax = err as AxiosError<OptimisticConflictPayload<T>>;
      if (ax.response?.status !== 409) return false;
      if (ax.response?.data?.code !== "OPTIMISTIC_LOCK_CONFLICT") return false;

      const fresh = ax.response.data.currentRow ?? null;
      if (autoReload) {
        onReload(fresh);
        return true;
      }

      // Sticky toast with an explicit Reload action — we don't want this to
      // disappear on its own because the user is about to lose their edits.
      toast.error(
        ax.response.data.error ||
          "This record was edited by someone else. Reload to see the latest before retrying.",
        {
          duration: Infinity,
          action: {
            label: "Reload",
            onClick: () => onReload(fresh),
          },
        },
      );
      return true;
    },
    [onReload, autoReload],
  );
}
