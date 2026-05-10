import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCommissionSummary,
  useCommissionUnlockStatus,
  usePendingApprovals,
  useApprovedCommissions,
  useBrokerPerformance,
} from "../hooks/useBrokerDashboard";
import CommissionSummaryCards from "../components/broker/CommissionSummaryCards";
import CommissionUnlockStatusTable from "../components/broker/CommissionUnlockStatusTable";
import PendingApprovalsQueue from "../components/broker/PendingApprovalsQueue";
import ApprovedCommissionsTable from "../components/broker/ApprovedCommissionsTable";
import BrokerPerformanceSummary from "../components/broker/BrokerPerformanceSummary";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * Broker Commission Dashboard
 * Displays commission status, unlock conditions, approvals, and performance metrics
 *
 * Access Control:
 * - BROKER_AGENT: Own commissions only
 * - BROKER_MANAGER: Company commissions
 * - FINANCE/ADMIN: All commissions with approval rights
 */
export default function BrokerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"status" | "approvals" | "performance">("status");

  // Load all dashboard data
  const summary = useCommissionSummary();
  const unlockStatus = useCommissionUnlockStatus();
  const pendingApprovals = usePendingApprovals(20);
  const approvedComms = useApprovedCommissions(20);
  const brokerPerf = useBrokerPerformance();

  const isLoading =
    summary.loading || unlockStatus.loading || pendingApprovals.loading || approvedComms.loading;

  const hasError = summary.error || unlockStatus.error;

  if (hasError && !isLoading) {
    return (
      <div className="flex flex-col h-full gap-4 p-6">
        <Breadcrumbs crumbs={[{ label: "Broker" }, { label: "Commission dashboard" }]} />
        <div className="bg-destructive-soft border border-destructive/30 rounded-lg p-6 text-center">
          <p className="text-destructive font-medium">{summary.error || unlockStatus.error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-destructive underline">
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-6 py-4">
        <Breadcrumbs
          crumbs={[
            { label: "Dashboard", path: "/" },
            { label: "Commission" },
          ]}
        />
        <h1 className="text-xl font-semibold tracking-tight text-foreground mt-3">Commission Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Track commission status, approvals, and unlock conditions</p>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* Loading State */}
          {isLoading && summary.data === null && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/40 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Summary Cards */}
          {summary.data && (
            <CommissionSummaryCards data={summary.data} />
          )}

          {/* Commission Unlock Status Section */}
          {unlockStatus.data && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Commission unlock status</h3>
                <span className="px-3 py-1 bg-warning-soft text-warning rounded-full text-xs font-medium">
                  {unlockStatus.data.filter((d) => d.unlockStatus === "PENDING").length} waiting
                </span>
              </div>
              <CommissionUnlockStatusTable
                data={unlockStatus.data}
                onNavigateDeal={(dealId) => navigate(`/deals/${dealId}`)}
              />
            </div>
          )}

          {/* Approved Commissions Section */}
          {approvedComms.data && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Approved commissions</h3>
              <ApprovedCommissionsTable
                data={approvedComms.data}
                loading={approvedComms.loading}
                onPageChange={(page) => approvedComms.goToPage(page)}
                pageCount={approvedComms.pageCount}
                currentPage={Math.floor(approvedComms.offset / approvedComms.limit)}
              />
            </div>
          )}

          {/* Pending Approvals Section (FINANCE/ADMIN only) */}
          {pendingApprovals.error === null && pendingApprovals.data.length > 0 && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Pending approvals</h3>
                <span className="px-3 py-1 bg-warning-soft text-warning rounded-full text-xs font-medium">
                  {pendingApprovals.total} pending
                </span>
              </div>
              <PendingApprovalsQueue
                data={pendingApprovals.data}
                loading={pendingApprovals.loading}
                onApprovalChange={() => {
                  pendingApprovals.goToPage(0);
                  summary.refetch();
                  approvedComms.goToPage(0);
                }}
                onPageChange={(page) => pendingApprovals.goToPage(page)}
                pageCount={pendingApprovals.pageCount}
                currentPage={Math.floor(pendingApprovals.offset / pendingApprovals.limit)}
              />
            </div>
          )}

          {/* Broker Performance Section (FINANCE/ADMIN only) */}
          {brokerPerf.data && brokerPerf.data.length > 0 && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Broker performance summary</h3>
              <BrokerPerformanceSummary data={brokerPerf.data} loading={brokerPerf.loading} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
