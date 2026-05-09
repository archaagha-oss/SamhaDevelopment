import { ReactNode } from "react";
import { timeAgo } from "../../lib/format";

export type TimelineKind =
  | "neutral" | "info" | "success" | "warning" | "danger" | "progress" | "muted";

export interface TimelineItem {
  id: string;
  at: string | Date;
  kind?: TimelineKind;
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  by?: string;
}

interface Props {
  items: TimelineItem[];
  className?: string;
  emptyLabel?: string;
}

const DOT: Record<TimelineKind, string> = {
  neutral:  "bg-slate-300",
  info:     "bg-blue-500",
  success:  "bg-emerald-500",
  warning:  "bg-amber-500",
  danger:   "bg-red-500",
  progress: "bg-violet-500",
  muted:    "bg-slate-200",
};

/**
 * Vertical activity-feed timeline. Use for lead/deal/unit detail pages
 * to render the "spine" of every touchpoint logged.
 */
export function Timeline({ items, className = "", emptyLabel = "No activity yet" }: Props) {
  if (items.length === 0) {
    return (
      <div className={`text-center py-8 text-sm text-slate-400 ${className}`}>
        {emptyLabel}
      </div>
    );
  }
  return (
    <ol className={`relative ${className}`}>
      {/* Vertical line */}
      <div aria-hidden className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
      {items.map((item) => {
        const kind = item.kind ?? "neutral";
        return (
          <li key={item.id} className="relative pl-8 pb-5 last:pb-0">
            <span
              className={`absolute left-1.5 top-1 w-3 h-3 rounded-full ring-4 ring-white ${DOT[kind]}`}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm text-slate-800">
                  {item.icon}
                  <span className="font-medium">{item.title}</span>
                </div>
                {item.body && <div className="text-sm text-slate-500 mt-1 leading-relaxed">{item.body}</div>}
                {item.by && <div className="text-xs text-slate-400 mt-1">by {item.by}</div>}
              </div>
              <time
                dateTime={typeof item.at === "string" ? item.at : item.at.toISOString()}
                className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap"
                title={typeof item.at === "string" ? item.at : item.at.toISOString()}
              >
                {timeAgo(item.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
