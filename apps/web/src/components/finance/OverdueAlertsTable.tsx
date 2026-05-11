import React, { useState } from "react";
import { Check, Lightbulb } from "lucide-react";
import { formatDirham } from "@/lib/money";
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
    if (daysOverdue > 7) return "bg-destructive-soft text-destructive-soft-foreground";
    if (daysOverdue > 3) return "bg-warning-soft text-warning-soft-foreground";
    return "bg-warning-soft text-warning-soft-foreground";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-foreground/80">↕</span>;
    return sortOrder === "asc" ? <span className="text-primary">↑</span> : <span className="text-primary">↓</span>;
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><Check className="size-4 text-success" /> No overdue payments - All on track!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-semibold text-foreground">Deal</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Lead Name</th>
              <th
                className="text-right px-4 py-3 font-semibold text-foreground cursor-pointer hover:text-primary"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end gap-1">
                  Amount <SortIcon field="amount" />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Milestone</th>
              <th className="text-center px-4 py-3 font-semibold text-foreground cursor-pointer hover:text-primary" onClick={() => handleSort("daysOverdue")}>
                <div className="flex items-center justify-center gap-1">
                  Days Overdue <SortIcon field="daysOverdue" />
                </div>
              </th>
              <th className="text-center px-4 py-3 font-semibold text-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((payment) => (
              <tr key={payment.id} className="border-b border-border hover:bg-muted/50 transition">
                <td className="px-4 py-3">
                  <button
                    onClick={() => onNavigateDeal(payment.dealId)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {payment.dealNumber}
                  </button>
                </td>
                <td className="px-4 py-3 text-foreground">{payment.leadName}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatDirham(payment.amount)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{payment.milestoneLabel}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-3 py-1 rounded font-semibold ${getUrgencyColor(payment.daysOverdue)}`}>
                    {payment.daysOverdue}d
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onNavigateDeal(payment.dealId)}
                    className="px-3 py-1 text-xs bg-info-soft text-primary hover:bg-info-soft rounded transition"
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

      {/* Mobile Responsive Note */}
      <p className="text-xs text-muted-foreground mt-4 md:hidden">
        <span className="inline-flex items-center gap-1.5"><Lightbulb className="size-3.5" /> Swipe left/right to see more columns</span>
      </p>
    </div>
  );
}
