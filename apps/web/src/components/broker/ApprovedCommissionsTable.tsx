import React from "react";
import { ApprovedCommission } from "../../hooks/useBrokerDashboard";

interface ApprovedCommissionsTableProps {
  data: ApprovedCommission[];
  loading?: boolean;
  onPageChange?: (page: number) => void;
  pageCount?: number;
  currentPage?: number;
}

/**
 * ApprovedCommissionsTable - Shows approved commissions with payment status
 * Tracks: Amount, Approval date, Payment status, Paid date
 */
export default function ApprovedCommissionsTable({
  data,
  loading = false,
  onPageChange,
  pageCount = 1,
  currentPage = 0,
}: ApprovedCommissionsTableProps) {
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
        <p>No approved commissions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Deal</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Lead</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-900">Commission</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-900">Payment Status</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Approved Date</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((commission, index) => (
              <tr
                key={commission.id}
                className={`border-b border-slate-200 transition ${
                  index % 2 === 0 ? "bg-slate-50" : "bg-white"
                } hover:bg-blue-50`}
              >
                <td className="px-4 py-3 font-semibold text-slate-900">{commission.dealNumber}</td>
                <td className="px-4 py-3 text-slate-700">{commission.leadName}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  AED {commission.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-3 py-1 rounded text-xs font-semibold ${
                    commission.paidStatus === "PAID"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {commission.paidStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-sm">
                  {commission.approvedDate
                    ? new Date(commission.approvedDate).toLocaleDateString("en-AE")
                    : "-"}
                </td>
                <td className="px-4 py-3 text-slate-600 text-sm">
                  {commission.paidDate
                    ? new Date(commission.paidDate).toLocaleDateString("en-AE")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-200">
          <button
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-600">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            disabled={currentPage >= pageCount - 1}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
