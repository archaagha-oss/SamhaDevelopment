import { useCallback, useState } from "react";
import type { z } from "zod";

export type FieldErrors = Record<string, string>;

/**
 * Lightweight inline-validation helper for forms that haven't migrated to
 * react-hook-form yet. Designed as a 30-line retrofit per page:
 *
 *   const schema = z.object({ firstName: z.string().min(1, "Required") });
 *   const { errors, validate, clearError } = useZodValidation(schema);
 *
 *   function submit() {
 *     if (!validate(form)) return;     // surfaces per-field messages
 *     // ...existing axios call
 *   }
 *
 *   <input
 *     value={form.firstName}
 *     onChange={(e) => { clearError("firstName"); setForm({ ...form, firstName: e.target.value }); }}
 *   />
 *   <FieldError errors={errors} name="firstName" />
 *
 * Why not just use react-hook-form? RHF is the long-term destination — this
 * helper gets the user-visible win (per-field red text, focus on first error)
 * without the 100+-line per-page rewrite. Migrate page-by-page later.
 */
export function useZodValidation<T>(schema: z.ZodType<T>) {
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = useCallback(
    (values: unknown): values is T => {
      const result = schema.safeParse(values);
      if (result.success) {
        setErrors({});
        // Focus the first invalid field for keyboard users — done in onSubmit
        // by reading errors[0]. Caller decides whether to also scroll.
        return true;
      }
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_root";
        // Keep the first message per path; later issues are usually
        // refinements that confuse rather than clarify in the UI.
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      // Best-effort focus on the first invalid field if it has [name] attr
      if (typeof document !== "undefined") {
        const first = Object.keys(next)[0];
        if (first) {
          const el = document.querySelector<HTMLElement>(
            `[name="${CSS.escape(first)}"], #${CSS.escape(first)}`
          );
          el?.focus?.();
        }
      }
      return false;
    },
    [schema]
  );

  const clearError = useCallback((field: string) => {
    setErrors((cur) => {
      if (!cur[field]) return cur;
      const next = { ...cur };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAll, setErrors };
}
