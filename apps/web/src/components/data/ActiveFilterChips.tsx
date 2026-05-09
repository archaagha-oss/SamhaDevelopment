import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilterChip {
  key: string;
  /** Field name shown before the colon, e.g. "Source". */
  label: string;
  /** Current value, shown after the colon, e.g. "BROKER". */
  value: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  chips: ActiveFilterChip[];
  onClearAll?: () => void;
  className?: string;
}

/**
 * Renders the current active filters as removable chips.
 * Placement law: always render this immediately under FilterBar — never elsewhere.
 * When chips is empty, the component renders nothing (so the layout is stable).
 */
export function ActiveFilterChips({
  chips,
  onClearAll,
  className,
}: ActiveFilterChipsProps) {
  if (!chips || chips.length === 0) return null;

  return (
    <div
      className={cn("flex items-center gap-2 flex-wrap", className)}
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary text-secondary-foreground text-xs font-medium pl-2.5 pr-1 py-0.5"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span>{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label} filter`}
            className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-primary hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
