import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "w-3 h-3 border-2",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
  xl: "w-10 h-10 border-[3px]",
} as const;

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZES;
  /** Hidden visual label for screen readers. Defaults to "Loading". */
  label?: string;
}

export function Spinner({
  size = "lg",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className={cn(
        "inline-block rounded-full border-primary/40 border-t-transparent animate-spin shrink-0",
        SIZES[size],
        className
      )}
      {...props}
    />
  );
}

export default Spinner;
