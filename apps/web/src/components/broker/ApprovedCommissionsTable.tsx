import React from "react";
import { formatDirham } from "@/lib/money";
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
        <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No approved commissions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-semibold text-foreground">Deal</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Lead</th>
              <th className="text-right px-4 py-3 font-semibold text-foreground">Commission</th>
              <th className="text-center px-4 py-3 font-semibold text-foreground">Payment Status</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Approved Date</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((commission, index) => (
              <tr
                key={commission.id}
                className={`border-b border-border transition ${
                  index % 2 === 0 ? "bg-muted/50" : "bg-card"
                } hover:bg-info-soft`}
              >
                <td className="px-4 py-3 font-semibold text-foreground">{commission.dealNumber}</td>
                <td className="px-4 py-3 text-foreground">{commission.leadName}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatDirham(commission.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-3 py-1 rounded text-xs font-semibold ${
                    commission.paidStatus === "PAID"
                      ? "bg-success-soft text-success"
                      : "bg-warning-soft text-warning"
                  }`}>
                    {commission.paidStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-sm">
                  {commission.approvedDate
                    ? new Date(commission.approvedDate).toLocaleDateString("en-AE")
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-sm">
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
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-border">
          <button
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
          >
            ← Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            disabled={currentPage >= pageCount - 1}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
