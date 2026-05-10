import { ReactNode, useRef } from "react";
import { useModalA11y } from "../hooks/useModalA11y";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  ariaLabel,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4"
      onClick={() => closeOnBackdrop && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`bg-card rounded-xl shadow-2xl w-full ${SIZE[size]} max-h-[90vh] flex flex-col overflow-hidden focus:outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            {typeof title === "string" ? (
              <h2 className="font-semibold text-foreground text-sm">{title}</h2>
            ) : title}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="text-muted-foreground hover:text-foreground text-xl leading-none p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/50 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
