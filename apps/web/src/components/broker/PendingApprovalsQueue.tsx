import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { PendingApproval } from "../../hooks/useBrokerDashboard";
import { useApproveCommission, useRejectCommission } from "../../hooks/useBrokerDashboard";
import { toast } from "sonner";

interface PendingApprovalsQueueProps {
  data: PendingApproval[];
  loading?: boolean;
  onApprovalChange?: () => void;
  onPageChange?: (page: number) => void;
  pageCount?: number;
  currentPage?: number;
}

/**
 * PendingApprovalsQueue - Queue of commissions waiting for approval
 * Shows: Deal, Broker, Amount, and approve/reject actions
 */
export default function PendingApprovalsQueue({
  data,
  loading = false,
  onApprovalChange,
  onPageChange,
  pageCount = 1,
  currentPage = 0,
}: PendingApprovalsQueueProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { approve } = useApproveCommission();
  const { reject } = useRejectCommission();

  const handleApprove = async (commissionId: string) => {
    setApprovingId(commissionId);
    const success = await approve(commissionId);
    if (success) {
      onApprovalChange?.();
    }
    setApprovingId(null);
  };

  const handleReject = async (commissionId: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setRejectingId(commissionId);
    const success = await reject(commissionId, rejectReason);
    if (success) {
      setRejectReason("");
      onApprovalChange?.();
    }
    setRejectingId(null);
  };

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
        <p className="inline-flex items-center gap-1.5"><Check className="size-4 text-success" /> No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Approval Queue */}
      <div className="space-y-3">
        {data.map((item) => (
          <div
            key={item.id}
            className="border border-warning/30 bg-warning-soft rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{item.dealNumber}</h4>
                <p className="text-sm text-foreground">{item.brokerName} - {item.leadName}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
              </div>
              <span className="font-bold text-foreground whitespace-nowrap ml-3">
                AED {item.amount.toLocaleString()}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                disabled={approvingId !== null}
                onClick={() => handleApprove(item.id)}
                className="px-4 py-2 text-sm font-medium bg-success text-white rounded hover:bg-success/90 transition disabled:opacity-50"
              >
                {approvingId === item.id ? "Approving..." : <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Approve</span>}
              </button>
              <button
                disabled={rejectingId !== null}
                onClick={() => setRejectingId(item.id === rejectingId ? null : item.id)}
                className="px-4 py-2 text-sm font-medium border border-destructive/30 text-destructive rounded hover:bg-destructive-soft transition disabled:opacity-50"
              >
                {rejectingId === item.id ? "Cancel" : <span className="inline-flex items-center gap-1.5"><X className="size-3.5" /> Reject</span>}
              </button>
            </div>

            {/* Reject Reason Input */}
            {rejectingId === item.id && (
              <div className="mt-3 p-3 bg-card rounded border border-border space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(item.id)}
                    className="flex-1 px-3 py-1 text-sm bg-destructive text-white rounded hover:bg-destructive/90 transition"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                    className="flex-1 px-3 py-1 text-sm border border-border text-foreground rounded hover:bg-muted/50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
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
