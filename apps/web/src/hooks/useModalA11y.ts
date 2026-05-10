import { useEffect, RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface Options {
  open: boolean;
  onClose: () => void;
  /** Element ref the focus-trap is scoped to. */
  containerRef: RefObject<HTMLElement | null>;
  /** Disable body scroll while open. Default true. */
  lockScroll?: boolean;
  /** Auto-focus the first focusable child on open. Default true. */
  autoFocus?: boolean;
  /** Restore focus to the previously-focused element on close. Default true. */
  restoreFocus?: boolean;
}

/**
 * Accessibility behaviour for any custom modal / sheet / drawer:
 *  - Tab/Shift-Tab cycles focus inside `containerRef`
 *  - Escape calls onClose
 *  - Body scroll is locked while open
 *  - Focus is restored to the previously-focused element on close
 *
 * Mount this in any component that builds its own modal layout (centered
 * dialog, slide-over panel, image lightbox). The shared <Modal> component
 * uses it internally; reuse it directly when <Modal>'s default layout
 * doesn't fit.
 *
 * Example:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useModalA11y({ open: isOpen, onClose, containerRef: ref });
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 */
export function useModalA11y({
  open,
  onClose,
  containerRef,
  lockScroll = true,
  autoFocus = true,
  restoreFocus = true,
}: Options): void {
  useEffect(() => {
    if (!open) return;
    const lastFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    let timeout: number | undefined;
    if (autoFocus) {
      timeout = window.setTimeout(() => {
        const root = containerRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(FOCUSABLE);
        const target = focusables[0] ?? root;
        target.focus();
      }, 0);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      if (restoreFocus) lastFocused?.focus?.();
    };
  }, [open, onClose, containerRef, lockScroll, autoFocus, restoreFocus]);
}
