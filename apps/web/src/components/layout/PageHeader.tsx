import * as React from "react";
import { cn } from "@/lib/utils";
import Breadcrumbs, { type Crumb } from "../Breadcrumbs";
import { PageContainer } from "./PageContainer";

export interface PageHeaderProps {
  crumbs?: Crumb[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned slot. The placement law: primary action lives top-right of PageHeader. */
  actions?: React.ReactNode;
  /** Slot rendered below title row, above the bottom border. Use for sub-tabs (e.g. PENDING/APPROVED/PAID). */
  tabs?: React.ReactNode;
  sticky?: boolean;
  width?: "narrow" | "detail" | "default" | "wide" | "full";
  className?: string;
}

export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
  tabs,
  sticky = true,
  width = "default",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "bg-card border-b border-border flex-shrink-0",
        sticky && "sticky top-0 z-10",
        className
      )}
    >
      <PageContainer width={width} padding="flush" className="px-4 sm:px-6 py-4">
        {crumbs && crumbs.length > 0 && (
          <Breadcrumbs variant="light" crumbs={crumbs} className="mb-2" />
        )}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </PageContainer>
      {tabs && (
        <div className="border-t border-border">
          <PageContainer width={width} padding="flush" className="px-4 sm:px-6">
            {tabs}
          </PageContainer>
        </div>
      )}
    </header>
  );
}
