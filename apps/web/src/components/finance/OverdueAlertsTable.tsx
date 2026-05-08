import React, { useState } from "react";
import { OverduePayment } from "../../hooks/useFinanceDashboard";

interface OverdueAlertsTableProps {
  data: OverduePayment[];
  loading?: boolean;
  onNavigateDeal: (dealId: string) => void;
  onPageChange?: (page: number) => void;
  pageCount?: number;
  currentPage?: number;
}

type SortField = "amount" | "daysOverdue" | "dueDate";
type SortOrder = "asc" | "desc";

/**
 * OverdueAlertsTable - Interactive table of overdue payments
 * Features:
 * - Sortable columns
 * - Color-coded urgency (red = critical, orange = warning)
 * - Pagination support
 * - Click-through to deal details
 * - Responsive table layout
 */
export default function OverdueAlertsTable({
  data,
  loading = false,
  onNavigateDeal,
  onPageChange,
  pageCount = 1,
  currentPage = 0,
}: OverdueAlertsTableProps) {
  const [sortField, setSortField] = useState<SortField>("daysOverdue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "dueDate") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Get urgency color
  const getUrgencyColor = (daysOverdue: number): string => {
    if (daysOverdue > 7) return "bg-red-100 text-red-900";
    if (daysOverdue > 3) return "bg-orange-100 text-orange-900";
    return "bg-amber-100 text-amber-900";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-300">↕</span>;
    return sortOrder === "asc" ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>;
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-600">✓ No overdue payments - All on track!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Deal</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Lead Name</th>
              <th
                className="text-right px-4 py-3 font-semibold text-slate-900 cursor-pointer hover:text-blue-600"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end gap-1">
                  Amount <SortIcon field="amount" />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900">Milestone</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-900 cursor-pointer hover:text-blue-600" onClick={() => handleSort("daysOverdue")}>
                <div className="flex items-center justify-center gap-1">
                  Days Overdue <SortIcon field="daysOverdue" />
                </div>
              </th>
              <th className="text-center px-4 py-3 font-semibold text-slate-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((payment) => (
              <tr key={payment.id} className="border-b border-slate-200 hover:bg-slate-50 transition">
                <td className="px-4 py-3">
                  <button
                    onClick={() => onNavigateDeal(payment.dealId)}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {payment.dealNumber}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-700">{payment.leadName}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  AED {payment.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-600">{payment.milestoneLabel}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-3 py-1 rounded font-semibold ${getUrgencyColor(payment.daysOverdue)}`}>
                    {payment.daysOverdue}d
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onNavigateDeal(payment.dealId)}
                    className="px-3 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition"
                  >
                    View Deal
                  </button>
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

      {/* Mobile Responsive Note */}
      <p className="text-xs text-slate-500 mt-4 md:hidden">
        💡 Swipe left/right to see more columns
      </p>
    </div>
  );
}
