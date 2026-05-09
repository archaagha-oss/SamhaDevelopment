import { ReactNode, useId } from "react";

interface Props {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}

/**
 * Wraps a form input with consistent label / hint / error styling
 * and wires aria-describedby + aria-invalid automatically.
 *
 * Usage:
 *   <Field label="Email" required error={errors.email}>
 *     {(id) => <input id={id} value={email} onChange={...} className={inputClasses} />}
 *   </Field>
 */
export function Field({ label, hint, error, required, children, className = "" }: Props) {
  const baseId = useId();
  const fieldId = `field-${baseId}`;
  const hintId  = `hint-${baseId}`;
  const errId   = `err-${baseId}`;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="text-xs font-semibold text-slate-600">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {children(fieldId)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-400 mt-0.5">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs text-red-600 mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}

/** Standard input class string — use for inputs/selects/textareas across the app. */
export const inputClasses =
  "w-full border border-slate-200 rounded-ctrl px-3 py-2 text-sm bg-white " +
  "placeholder:text-slate-400 " +
  "focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 " +
  "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed " +
  "aria-invalid:border-red-400 aria-invalid:ring-red-100";

export const textareaClasses = inputClasses + " resize-y min-h-[80px]";
