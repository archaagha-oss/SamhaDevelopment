import React from "react";
import { BrokerPerformanceData } from "../../hooks/useBrokerDashboard";

interface BrokerPerformanceSummaryProps {
  data: BrokerPerformanceData[];
  loading?: boolean;
}

/**
 * BrokerPerformanceSummary - Ranking of brokers by commission metrics
 * Shows: Deals, Earned, Approved, Pending, Approval rate
 */
export default function BrokerPerformanceSummary({
  data,
  loading = false,
}: BrokerPerformanceSummaryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No broker data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 font-semibold text-foreground">Broker</th>
            <th className="text-center px-4 py-3 font-semibold text-foreground">Deals</th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">Total Earned</th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">Approved</th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">Pending</th>
            <th className="text-center px-4 py-3 font-semibold text-foreground">Approval %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((broker, index) => {
            const approvalRate = parseFloat(broker.approvalRate);
            const isTopPerformer = index === 0;

            return (
              <tr
                key={broker.agentId}
                className={`border-b border-border transition ${
                  isTopPerformer ? "bg-warning-soft" : index % 2 === 0 ? "bg-muted/50" : "bg-card"
                } hover:bg-info-soft`}
              >
                {/* Broker Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isTopPerformer && <span className="text-xl">👑</span>}
                    <div>
                      <p className="font-semibold text-foreground">#{index + 1} {broker.agentName}</p>
                    </div>
                  </div>
                </td>

                {/* Deal Count */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-3 py-1 bg-muted text-foreground rounded font-semibold text-xs">
                    {broker.dealCount}
                  </span>
                </td>

                {/* Total Earned */}
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  AED {(broker.totalEarned / 1000000).toFixed(1)}M
                </td>

                {/* Approved */}
                <td className="px-4 py-3 text-right font-semibold text-success">
                  AED {(broker.approved / 1000000).toFixed(1)}M
                </td>

                {/* Pending */}
                <td className="px-4 py-3 text-right font-semibold text-warning">
                  AED {(broker.pending / 1000000).toFixed(1)}M
                </td>

                {/* Approval Rate */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-20 bg-neutral-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          approvalRate > 80 ? "bg-success" : "bg-warning"
                        }`}
                        style={{ width: `${approvalRate}%` }}
                      />
                    </div>
                    <span className={`font-semibold text-xs whitespace-nowrap ${
                      approvalRate > 80 ? "text-success" : "text-warning"
                    }`}>
                      {broker.approvalRate}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary */}
      <div className="border-t border-border pt-4 mt-4 grid grid-cols-4 gap-3 text-center">
        <div className="bg-muted/50 rounded p-3">
          <p className="text-xs text-muted-foreground">Total Brokers</p>
          <p className="text-lg font-bold text-foreground">{data.length}</p>
        </div>
        <div className="bg-muted/50 rounded p-3">
          <p className="text-xs text-muted-foreground">Total Deals</p>
          <p className="text-lg font-bold text-foreground">{data.reduce((sum, b) => sum + b.dealCount, 0)}</p>
        </div>
        <div className="bg-muted/50 rounded p-3">
          <p className="text-xs text-muted-foreground">Total Earned</p>
          <p className="text-lg font-bold text-foreground">
            AED {(data.reduce((sum, b) => sum + b.totalEarned, 0) / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="bg-warning-soft rounded p-3">
          <p className="text-xs text-muted-foreground">Avg Approval %</p>
          <p className="text-lg font-bold text-warning">
            {(
              data.reduce((sum, b) => sum + parseFloat(b.approvalRate), 0) / data.length
            ).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}
