import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ReactNode } from "react";
import { IconButton } from "./Button";

type Width = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const WIDTH: Record<Width, string> = {
  sm:  "max-w-sm",
  md:  "max-w-md",
  lg:  "max-w-lg",
  xl:  "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: Width;
  hideCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** When true, clicking outside or pressing Escape will not close. Use for forms with unsaved data. */
  preventClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  width = "lg",
  hideCloseButton = false,
  children,
  footer,
  preventClose = false,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in"
          onClick={preventClose ? (e) => e.preventDefault() : undefined}
        />
        <Dialog.Content
          onPointerDownOutside={preventClose ? (e) => e.preventDefault() : undefined}
          onEscapeKeyDown={preventClose ? (e) => e.preventDefault() : undefined}
          className={[
            "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
            WIDTH[width],
            "bg-white rounded-card shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col",
            "focus:outline-none",
          ].join(" ")}
        >
          <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-slate-900 truncate">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {!hideCloseButton && (
              <Dialog.Close asChild>
                <IconButton
                  icon={<X className="h-4 w-4" />}
                  label="Close dialog"
                  size="sm"
                  variant="subtle"
                />
              </Dialog.Close>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {footer && (
            <footer className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-card">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
