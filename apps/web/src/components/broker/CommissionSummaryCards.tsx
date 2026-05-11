import React from "react";
import { CommissionSummary } from "../../hooks/useBrokerDashboard";
import MetricsCard from "../finance/MetricsCard";
import { formatDirhamCompact } from "@/lib/money";

interface CommissionSummaryCardsProps {
  data: CommissionSummary;
}

/**
 * CommissionSummaryCards - Display commission metrics in a 2x4 grid
 * Shows: Earned, Approved, Pending, Paid (amounts + deal counts)
 */
export default function CommissionSummaryCards({ data }: CommissionSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Earned */}
      <MetricsCard
        label="Total Earned"
        value={formatDirhamCompact(data.totalEarned)}
        subtext={`${data.totalDeals} deals`}
        trend="stable"
      />

      {/* Approved */}
      <MetricsCard
        label="Approved"
        value={formatDirhamCompact(data.approved)}
        subtext={`${data.approvedDeals} deals`}
        trend="up"
        className="bg-success-soft border-success/30"
      />

      {/* Pending Approval */}
      <MetricsCard
        label="Pending Approval"
        value={formatDirhamCompact(data.pending)}
        subtext={`${data.pendingDeals} deals`}
        trend="stable"
        className="bg-warning-soft border-warning/30"
      />

      {/* Paid */}
      <MetricsCard
        label="Paid"
        value={formatDirhamCompact(data.paid)}
        subtext={`${data.paidDeals} deals`}
        trend="up"
        className="bg-info-soft border-primary/40"
      />
    </div>
  );
}
