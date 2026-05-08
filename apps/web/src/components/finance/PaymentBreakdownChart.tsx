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
    PAID: { bar: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
    PENDING: { bar: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
    OVERDUE: { bar: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
    PARTIAL: { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
    PDC_PENDING: { bar: "bg-orange-600", bg: "bg-orange-50", text: "text-orange-700" },
    PDC_CLEARED: { bar: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
    CANCELLED: { bar: "bg-slate-300", bg: "bg-slate-50", text: "text-slate-600" },
  };

  return (
    <div className="space-y-6">
      {/* Legend + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {breakdown.map((item) => {
          const colors = statusColors[item.status] || { bar: "bg-slate-400", bg: "bg-slate-50", text: "text-slate-700" };
          return (
            <div key={item.status} className={`${colors.bg} rounded-lg p-3`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-sm font-semibold ${colors.text}`}>{item.status.replace(/_/g, " ")}</h4>
                <span className={`text-xs font-bold ${colors.text}`}>{item.percent}%</span>
              </div>
              <div className="w-full bg-white rounded h-2 overflow-hidden border border-slate-200">
                <div className={`${colors.bar} h-full`} style={{ width: `${item.percent}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-slate-600">
                <span>AED {(item.amount / 1000000).toFixed(1)}M</span>
                <span>{item.count} payments</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="border-t border-slate-200 pt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-600">Total Payments</p>
          <p className="text-lg font-bold text-slate-900">
            {breakdown.reduce((sum, item) => sum + item.count, 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600">Total Amount</p>
          <p className="text-lg font-bold text-slate-900">
            AED {(breakdown.reduce((sum, item) => sum + item.amount, 0) / 1000000).toFixed(1)}M
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600">Collection %</p>
          <p className="text-lg font-bold text-emerald-600">
            {breakdown.find((item) => item.status === "PAID")?.percent || "0"}%
          </p>
        </div>
      </div>
    </div>
  );
}
