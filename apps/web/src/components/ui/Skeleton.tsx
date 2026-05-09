interface Props {
  className?: string;
  /** Convenience: render N row skeletons with shared height. */
  rows?: number;
}

export function Skeleton({ className = "", rows }: Props) {
  if (rows && rows > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`animate-skeleton-pulse bg-slate-200/60 rounded ${className || "h-10 w-full"}`} />
        ))}
      </div>
    );
  }
  return <div className={`animate-skeleton-pulse bg-slate-200/60 rounded ${className || "h-4 w-full"}`} />;
}

/** Skeleton row matching a generic table layout. Drop-in for table loading state. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className={`h-4 ${j === 0 ? "w-1/4" : j === columns - 1 ? "w-16 ml-auto" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
