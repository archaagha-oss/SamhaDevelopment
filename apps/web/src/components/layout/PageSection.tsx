import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** When true, wraps the body in a card surface (bg-card, rounded, border). */
  bordered?: boolean;
}

export function PageSection({
  title,
  description,
  actions,
  bordered = false,
  className,
  children,
  ...props
}: PageSectionProps) {
  const hasHeader = title || description || actions;
  return (
    <section className={cn("space-y-3", className)} {...props}>
      {hasHeader && (
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      <div
        className={cn(
          bordered && "rounded-xl border border-border bg-card overflow-hidden"
        )}
      >
        {children}
      </div>
    </section>
  );
}
