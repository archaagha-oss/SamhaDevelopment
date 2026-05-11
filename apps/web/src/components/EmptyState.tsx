import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /**
   * Optional icon. Pass a lucide-react component (e.g. `<Building2 className="size-12" />`)
   * or any other ReactNode. Defaults to a muted inbox icon.
   * Legacy callers may pass a string — rendered as-is for backwards compat but
   * UX_AUDIT_2 R1 disallows emoji in production; migrate to lucide.
   */
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: { label: string; onClick: () => void };
  variant?: "default" | "compact";
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  variant = "default",
}: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">{title}</p>
      </div>
    );
  }

  const label = actionLabel ?? action?.label;
  const handler = onAction ?? action?.onClick;

  const resolvedIcon = icon ?? <Inbox className="size-12 text-muted-foreground" aria-hidden />;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-3 opacity-60">{resolvedIcon}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {label && handler && (
        <Button onClick={handler} className="mt-4" size="sm">
          {label}
        </Button>
      )}
    </div>
  );
}
