import React from "react";
import { CommissionSummary } from "../../hooks/useBrokerDashboard";
import MetricsCard from "../finance/MetricsCard";

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
        label="Total earned"
        value={`AED ${(data.totalEarned / 1000000).toFixed(1)}M`}
        subtext={`${data.totalDeals} deals`}
        trend="stable"
      />

      {/* Approved */}
      <MetricsCard
        label="Approved"
        value={`AED ${(data.approved / 1000000).toFixed(1)}M`}
        subtext={`${data.approvedDeals} deals`}
        trend="up"
        className="bg-success-soft border-success/30"
      />

      {/* Pending Approval */}
      <MetricsCard
        label="Pending approval"
        value={`AED ${(data.pending / 1000000).toFixed(1)}M`}
        subtext={`${data.pendingDeals} deals`}
        trend="stable"
        className="bg-warning-soft border-warning/30"
      />

      {/* Paid */}
      <MetricsCard
        label="Paid"
        value={`AED ${(data.paid / 1000000).toFixed(1)}M`}
        subtext={`${data.paidDeals} deals`}
        trend="up"
        className="bg-info-soft border-primary/40"
      />
    </div>
  );
}
