import { ReactNode } from "react";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

interface Props {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}

/**
 * Standard sub-navigation used inside detail pages and dashboards.
 * `underline` = inline tabs (Lead/Unit/Deal detail pages).
 * `pill`      = segmented control (Reports filter, CommissionDashboard).
 */
export function Tabs({ tabs, value, onChange, variant = "underline", className = "" }: Props) {
  if (variant === "pill") {
    return (
      <div role="tablist" className={`inline-flex gap-1 bg-slate-100 p-1 rounded-ctrl ${className}`}>
        {tabs.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              disabled={t.disabled}
              onClick={() => onChange(t.key)}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-ctrl transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count != null && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 ${active ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-600"}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className={`flex items-center gap-1 border-b border-slate-200 ${className}`}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => onChange(t.key)}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-sm font-medium border-b-2 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded-t",
              active
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count != null && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 ${active ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
