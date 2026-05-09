import { ReactNode, useId } from "react";
import { Search, X } from "lucide-react";
import { inputClasses } from "./Field";

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

interface ChipProps {
  label: string;
  onRemove: () => void;
}

interface Props {
  search?: SearchProps;
  chips?: ChipProps[];
  onClearAll?: () => void;
  trailing?: ReactNode;
  /** Toolbar-area children (filter selects, etc.) sit between search and trailing. */
  children?: ReactNode;
  className?: string;
}

export function FilterBar({ search, chips, onClearAll, trailing, children, className = "" }: Props) {
  const id = useId();
  const hasChips = chips && chips.length > 0;

  return (
    <div className={`bg-white border-b border-slate-200 px-6 py-3 ${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {search && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              id={`search-${id}`}
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Search…"}
              className={`${inputClasses} pl-9`}
            />
          </div>
        )}
        {children}
        {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
      </div>
      {hasChips && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {chips!.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs ring-1 ring-blue-200"
            >
              {c.label}
              <button
                type="button"
                onClick={c.onRemove}
                aria-label={`Remove filter ${c.label}`}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
