import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { formatDirham } from "@/lib/money";

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
                <h4 className="text-sm font-semibold text-foreground">{formatMonth(item.month)}</h4>
                <span className="text-xs text-muted-foreground">
                  Gap: <span className={gap > 0 ? "text-destructive font-semibold" : "text-success"}> {formatDirham(gap / 1000000, { decimals: 1 })}M</span>
                </span>
              </div>

              {/* Bars */}
              <div className="flex items-center gap-2">
                {/* Expected Bar */}
                <div className="flex-1">
                  <div className="w-full bg-neutral-200 rounded h-6 overflow-hidden relative">
                    <div className="bg-neutral-400 h-full flex items-center pl-2" style={{ width: `${expectedPercent}%` }}>
                      {expectedPercent > 15 && <span className="text-xs font-semibold text-white">Expected</span>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDirham(item.expected / 1000000, { decimals: 1 })}M</p>
                </div>

                {/* Received Bar */}
                <div className="flex-1">
                  <div className="w-full bg-success-soft rounded h-6 overflow-hidden relative">
                    <div className="bg-success h-full flex items-center pl-2" style={{ width: `${receivedPercent}%` }}>
                      {receivedPercent > 15 && <span className="text-xs font-semibold text-white">Received</span>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDirham(item.received / 1000000, { decimals: 1 })}M</p>
                </div>
              </div>

              {/* Shortfall indicator */}
              {gap > 0 && (
                <div className="mt-1 text-xs text-destructive">
                  <span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> Shortfall: {gapPercent.toFixed(0)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="border-t border-border pt-4 grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded p-3">
          <p className="text-xs text-muted-foreground">Total Expected</p>
          <p className="text-lg font-bold text-foreground">
            {formatDirham(metrics.totalExpected / 1000000, { decimals: 1 })}M
          </p>
        </div>
        <div className="bg-success-soft rounded p-3">
          <p className="text-xs text-muted-foreground">Total Received</p>
          <p className="text-lg font-bold text-success">
            {formatDirham(metrics.totalReceived / 1000000, { decimals: 1 })}M
          </p>
        </div>
        <div className={`rounded p-3 ${metrics.totalGap > 0 ? "bg-destructive-soft" : "bg-success-soft"}`}>
          <p className="text-xs text-muted-foreground">Total Gap</p>
          <p className={`text-lg font-bold ${metrics.totalGap > 0 ? "text-destructive" : "text-success"}`}>
            {formatDirham(metrics.totalGap / 1000000, { decimals: 1 })}M
          </p>
        </div>
      </div>
    </div>
  );
}
