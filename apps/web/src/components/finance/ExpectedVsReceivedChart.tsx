import React, { useMemo } from "react";

interface DataPoint {
  month: string;
  expected: number;
  received: number;
}

interface ExpectedVsReceivedChartProps {
  data: DataPoint[];
}

/**
 * ExpectedVsReceivedChart - Monthly payment comparison
 * Shows bar chart comparing expected payments vs actual received
 *
 * Features:
 * - Side-by-side bar comparison
 * - Gap visualization (shortfall highlighting)
 * - Monthly breakdown
 * - Responsive design
 */
export default function ExpectedVsReceivedChart({ data }: ExpectedVsReceivedChartProps) {
  // Calculate chart metrics
  const metrics = useMemo(() => {
    const maxAmount = Math.max(...data.flatMap((d) => [d.expected, d.received]));
    const totalExpected = data.reduce((sum, d) => sum + d.expected, 0);
    const totalReceived = data.reduce((sum, d) => sum + d.received, 0);
    const totalGap = totalExpected - totalReceived;

    return { maxAmount, totalExpected, totalReceived, totalGap };
  }, [data]);

  // Format month label
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="space-y-4">
        {data.map((item) => {
          const expectedPercent = (item.expected / metrics.maxAmount) * 100;
          const receivedPercent = (item.received / metrics.maxAmount) * 100;
          const gap = item.expected - item.received;
          const gapPercent = (gap / item.expected) * 100 || 0;

          return (
            <div key={item.month}>
              {/* Month Label */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-900">{formatMonth(item.month)}</h4>
                <span className="text-xs text-slate-600">
                  Gap: <span className={gap > 0 ? "text-red-600 font-semibold" : "text-emerald-600"}> AED {(gap / 1000000).toFixed(1)}M</span>
                </span>
              </div>

              {/* Bars */}
              <div className="flex items-center gap-2">
                {/* Expected Bar */}
                <div className="flex-1">
                  <div className="w-full bg-slate-200 rounded h-6 overflow-hidden relative">
                    <div className="bg-slate-400 h-full flex items-center pl-2" style={{ width: `${expectedPercent}%` }}>
                      {expectedPercent > 15 && <span className="text-xs font-semibold text-white">Expected</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">AED {(item.expected / 1000000).toFixed(1)}M</p>
                </div>

                {/* Received Bar */}
                <div className="flex-1">
                  <div className="w-full bg-emerald-100 rounded h-6 overflow-hidden relative">
                    <div className="bg-emerald-500 h-full flex items-center pl-2" style={{ width: `${receivedPercent}%` }}>
                      {receivedPercent > 15 && <span className="text-xs font-semibold text-white">Received</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">AED {(item.received / 1000000).toFixed(1)}M</p>
                </div>
              </div>

              {/* Shortfall indicator */}
              {gap > 0 && (
                <div className="mt-1 text-xs text-red-600">
                  ⚠️ Shortfall: {gapPercent.toFixed(0)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="border-t border-slate-200 pt-4 grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded p-3">
          <p className="text-xs text-slate-600">Total Expected</p>
          <p className="text-lg font-bold text-slate-900">
            AED {(metrics.totalExpected / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="bg-emerald-50 rounded p-3">
          <p className="text-xs text-slate-600">Total Received</p>
          <p className="text-lg font-bold text-emerald-700">
            AED {(metrics.totalReceived / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className={`rounded p-3 ${metrics.totalGap > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
          <p className="text-xs text-slate-600">Total Gap</p>
          <p className={`text-lg font-bold ${metrics.totalGap > 0 ? "text-red-700" : "text-emerald-700"}`}>
            AED {(metrics.totalGap / 1000000).toFixed(1)}M
          </p>
        </div>
      </div>
    </div>
  );
}
