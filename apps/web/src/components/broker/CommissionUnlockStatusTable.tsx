import React from "react";
import { formatDirham } from "@/lib/money";
import { CommissionUnlockStatus } from "../../hooks/useBrokerDashboard";

interface CommissionUnlockStatusTableProps {
  data: CommissionUnlockStatus[];
  onNavigateDeal: (dealId: string) => void;
}

/**
 * CommissionUnlockStatusTable - Shows which deals are waiting for SPA vs Oqood
 * Color-coded by unlock status
 */
export default function CommissionUnlockStatusTable({
  data,
  onNavigateDeal,
}: CommissionUnlockStatusTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "UNLOCKED":
        return "bg-success-soft border-l-emerald-500";
      case "PENDING":
        return "bg-warning-soft border-l-amber-500";
      case "LOCKED":
        return "bg-muted/50 border-l-slate-400";
      case "NOT_DUE":
        return "bg-info-soft border-l-blue-400";
      default:
        return "bg-card border-l-slate-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UNLOCKED":
        return "bg-success-soft text-success";
      case "PENDING":
        return "bg-warning-soft text-warning";
      case "LOCKED":
        return "bg-destructive-soft text-destructive";
      case "NOT_DUE":
        return "bg-info-soft text-primary";
      default:
        return "bg-muted text-foreground";
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No commission deals</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div
          key={item.id}
          className={`border-l-4 rounded-lg p-4 transition-all ${getStatusColor(item.unlockStatus)}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">{item.dealNumber}</h4>
              <p className="text-sm text-foreground mt-1">{item.leadName} - Unit {item.unitNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.unlockReason}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(item.unlockStatus)}`}>
                {item.unlockStatus.replace(/_/g, " ")}
              </span>
              <button
                onClick={() => onNavigateDeal(item.id)}
                className="px-3 py-1 text-xs bg-card border border-border rounded hover:bg-muted/50 transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Commission Info */}
          {item.commission && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20 flex items-center justify-between text-sm">
              <span className="text-muted-foreground inline-flex items-center gap-1">Commission: {formatDirham(item.commission.amount)}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                item.commission.status === "PENDING_APPROVAL" ? "bg-warning-soft text-warning" :
                item.commission.status === "APPROVED" ? "bg-success-soft text-success" :
                "bg-muted text-foreground"
              }`}>
                {item.commission.status.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
