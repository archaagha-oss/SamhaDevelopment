import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `<NextStepCard />` — the persistent "what to do next" affordance on detail
 * pages (UX_AUDIT_2 §R6).
 *
 * Mount it at the top of a sticky right rail; the audit's recommended host
 * markup is:
 *
 * ```tsx
 * <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
 *   <main className="overflow-hidden">…</main>
 *   <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
 *     <NextStepCard … />
 *   </aside>
 * </div>
 * ```
 *
 * For mobile, render the same component inside a `fixed inset-x-0 bottom-0`
 * wrapper at the page level (Pipedrive pattern) — that keeps the primitive
 * layout-agnostic.
 */

export type NextStepVariant = "primary" | "accent" | "success" | "warning";

export interface NextStepMetadata {
  label: string;
  value: ReactNode;
  /** Optional tone for the value text (matches the audit's allowed tokens). */
  tone?: "default" | "muted" | "warning" | "destructive" | "success";
}

export interface NextStepCardProps {
  /** Action label, e.g. "Move to QUALIFIED". */
  label: string;
  /** Short why-this-step description, e.g. "Last activity 4d ago". */
  description?: ReactNode;
  /** Click handler for the primary CTA. */
  onClick: () => void;
  /** Disable the primary CTA. */
  disabled?: boolean;
  /** Visual variant — drives the primary button colour. Default `primary`. */
  variant?: NextStepVariant;
  /** Secondary action shown under the primary CTA. */
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
  /** Read-only context strip rendered above the CTA. Up to 4 items. */
  metadata?: NextStepMetadata[];
  /** Extra classes on the outermost element. */
  className?: string;
  /**
   * Optional icon rendered to the left of the label inside the primary
   * button. Pass a `lucide-react` component instance.
   */
  icon?: ReactNode;
}

const VARIANT_BTN: Record<NextStepVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  accent:  "bg-accent-2 text-accent-2-foreground hover:bg-accent-2/90",
  success: "bg-success text-white hover:bg-success/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
};

const TONE_CLASS: Record<NonNullable<NextStepMetadata["tone"]>, string> = {
  default:     "text-foreground",
  muted:       "text-muted-foreground",
  warning:     "text-warning",
  destructive: "text-destructive",
  success:     "text-success",
};

export default function NextStepCard({
  label,
  description,
  onClick,
  disabled,
  variant = "primary",
  secondary,
  metadata,
  className,
  icon,
}: NextStepCardProps) {
  return (
    <section
      aria-label="Next step"
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Next step
      </p>

      {metadata && metadata.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {metadata.map((m, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">{m.label}</span>
              <span className={cn("font-medium tabular-nums", TONE_CLASS[m.tone ?? "default"])}>
                {m.value}
              </span>
            </li>
          ))}
        </ul>
      )}

      {description && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANT_BTN[variant],
        )}
      >
        {icon}
        <span>{label}</span>
        <ChevronRight className="size-4 opacity-80" />
      </button>

      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
          disabled={secondary.disabled}
          className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
        >
          {secondary.label}
        </button>
      )}
    </section>
  );
}
