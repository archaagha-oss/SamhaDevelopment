import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * useOptimisticUpdate — Instant UI feedback with rollback on error
 *
 * Usage:
 * const { update, isLoading } = useOptimisticUpdate(state, setState);
 *
 * update(async () => {
 *   return axios.patch(`/api/units/${id}`, { price: 500000 });
 * })
 * .then((result) => {
 *   setState(result);
 *   toast.success("Updated!");
 * })
 */
export function useOptimisticUpdate(state, setState) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = useCallback(
    async (asyncUpdate, optimisticUpdate = null) => {
      const previousState = state;
      setIsLoading(true);
      setError(null);

      try {
        // Apply optimistic update immediately
        if (optimisticUpdate) {
          setState(optimisticUpdate);
        }

        // Execute async operation
        const result = await asyncUpdate();

        // Update with actual result
        setState(result?.data || result);
        setIsLoading(false);
        return result?.data || result;
      } catch (err) {
        // Rollback on error
        setState(previousState);
        setIsLoading(false);

        const errorMsg =
          err.response?.data?.error || err.message || "Update failed";
        setError(errorMsg);
        toast.error(errorMsg);

        throw err;
      }
    },
    [state, setState]
  );

  return { update, isLoading, error };
}
