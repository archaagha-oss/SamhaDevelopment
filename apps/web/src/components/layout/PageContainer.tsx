import * as React from "react";
import { cn } from "@/lib/utils";

type Width = "narrow" | "detail" | "default" | "wide" | "full";
type Padding = "default" | "compact" | "flush";

const WIDTHS: Record<Width, string> = {
  narrow: "max-w-3xl",
  // Detail pages — `max-w-5xl` per design-system/MASTER.md §4. Narrower than
  // a list page so single-record content reads as a focused form/profile.
  detail: "max-w-5xl",
  default: "max-w-7xl",
  wide: "max-w-screen-2xl",
  full: "max-w-none",
};

const PADDINGS: Record<Padding, string> = {
  default: "px-4 sm:px-6 py-5",
  compact: "px-4 sm:px-6 py-3",
  flush: "p-0",
};

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: Width;
  padding?: Padding;
}

export const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ width = "default", padding = "default", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mx-auto w-full", WIDTHS[width], PADDINGS[padding], className)}
      {...props}
    >
      {children}
    </div>
  )
);
PageContainer.displayName = "PageContainer";
