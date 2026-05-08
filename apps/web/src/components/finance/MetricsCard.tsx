import React from "react";

interface MetricsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "stable";
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * MetricsCard - Reusable KPI card component
 * Used for displaying key financial metrics
 *
 * Features:
 * - Flexible sizing (responsive grid)
 * - Trend indicators (up/down/stable)
 * - Optional click handler for drill-down
 * - Customizable styling
 */
export default function MetricsCard({
  label,
  value,
  subtext,
  trend = "stable",
  icon,
  onClick,
  className = "",
}: MetricsCardProps) {
  const trendClass = {
    up: "text-emerald-600 bg-emerald-50",
    down: "text-red-600 bg-red-50",
    stable: "text-slate-600 bg-slate-50",
  };

  const trendIcon = {
    up: "↑",
    down: "↓",
    stable: "→",
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white border border-slate-200 rounded-lg p-6 transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</h3>
        {icon && <div className="text-xl text-slate-400">{icon}</div>}
      </div>

      {/* Main Value */}
      <p className="text-2xl font-bold text-slate-900 mb-2">{value}</p>

      {/* Subtext + Trend */}
      <div className="flex items-center justify-between">
        {subtext && <p className="text-xs text-slate-600">{subtext}</p>}
        {trend && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${trendClass[trend]}`}>
            <span>{trendIcon[trend]}</span>
          </span>
        )}
      </div>
    </div>
  );
}
