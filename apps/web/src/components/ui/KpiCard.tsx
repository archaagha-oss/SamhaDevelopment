import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  label: string;
  value: ReactNode;
  /** Sub-label rendered below the value (e.g. "12 deals"). */
  sub?: ReactNode;
  /** Optional trend (% change). Positive = up, negative = down. */
  trend?: number;
  /** Optional icon shown in the top-right corner. */
  icon?: ReactNode;
  /** Highlight variant — defaults to "neutral" (white card). */
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const TONE: Record<NonNullable<Props["tone"]>, { card: string; value: string }> = {
  neutral: { card: "bg-white border-slate-200",       value: "text-slate-900" },
  success: { card: "bg-emerald-50 border-emerald-200", value: "text-emerald-700" },
  warning: { card: "bg-amber-50 border-amber-200",     value: "text-amber-700" },
  danger:  { card: "bg-red-50 border-red-200",         value: "text-red-700" },
  info:    { card: "bg-blue-50 border-blue-200",       value: "text-blue-700" },
};

export function KpiCard({ label, value, sub, trend, icon, tone = "neutral", className = "" }: Props) {
  const t = TONE[tone];
  return (
    <div className={`rounded-card border p-4 shadow-card ${t.card} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {icon && <div className="text-slate-400 flex-shrink-0">{icon}</div>}
      </div>
      <p className={`text-2xl font-bold mt-1.5 ${t.value} tabular-nums`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend != null && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
              trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-slate-500"
            }`}
          >
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> :
             trend < 0 ? <TrendingDown className="h-3 w-3" /> :
                         <Minus className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}
