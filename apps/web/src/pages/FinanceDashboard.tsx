import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFinanceSummary,
  usePaymentBreakdown,
  useExpectedVsReceived,
  useOverduePayments,
  useBrokerPerformance,
  useUpcomingPayments,
} from "../hooks/useFinanceDashboard";
import MetricsCard from "../components/finance/MetricsCard";
import PaymentBreakdownChart from "../components/finance/PaymentBreakdownChart";
import ExpectedVsReceivedChart from "../components/finance/ExpectedVsReceivedChart";
import OverdueAlertsTable from "../components/finance/OverdueAlertsTable";
import BrokerPerformanceTable from "../components/finance/BrokerPerformanceTable";
import UpcomingPaymentsTimeline from "../components/finance/UpcomingPaymentsTimeline";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * Finance Dashboard - Main page for operations/finance team
 * Shows payment collection metrics, overdue alerts, and broker performance
 *
 * Layout:
 * - Header: Breadcrumb + title
 * - Metrics Row: 4 cards (Total Due, Collected, Overdue, At Risk)
 * - Charts Row: Pie chart + Bar chart
 * - Tables: Overdue alerts, Broker performance
 * - Timeline: Upcoming due dates
 */
export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [activeMetric, setActiveMetric] = useState<string | null>(null);

  // Load all dashboard data
  const summary = useFinanceSummary();
  const breakdown = usePaymentBreakdown();
  const expectedVsReceived = useExpectedVsReceived(6);
  const overdue = useOverduePayments(50);
  const brokerPerf = useBrokerPerformance(20);
  const upcoming = useUpcomingPayments(30);

  // Check if all data loaded
  const isLoading =
    summary.loading ||
    breakdown.loading ||
    expectedVsReceived.loading ||
    brokerPerf.loading ||
    upcoming.loading;

  const hasError = summary.error || breakdown.error || expectedVsReceived.error || brokerPerf.error;

  if (hasError && !isLoading) {
    return (
      <div className="flex flex-col h-full gap-4 p-6">
        <Breadcrumbs crumbs={[{ label: "Finance" }]} />
        <div className="bg-destructive-soft border border-destructive/30 rounded-lg p-6 text-center">
          <p className="text-destructive font-medium">Failed to load dashboard</p>
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
            { label: "Finance" },
          ]}
        />
        <h1 className="text-xl font-semibold tracking-tight text-foreground mt-3">Finance Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor payment collection and broker performance</p>
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

          {/* Metrics Row */}
          {summary.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricsCard
                label="Total due"
                value={`AED ${(summary.data.totalDue / 1000000).toFixed(1)}M`}
                subtext={`${summary.data.collectionRate}% collected`}
                trend="stable"
                onClick={() => setActiveMetric("due")}
                className="cursor-pointer hover:shadow-lg"
              />
              <MetricsCard
                label="Collected"
                value={`AED ${(summary.data.collected / 1000000).toFixed(1)}M`}
                subtext="Payments received"
                trend="up"
                className="bg-success-soft border-success/30"
              />
              <MetricsCard
                label="Overdue"
                value={`AED ${(summary.data.overdue / 1000000).toFixed(1)}M`}
                subtext={`${overdue.data.length} payments`}
                trend="down"
                className="bg-destructive-soft border-destructive/30"
              />
              <MetricsCard
                label="At risk"
                value={`AED ${(summary.data.atRisk / 1000000).toFixed(1)}M`}
                subtext="Due in 30 days"
                trend="down"
                className="bg-warning-soft border-warning/30"
              />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Breakdown Pie Chart */}
            {breakdown.data && (
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Payment status breakdown</h3>
                <PaymentBreakdownChart data={breakdown.data} />
              </div>
            )}

            {/* Expected vs Received Bar Chart */}
            {expectedVsReceived.data && (
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Expected vs Received (6 Months)</h3>
                <ExpectedVsReceivedChart data={expectedVsReceived.data} />
              </div>
            )}
          </div>

          {/* Overdue Alerts Table */}
          {overdue.data && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Overdue payments</h3>
                <span className="px-2 py-1 bg-destructive-soft text-destructive rounded text-xs font-medium">
                  {overdue.total} alerts
                </span>
              </div>
              <OverdueAlertsTable
                data={overdue.data}
                loading={overdue.loading}
                onNavigateDeal={(dealId) => navigate(`/deals/${dealId}`)}
                onPageChange={(page) => overdue.goToPage(page)}
                pageCount={overdue.pageCount}
                currentPage={Math.floor(overdue.offset / overdue.limit)}
              />
            </div>
          )}

          {/* Broker Performance Table */}
          {brokerPerf.data && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Broker collection performance</h3>
              <BrokerPerformanceTable data={brokerPerf.data} loading={brokerPerf.loading} />
            </div>
          )}

          {/* Upcoming Payments Timeline */}
          {upcoming.data && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming payment due dates (30 days)</h3>
              <UpcomingPaymentsTimeline data={upcoming.data} onNavigateDeal={(dealId) => navigate(`/deals/${dealId}`)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
