import React from "react";
import { BrokerPerformance } from "../../hooks/useFinanceDashboard";

interface BrokerPerformanceTableProps {
  data: BrokerPerformance[];
  loading?: boolean;
}

/**
 * BrokerPerformanceTable - Broker agent collection metrics
 * Shows performance ranking by collection rate, deals, and payment days
 *
 * Features:
 * - Sortable ranking
 * - Color-coded performance bars
 * - Deal count and earnings
 * - Average payment days indicator
 */
export default function BrokerPerformanceTable({
  data,
  loading = false,
}: BrokerPerformanceTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        <p>No broker data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold text-slate-900">Broker</th>
            <th className="text-center px-4 py-3 font-semibold text-slate-900">Deals</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-900">Total Sale</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-900">Collected</th>
            <th className="text-center px-4 py-3 font-semibold text-slate-900">Collection %</th>
            <th className="text-center px-4 py-3 font-semibold text-slate-900">Avg Days</th>
          </tr>
        </thead>
        <tbody>
          {data.map((broker, index) => {
            const collectionRate = parseFloat(broker.collectionRate);
            const isAboveAverage = collectionRate > 85;

            return (
              <tr
                key={broker.brokerId}
                className={`border-b border-slate-200 transition ${
                  index % 2 === 0 ? "bg-slate-50" : "bg-white"
                } hover:bg-blue-50`}
              >
                {/* Broker Name */}
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">#{index + 1} {broker.brokerName}</p>
                    <p className="text-xs text-slate-500">{broker.brokerId}</p>
                  </div>
                </td>

                {/* Deal Count */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded font-semibold text-xs">
                    {broker.dealCount}
                  </span>
                </td>

                {/* Total Sale Price */}
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  AED {(broker.totalSalePrice / 1000000).toFixed(1)}M
                </td>

                {/* Collected Amount */}
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  AED {(broker.collectionAmount / 1000000).toFixed(1)}M
                </td>

                {/* Collection Rate with Visual Bar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-xs bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isAboveAverage ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${collectionRate}%` }}
                      />
                    </div>
                    <span className={`font-semibold text-xs whitespace-nowrap ${
                      isAboveAverage ? "text-emerald-700" : "text-amber-700"
                    }`}>
                      {broker.collectionRate}%
                    </span>
                  </div>
                </td>

                {/* Average Payment Days */}
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    broker.avgPaymentDays <= 20
                      ? "bg-emerald-100 text-emerald-700"
                      : broker.avgPaymentDays <= 30
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {broker.avgPaymentDays}d
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Stats */}
      <div className="border-t border-slate-200 pt-4 mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 rounded p-3">
          <p className="text-xs text-slate-600">Total Brokers</p>
          <p className="text-lg font-bold text-slate-900">{data.length}</p>
        </div>
        <div className="bg-slate-50 rounded p-3">
          <p className="text-xs text-slate-600">Avg Collection %</p>
          <p className="text-lg font-bold text-slate-900">
            {(
              data.reduce((sum, b) => sum + parseFloat(b.collectionRate), 0) / data.length
            ).toFixed(1)}%
          </p>
        </div>
        <div className="bg-slate-50 rounded p-3">
          <p className="text-xs text-slate-600">Top Performer</p>
          <p className="text-lg font-bold text-emerald-700">
            {data[0]?.brokerName.split(" ")[0]}
          </p>
        </div>
      </div>
    </div>
  );
}
