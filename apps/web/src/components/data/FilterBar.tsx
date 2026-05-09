import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

export interface SortDef {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

export interface ViewDef {
  value: string;
  onChange: (value: string) => void;
  views: Array<{ value: string; label: string; icon?: React.ReactNode }>;
}

export interface SearchDef {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export interface FilterBarProps {
  /** Search input. Always renders top-left. */
  search?: SearchDef;
  /** Filter dropdowns. Render immediately right of search. */
  filters?: FilterDef[];
  /** Sort dropdown. Renders right-aligned alongside view switcher. */
  sort?: SortDef;
  /** Table/kanban/grid switcher. Renders far-right. */
  view?: ViewDef;
  /** Extra slot for one-off controls (e.g. an "Active only" checkbox). Renders before sort/view. */
  extra?: React.ReactNode;
  className?: string;
}

const SELECT_CLASSES =
  "h-9 text-sm border border-input rounded-lg px-2.5 bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-[14rem]";

export function FilterBar({
  search,
  filters,
  sort,
  view,
  extra,
  className,
}: FilterBarProps) {
  const hasLeft = search || (filters && filters.length > 0);
  const hasRight = extra || sort || view;

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        className
      )}
      role="toolbar"
      aria-label="List filters"
    >
      {hasLeft && (
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {search && (
            <div className="relative flex-1 min-w-[12rem] max-w-md">
              <Search
                aria-hidden="true"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <input
                type="search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Search…"}
                aria-label={search.ariaLabel ?? search.placeholder ?? "Search"}
                className="h-9 w-full text-sm border border-input rounded-lg pl-8 pr-3 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              aria-label={f.label}
              className={SELECT_CLASSES}
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
      {hasRight && (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {extra}
          {sort && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sort.value}
                onChange={(e) => sort.onChange(e.target.value)}
                aria-label="Sort"
                className={SELECT_CLASSES}
              >
                {sort.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view && (
            <div
              className="inline-flex border border-border rounded-lg overflow-hidden text-xs"
              role="tablist"
              aria-label="View mode"
            >
              {view.views.map((v) => {
                const active = view.value === v.value;
                return (
                  <button
                    key={v.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => view.onChange(v.value)}
                    className={cn(
                      "px-2.5 py-1.5 font-medium transition-colors flex items-center gap-1.5",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {v.icon}
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
