import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * `<SlimHeader />` — the persistent identity strip that slides in once the
 * full page header scrolls out of view (UX_AUDIT_2 §R7).
 *
 * Renders via a portal into the `#slim-header-portal` slot defined inside
 * AppShell's main column. When active, it sits ABOVE the AppShell top bar
 * and visually replaces it within the content column only — it never
 * overlaps the sidebar.
 *
 * Drop two elements on the page:
 *
 * 1. The component itself, anywhere in the page (renders to portal).
 * 2. A `<SlimHeaderSentinel />` placed **at the bottom of your full header**.
 *
 * Layout (left → right): `[← Back]  {primary}  [chips/badges]  [actions]`
 */

export interface SlimHeaderProps {
  primary: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
  sentinelSelector?: string;
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
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Resolve portal target on mount (and retry if the slot mounts late).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const find = () => {
      const node = document.getElementById("slim-header-portal");
      if (node) { setPortalNode(node); return true; }
      return false;
    };
    if (find()) return;
    const id = window.setInterval(() => { if (find()) window.clearInterval(id); }, 50);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
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

  if (!portalNode) return null;

  const bar = (
    <div
      role="banner"
      aria-hidden={!visible}
      data-visible={visible}
      className={cn(
        // Lives inside #slim-header-portal (absolute-positioned in AppShell's
        // main column). Slides down from top via translate; when hidden, it
        // collapses pointer-events but keeps the portal slot non-blocking.
        "absolute inset-x-0 top-0 h-14 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 shadow-md",
        "transition-transform duration-150 ease-out",
        visible
          ? "translate-y-0 pointer-events-auto"
          : "-translate-y-full pointer-events-none",
        className,
      )}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        {!hideBack && (
          <button
            type="button"
            onClick={onBack ?? (() => window.history.back())}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-base"
          >
            <span aria-hidden>←</span>
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-base font-semibold text-foreground">
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

  return createPortal(bar, portalNode);
}

export function SlimHeaderSentinel({ className }: { className?: string }) {
  return <div data-slim-header-sentinel="true" aria-hidden className={className} />;
}
