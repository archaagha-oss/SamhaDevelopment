import React, { useMemo } from "react";

interface PaymentBreakdownProps {
  data: Record<string, { count: number; amount: number }>;
}

/**
 * PaymentBreakdownChart - Payment status distribution visualization
 * Shows breakdown of payments by status (Paid, Pending, Overdue, Partial, etc.)
 *
 * Features:
 * - Visual percentage breakdown
 * - Color-coded status indicators
 * - Amount and count display
 * - Responsive design
 */
export default function PaymentBreakdownChart({ data }: PaymentBreakdownProps) {
  // Calculate totals and percentages
  const breakdown = useMemo(() => {
    const total = Object.values(data).reduce((sum, d) => sum + d.amount, 0);
    const totalCount = Object.values(data).reduce((sum, d) => sum + d.count, 0);

    return Object.entries(data).map(([status, values]) => ({
      status,
      amount: values.amount,
      count: values.count,
      percent: total > 0 ? ((values.amount / total) * 100).toFixed(1) : "0",
    }));
  }, [data]);

  // Status colors
  const statusColors: Record<string, { bar: string; bg: string; text: string }> = {
    PAID: { bar: "bg-success", bg: "bg-success-soft", text: "text-success" },
    PENDING: { bar: "bg-warning", bg: "bg-warning-soft", text: "text-warning" },
    OVERDUE: { bar: "bg-destructive", bg: "bg-destructive-soft", text: "text-destructive" },
    PARTIAL: { bar: "bg-warning", bg: "bg-warning-soft", text: "text-warning" },
    PDC_PENDING: { bar: "bg-warning", bg: "bg-warning-soft", text: "text-warning" },
    PDC_CLEARED: { bar: "bg-chart-5", bg: "bg-chart-5/10", text: "text-chart-5" },
    CANCELLED: { bar: "bg-neutral-300", bg: "bg-muted/50", text: "text-muted-foreground" },
  };

  return (
    <div className="space-y-6">
      {/* Legend + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {breakdown.map((item) => {
          const colors = statusColors[item.status] || { bar: "bg-neutral-400", bg: "bg-muted/50", text: "text-foreground" };
          return (
            <div key={item.status} className={`${colors.bg} rounded-lg p-3`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-sm font-semibold ${colors.text}`}>{item.status.replace(/_/g, " ")}</h4>
                <span className={`text-xs font-bold ${colors.text}`}>{item.percent}%</span>
              </div>
              <div className="w-full bg-card rounded h-2 overflow-hidden border border-border">
                <div className={`${colors.bar} h-full`} style={{ width: `${item.percent}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>AED {(item.amount / 1000000).toFixed(1)}M</span>
                <span>{item.count} payments</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="border-t border-border pt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Total Payments</p>
          <p className="text-lg font-bold text-foreground">
            {breakdown.reduce((sum, item) => sum + item.count, 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Amount</p>
          <p className="text-lg font-bold text-foreground">
            AED {(breakdown.reduce((sum, item) => sum + item.amount, 0) / 1000000).toFixed(1)}M
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Collection %</p>
          <p className="text-lg font-bold text-success">
            {breakdown.find((item) => item.status === "PAID")?.percent || "0"}%
          </p>
        </div>
      </div>
    </div>
  );
}
