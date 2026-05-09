import { ReactNode } from "react";
import { Pencil } from "lucide-react";

export interface InfoItem {
  label: string;
  value: ReactNode;
  /** When provided, shows a small ✎ button next to the value. */
  onEdit?: () => void;
  /** Override the layout for one row (e.g. full-width long text). */
  fullWidth?: boolean;
  /** When true, value is rendered as a link/button. */
  href?: string;
}

interface Props {
  title?: string;
  items: InfoItem[];
  /** Defaults to a card; pass `false` to render flat. */
  bordered?: boolean;
  className?: string;
}

/**
 * Standard metadata sidebar block — used in Lead/Unit/Deal/Broker
 * detail pages to display contact info, project details, RERA info, etc.
 *
 * Each row: label (uppercase caption) + value (semibold) + optional inline edit.
 */
export function InfoList({ title, items, bordered = true, className = "" }: Props) {
  return (
    <section
      className={[
        bordered ? "bg-white rounded-card border border-slate-200 p-5 shadow-card" : "",
        className,
      ].join(" ")}
    >
      {title && (
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          {title}
        </h3>
      )}
      <dl className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className={item.fullWidth ? "" : "flex items-start justify-between gap-4"}>
            <dt className="text-xs text-slate-400 font-medium flex-shrink-0">{item.label}</dt>
            <dd className={`text-sm font-medium text-slate-800 min-w-0 ${item.fullWidth ? "mt-0.5" : "text-right"}`}>
              <span className="inline-flex items-center gap-1.5">
                {item.value || <span className="text-slate-400">—</span>}
                {item.onEdit && (
                  <button
                    onClick={item.onEdit}
                    className="text-slate-300 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    aria-label={`Edit ${item.label}`}
                    title={`Edit ${item.label}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
