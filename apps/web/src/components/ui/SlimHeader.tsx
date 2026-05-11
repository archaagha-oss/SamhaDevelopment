import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `<SlimHeader />` — the persistent identity strip that slides in once the
 * full page header scrolls out of view (UX_AUDIT_2 §R7).
 *
 * Drop two elements on the page:
 *
 * 1. The component itself, near the top. It listens for `<SlimHeaderSentinel />`
 *    leaving the viewport and toggles its own `fixed` visibility accordingly.
 * 2. A `<SlimHeaderSentinel />` placed **at the bottom of your full header**.
 *    Any divider element with `data-slim-header-sentinel="true"` also works,
 *    but the dedicated component keeps the wiring obvious.
 *
 * The slim header is ARIA-hidden when invisible so it doesn't pollute the
 * screen-reader tab order.
 *
 * Layout (left → right): `[← Back]  {primary}  [chips/badges]  [actions]`
 */

export interface SlimHeaderProps {
  /**
   * Identity slot — the entity ID + a short label (e.g.
   * `<span>Deal-2026-0123 · Mohamed Ali</span>`). Always shown.
   */
  primary: ReactNode;
  /** Status / stage badges rendered after the identity. */
  badges?: ReactNode;
  /** Right-aligned actions (e.g. the same NextStepCard primary button). */
  actions?: ReactNode;
  /** Back-button click handler. If omitted, browser history.back() is used. */
  onBack?: () => void;
  /** Hide the back button entirely. */
  hideBack?: boolean;
  /**
   * Optional override for the sentinel-selector. Use this to point at an
   * arbitrary element that determines when the header should appear. Default
   * is `[data-slim-header-sentinel="true"]`.
   */
  sentinelSelector?: string;
  /** Extra classes on the fixed container. */
  className?: string;
}

export default function SlimHeader({
  primary,
  badges,
  actions,
  onBack,
  hideBack,
  sentinelSelector = "[data-slim-header-sentinel=\"true\"]",
  className,
}: SlimHeaderProps) {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }
    const sentinel = document.querySelector(sentinelSelector);
    if (!sentinel) return;

    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px" },
    );
    obs.observe(sentinel);
    observerRef.current = obs;
    return () => obs.disconnect();
  }, [sentinelSelector]);

  return (
    <div
      role="banner"
      aria-hidden={!visible}
      data-visible={visible}
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-12 border-b border-border bg-card shadow-sm",
        "transition-transform duration-150 ease-out",
        visible ? "translate-y-0" : "-translate-y-full pointer-events-none",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center gap-3 px-4">
        {!hideBack && (
          <button
            type="button"
            onClick={onBack ?? (() => window.history.back())}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span aria-hidden>←</span>
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-foreground">
          {primary}
        </div>
        {badges && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {badges}
          </div>
        )}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Place this where you want the slim header to appear from (typically the
 * very last element of your full header).
 */
export function SlimHeaderSentinel({ className }: { className?: string }) {
  return <div data-slim-header-sentinel="true" aria-hidden className={className} />;
}
