import * as React from "react";
import { cn } from "@/lib/utils";

// BulkActionBar — slides in above the table when one or more rows are
// selected. Replaces the per-page bespoke selection UI with a single
// primitive used the same way everywhere.
//
// Usage:
//   <BulkActionBar
//     selectedCount={selected.size}
//     totalCount={visibleRows.length}
//     onClear={() => setSelected(new Set())}
//     onSelectAll={selectAllVisible}
//     actions={[
//       { label: "Assign agent", onClick: bulkAssign },
//       { label: "Change stage", onClick: bulkStage },
//       { label: "Export",        onClick: bulkExport, variant: "secondary" },
//       { label: "Delete",        onClick: bulkDelete, variant: "destructive" },
//     ]}
//   />

export interface BulkAction {
  label: string;
  onClick: () => void;
  /** Style intent. Default neutral. */
  variant?: "default" | "secondary" | "destructive";
  disabled?: boolean;
  /** Optional aria-label override. */
  ariaLabel?: string;
}

export interface BulkActionBarProps {
  /** How many rows the user has currently selected. Bar hides when 0. */
  selectedCount: number;
  /** Total visible rows. Enables "Select all visible" when greater than selectedCount. */
  totalCount?: number;
  /** Clear selection (× button on the left). */
  onClear: () => void;
  /** Optional "Select all visible" handler — link appears when not all visible are selected. */
  onSelectAll?: () => void;
  /** Right-aligned action buttons. */
  actions: BulkAction[];
  className?: string;
}

const variantClasses: Record<NonNullable<BulkAction["variant"]>, string> = {
  default:     "bg-card hover:bg-muted text-foreground border border-border",
  secondary:   "bg-muted/60 hover:bg-muted text-foreground border border-border",
  destructive: "bg-destructive-soft hover:bg-destructive/20 text-destructive border border-destructive/30",
};

export function BulkActionBar({
  selectedCount,
  totalCount,
  onClear,
  onSelectAll,
  actions,
  className,
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  const allVisibleSelected = totalCount != null && selectedCount >= totalCount;

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}`}
      className={cn(
        "flex items-center gap-2 flex-wrap bg-info-soft border border-primary/30 rounded-lg px-3 py-2 text-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="text-muted-foreground hover:text-foreground rounded px-1 leading-none text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ×
      </button>
      <span className="font-medium text-info-soft-foreground tabular-nums">
        {selectedCount} selected
      </span>
      {!allVisibleSelected && onSelectAll && totalCount != null && (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs text-primary hover:underline"
        >
          Select all {totalCount}
        </button>
      )}
      <div className="ml-auto flex items-center gap-1.5 flex-wrap">
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            aria-label={a.ariaLabel ?? a.label}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              variantClasses[a.variant ?? "default"],
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
