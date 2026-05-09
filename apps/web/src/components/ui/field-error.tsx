import type { FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";

interface FieldErrorProps {
  errors: FieldErrors;
  name: string;
  className?: string;
}

/**
 * Inline error message rendered under a form field. Renders nothing when the
 * field is valid, so there's no layout jump.
 */
export default function FieldError({ errors, name, className }: FieldErrorProps) {
  const message = errors[name];
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn("mt-1 text-xs text-destructive", className)}
      id={`${name}-error`}
    >
      {message}
    </p>
  );
}
