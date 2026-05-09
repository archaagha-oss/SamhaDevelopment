import { ReactNode } from "react";

interface Props {
  /** Sticky page header (PageHeader / custom). Stays pinned while body scrolls. */
  header: ReactNode;
  /** Optional sub-navigation (Tabs) rendered immediately below the header, also sticky. */
  subnav?: ReactNode;
  /** Main content area (left/center column on wide viewports). */
  main: ReactNode;
  /** Right sidebar — sticky on wide viewports, stacks below main on mobile. */
  sidebar?: ReactNode;
  /** Sidebar width. Defaults to medium (320px). */
  sidebarWidth?: "sm" | "md" | "lg";
  className?: string;
}

const SIDEBAR_WIDTH: Record<NonNullable<Props["sidebarWidth"]>, string> = {
  sm: "lg:w-72",   // 288px
  md: "lg:w-80",   // 320px
  lg: "lg:w-96",   // 384px
};

/**
 * Standard detail-page shell:
 * - Sticky header (+ optional subnav tabs)
 * - Two-column body on lg screens (main + sidebar)
 * - Stacks vertically on mobile
 *
 * Use it for Lead / Unit / Deal / Broker detail pages.
 */
export function DetailLayout({ header, subnav, main, sidebar, sidebarWidth = "md", className = "" }: Props) {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="sticky top-0 z-20 bg-white">
        {header}
        {subnav && <div className="px-6 bg-white border-b border-slate-200">{subnav}</div>}
      </div>
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col-reverse lg:flex-row gap-5">
            <div className="flex-1 min-w-0 space-y-4">{main}</div>
            {sidebar && (
              <aside
                className={`flex-shrink-0 space-y-4 ${SIDEBAR_WIDTH[sidebarWidth]}`}
                aria-label="Details sidebar"
              >
                {sidebar}
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
