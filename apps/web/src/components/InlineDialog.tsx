import { ReactNode, useRef } from "react";
import { useModalA11y } from "../hooks/useModalA11y";

interface InlineDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Accessible label for screen-readers. Required when the dialog has no
   * obvious heading inside `children`. If you have a visible <h*> in
   * children, set `aria-labelledby` on it and pass labelledBy here instead.
   */
  ariaLabel?: string;
  labelledBy?: string;
  /** Click outside the dialog content closes it. Default true. */
  closeOnBackdrop?: boolean;
  /** Tailwind class controlling the overlay tint / z-index. */
  overlayClassName?: string;
  /** Tailwind class applied to the click-stopping inner wrapper. */
  contentClassName?: string;
}

/**
 * Bare-bones modal overlay for cases where the project's <Modal> chrome
 * (title bar / footer slot) doesn't fit — e.g. inline confirmation cards
 * or panels that render their own custom header. Provides:
 *   - role="dialog" + aria-modal
 *   - focus-trap (Tab cycles inside the dialog)
 *   - Escape closes the dialog
 *   - body-scroll-lock while open
 *   - focus restoration on close
 *
 * Usage:
 *   <InlineDialog open={show} onClose={() => setShow(false)} ariaLabel="Confirm">
 *     <div className="bg-card rounded-2xl ...">…</div>
 *   </InlineDialog>
 */
export default function InlineDialog({
  open,
  onClose,
  children,
  ariaLabel,
  labelledBy,
  closeOnBackdrop = true,
  overlayClassName = "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
  contentClassName = "focus:outline-none",
}: InlineDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  if (!open) return null;

  return (
    <div
      className={overlayClassName}
      onClick={() => closeOnBackdrop && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={contentClassName}
      >
        {children}
      </div>
    </div>
  );
}
