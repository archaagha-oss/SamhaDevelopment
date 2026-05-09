interface SkeletonProps {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
  ariaLabel?: string;
}

const ROUNDED: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

export function Skeleton({ className = "h-4 w-full", rounded = "md", ariaLabel }: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? "Loading"}
      aria-busy="true"
      className={`inline-block bg-neutral-200/70 animate-pulse ${ROUNDED[rounded]} ${className}`}
    />
  );
}

interface SkeletonRowsProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTableRows({ rows = 5, cols = 5 }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-border last:border-b-0">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className="h-3 w-full max-w-[200px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-3">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-2/3" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Skeleton className="h-16 w-full" rounded="lg" />
        <Skeleton className="h-16 w-full" rounded="lg" />
      </div>
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

export default Skeleton;
