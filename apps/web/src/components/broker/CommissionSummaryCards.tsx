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
        label="Total Earned"
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
        className="bg-emerald-50 border-emerald-200"
      />

      {/* Pending Approval */}
      <MetricsCard
        label="Pending Approval"
        value={`AED ${(data.pending / 1000000).toFixed(1)}M`}
        subtext={`${data.pendingDeals} deals`}
        trend="stable"
        className="bg-amber-50 border-amber-200"
      />

      {/* Paid */}
      <MetricsCard
        label="Paid"
        value={`AED ${(data.paid / 1000000).toFixed(1)}M`}
        subtext={`${data.paidDeals} deals`}
        trend="up"
        className="bg-blue-50 border-blue-200"
      />
    </div>
  );
}
