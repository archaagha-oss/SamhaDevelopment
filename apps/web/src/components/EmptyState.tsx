import * as React from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Decorative icon. Defaults to a lucide Inbox. Pass a lucide icon
   * (`<Inbox className="size-10" aria-hidden="true" />`) — string emojis are
   * accepted for backwards compatibility but should be migrated. */
  icon?: React.ReactNode;
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

  const renderedIcon =
    typeof icon === "string" || typeof icon === "number" ? (
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
    ) : (
      icon ?? <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
    );

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-3 opacity-60 flex items-center justify-center">{renderedIcon}</div>
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
