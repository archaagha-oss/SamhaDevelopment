import * as React from "react";
import { cn } from "@/lib/utils";
import type { Crumb } from "../Breadcrumbs";
import { PageHeader } from "./PageHeader";
import { PageContainer } from "./PageContainer";

// DetailPageLayout — the canonical shape for any single-record page.
//
// Promised in design-system/PLACEMENT-LAWS.md ("a DetailPageLayout primitive
// will be added in Phase 2"); this is that primitive. Use it for every entity
// detail page: Lead, Deal, Unit, Member, Contact, Project, Payment Plan, etc.
//
// The shape:
//   ┌── PageHeader (sticky) ─────────────────────────────────────┐
//   │  Breadcrumbs                                               │
//   │  Title                                          [Actions]  │
//   │  Subtitle                                                  │
//   │  [Tabs]                                                    │
//   └────────────────────────────────────────────────────────────┘
//   ┌── max-w-5xl body, scrolls inside the shell ───────────────┐
//   │  [Hero slot — optional, e.g. avatar/name/status block]     │
//   │  [KPIs slot — optional, 2-4 column metric strip]           │
//   │  ┌──── 2/3 ────────────┐  ┌──── 1/3 sticky ──────────────┐ │
//   │  │ main                │  │ aside (sticks on desktop,    │ │
//   │  │ — sections-as-cards │  │   stacks below on mobile)    │ │
//   │  └─────────────────────┘  └──────────────────────────────┘ │
//   │  {children — modals, additional sections}                  │
//   └────────────────────────────────────────────────────────────┘

export interface DetailPageLayoutProps {
  /** Breadcrumb trail. First crumb is usually the parent list ("Team", "Leads"). */
  crumbs?: Crumb[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned slot — primary action(s) for this record (Edit, Delete, etc.). */
  actions?: React.ReactNode;
  /** Optional tab bar inside PageHeader (e.g. Overview / Activity / Documents). */
  tabs?: React.ReactNode;

  /**
   * Mobile-only slot rendered above the hero. Use for the primary next-step
   * affordance so it stays above the fold on small screens (the sticky right
   * rail collapses below the main column on mobile, hiding NextStepCard).
   */
  mobileTop?: React.ReactNode;
  /**
   * Mobile-only fixed bottom-bar slot. Renders on `lg:hidden` only; the
   * scroll area gets matching bottom padding so content isn't hidden
   * underneath. Pipedrive-style placement for the primary next-step.
   */
  mobileBottomBar?: React.ReactNode;
  /** Optional hero card above the two-column grid (avatar + status, etc.). */
  hero?: React.ReactNode;
  /** Optional KPI strip between hero and the two-column grid. */
  kpis?: React.ReactNode;

  /** Left column — 2/3 width on desktop, full on mobile. Required. */
  main: React.ReactNode;
  /** Right column — 1/3 width, sticky on desktop. Optional. */
  aside?: React.ReactNode;

  /** Optional render slot for modals / portals beneath the layout. */
  children?: React.ReactNode;

  className?: string;
}

export function DetailPageLayout({
  crumbs,
  title,
  subtitle,
  actions,
  tabs,
  mobileTop,
  mobileBottomBar,
  hero,
  kpis,
  main,
  aside,
  children,
  className,
}: DetailPageLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <PageHeader
        crumbs={crumbs}
        title={title}
        subtitle={subtitle}
        actions={actions}
        tabs={tabs}
        width="detail"
      />
      <div className="flex-1 overflow-auto">
        <PageContainer
          width="detail"
          padding="default"
          className={cn("space-y-5", mobileBottomBar && "pb-24 lg:pb-0")}
        >
          {mobileTop && <div className="lg:hidden">{mobileTop}</div>}
          {hero}
          {kpis}
          {aside ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5 min-w-0">{main}</div>
              <aside className="space-y-5 lg:sticky lg:top-[5.5rem] self-start">
                {aside}
              </aside>
            </div>
          ) : (
            <div className="space-y-5">{main}</div>
          )}
          {children}
        </PageContainer>
      </div>
      {mobileBottomBar && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] px-4 py-3">
          {mobileBottomBar}
        </div>
      )}
    </div>
  );
}

// ── Loading + not-found helpers ─────────────────────────────────────────────
// These are intentionally tiny — the goal is to give every detail page the
// same loading skeleton and the same not-found shape, without forcing every
// caller to compose the shell themselves.

export function DetailPageLoading({ crumbs, title }: { crumbs?: Crumb[]; title?: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader crumbs={crumbs} title={title ?? "Loading…"} width="detail" />
      <div className="flex-1 overflow-auto">
        <PageContainer width="detail" padding="default">
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading"
            className="bg-card rounded-xl border border-border flex items-center justify-center h-72"
          >
            <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
          </div>
        </PageContainer>
      </div>
    </div>
  );
}

export function DetailPageNotFound({
  crumbs,
  title = "Not found",
  message = "This record could not be loaded.",
  backHref,
  backLabel = "Go back",
  onBack,
}: {
  crumbs?: Crumb[];
  title?: React.ReactNode;
  message?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader crumbs={crumbs} title={title} width="detail" />
      <div className="flex-1 overflow-auto">
        <PageContainer width="detail" padding="default">
          <div className="bg-card rounded-xl border border-border py-16 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{message}</p>
            {(backHref || onBack) && (
              <a
                href={backHref}
                onClick={onBack ? (e) => { e.preventDefault(); onBack(); } : undefined}
                className="inline-block text-xs text-primary hover:underline"
              >
                ← {backLabel}
              </a>
            )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
