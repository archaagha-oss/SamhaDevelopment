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
    up: "text-success bg-success-soft",
    down: "text-destructive bg-destructive-soft",
    stable: "text-muted-foreground bg-muted/50",
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
        bg-card border border-border rounded-lg p-6 transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-border" : ""}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</h3>
        {icon && <div className="text-xl text-muted-foreground">{icon}</div>}
      </div>

      {/* Main Value */}
      <p className="text-2xl font-bold text-foreground mb-2">{value}</p>

      {/* Subtext + Trend */}
      <div className="flex items-center justify-between">
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
        {trend && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${trendClass[trend]}`}>
            <span>{trendIcon[trend]}</span>
          </span>
        )}
      </div>
    </div>
  );
}
