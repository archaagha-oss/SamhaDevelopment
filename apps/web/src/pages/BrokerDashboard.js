import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCommissionSummary, useCommissionUnlockStatus, usePendingApprovals, useApprovedCommissions, useBrokerPerformance, } from "../hooks/useBrokerDashboard";
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
    const [activeTab, setActiveTab] = useState("status");
    // Load all dashboard data
    const summary = useCommissionSummary();
    const unlockStatus = useCommissionUnlockStatus();
    const pendingApprovals = usePendingApprovals(20);
    const approvedComms = useApprovedCommissions(20);
    const brokerPerf = useBrokerPerformance();
    const isLoading = summary.loading || unlockStatus.loading || pendingApprovals.loading || approvedComms.loading;
    const hasError = summary.error || unlockStatus.error;
    if (hasError && !isLoading) {
        return (_jsxs("div", { className: "flex flex-col h-full gap-4 p-6", children: [_jsx(Breadcrumbs, { crumbs: [{ label: "Broker" }, { label: "Commission Dashboard" }] }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-6 text-center", children: [_jsx("p", { className: "text-red-600 font-medium", children: summary.error || unlockStatus.error }), _jsx("button", { onClick: () => window.location.reload(), className: "mt-3 text-sm text-red-500 underline", children: "Reload page" })] })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-slate-50", children: [_jsxs("div", { className: "flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4", children: [_jsx(Breadcrumbs, { crumbs: [
                            { label: "Dashboard", path: "/" },
                            { label: "Commission" },
                        ] }), _jsx("h1", { className: "text-2xl font-bold text-slate-900 mt-3", children: "Commission Dashboard" }), _jsx("p", { className: "text-sm text-slate-600 mt-1", children: "Track commission status, approvals, and unlock conditions" })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsxs("div", { className: "p-6 space-y-6", children: [isLoading && summary.data === null && (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx("div", { className: "w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" }) })), summary.data && (_jsx(CommissionSummaryCards, { data: summary.data })), unlockStatus.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Commission Unlock Status" }), _jsxs("span", { className: "px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium", children: [unlockStatus.data.filter((d) => d.unlockStatus === "PENDING").length, " waiting"] })] }), _jsx(CommissionUnlockStatusTable, { data: unlockStatus.data, onNavigateDeal: (dealId) => navigate(`/deals/${dealId}`) })] })), approvedComms.data && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Approved Commissions" }), _jsx(ApprovedCommissionsTable, { data: approvedComms.data, loading: approvedComms.loading, onPageChange: (page) => approvedComms.goToPage(page), pageCount: approvedComms.pageCount, currentPage: Math.floor(approvedComms.offset / approvedComms.limit) })] })), pendingApprovals.error === null && pendingApprovals.data.length > 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Pending Approvals" }), _jsxs("span", { className: "px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium", children: [pendingApprovals.total, " pending"] })] }), _jsx(PendingApprovalsQueue, { data: pendingApprovals.data, loading: pendingApprovals.loading, onApprovalChange: () => {
                                        pendingApprovals.goToPage(0);
                                        summary.refetch();
                                        approvedComms.goToPage(0);
                                    }, onPageChange: (page) => pendingApprovals.goToPage(page), pageCount: pendingApprovals.pageCount, currentPage: Math.floor(pendingApprovals.offset / pendingApprovals.limit) })] })), brokerPerf.data && brokerPerf.data.length > 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-slate-200 p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Broker Performance Summary" }), _jsx(BrokerPerformanceSummary, { data: brokerPerf.data, loading: brokerPerf.loading })] }))] }) })] }));
}
