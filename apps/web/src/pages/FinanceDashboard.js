import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFinanceSummary, usePaymentBreakdown, useExpectedVsReceived, useOverduePayments, useBrokerPerformance, useUpcomingPayments, } from "../hooks/useFinanceDashboard";
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
    const [activeMetric, setActiveMetric] = useState(null);
    // Load all dashboard data
    const summary = useFinanceSummary();
    const breakdown = usePaymentBreakdown();
    const expectedVsReceived = useExpectedVsReceived(6);
    const overdue = useOverduePayments(50);
    const brokerPerf = useBrokerPerformance(20);
    const upcoming = useUpcomingPayments(30);
    // Check if all data loaded
    const isLoading = summary.loading ||
        breakdown.loading ||
        expectedVsReceived.loading ||
        brokerPerf.loading ||
        upcoming.loading;
    const hasError = summary.error || breakdown.error || expectedVsReceived.error || brokerPerf.error;
    if (hasError && !isLoading) {
        return (_jsxs("div", { className: "flex flex-col h-full gap-4 p-6", children: [_jsx(Breadcrumbs, { crumbs: [{ label: "Finance" }] }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-6 text-center", children: [_jsx("p", { className: "text-red-600 font-medium", children: "Failed to load dashboard" }), _jsx("button", { onClick: () => window.location.reload(), className: "mt-3 text-sm text-red-500 underline", children: "Reload page" })] })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-slate-50", children: [_jsxs("div", { className: "flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4", children: [_jsx(Breadcrumbs, { crumbs: [
                            { label: "Dashboard", path: "/" },
                            { label: "Finance" },
                        ] }), _jsx("h1", { className: "text-2xl font-bold text-slate-900 mt-3", children: "Finance Dashboard" }), _jsx("p", { className: "text-sm text-slate-600 mt-1", children: "Monitor payment collection and broker performance" })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsxs("div", { className: "p-6 space-y-6", children: [isLoading && summary.data === null && (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx("div", { className: "w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" }) })), summary.data && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(MetricsCard, { label: "Total Due", value: `AED ${(summary.data.totalDue / 1000000).toFixed(1)}M`, subtext: `${summary.data.collectionRate}% collected`, trend: "stable", onClick: () => setActiveMetric("due"), className: "cursor-pointer hover:shadow-lg" }), _jsx(MetricsCard, { label: "Collected", value: `AED ${(summary.data.collected / 1000000).toFixed(1)}M`, subtext: "Payments received", trend: "up", className: "bg-emerald-50 border-emerald-200" }), _jsx(MetricsCard, { label: "Overdue", value: `AED ${(summary.data.overdue / 1000000).toFixed(1)}M`, subtext: `${overdue.data.length} payments`, trend: "down", className: "bg-red-50 border-red-200" }), _jsx(MetricsCard, { label: "At Risk", value: `AED ${(summary.data.atRisk / 1000000).toFixed(1)}M`, subtext: "Due in 30 days", trend: "down", className: "bg-amber-50 border-amber-200" })] })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [breakdown.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Payment Status Breakdown" }), _jsx(PaymentBreakdownChart, { data: breakdown.data })] })), expectedVsReceived.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Expected vs Received (6 Months)" }), _jsx(ExpectedVsReceivedChart, { data: expectedVsReceived.data })] }))] }), overdue.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Overdue Payments" }), _jsxs("span", { className: "px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium", children: [overdue.total, " alerts"] })] }), _jsx(OverdueAlertsTable, { data: overdue.data, loading: overdue.loading, onNavigateDeal: (dealId) => navigate(`/deals/${dealId}`), onPageChange: (page) => overdue.goToPage(page), pageCount: overdue.pageCount, currentPage: Math.floor(overdue.offset / overdue.limit) })] })), brokerPerf.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Broker Collection Performance" }), _jsx(BrokerPerformanceTable, { data: brokerPerf.data, loading: brokerPerf.loading })] })), upcoming.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Upcoming Payment Due Dates (30 Days)" }), _jsx(UpcomingPaymentsTimeline, { data: upcoming.data, onNavigateDeal: (dealId) => navigate(`/deals/${dealId}`) })] }))] }) })] }));
}
