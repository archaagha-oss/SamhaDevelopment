import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
const TABS = [
    { label: "Overview", id: "overview", icon: "📊" },
    { label: "Overdue", id: "overdue", icon: "⚠️" },
    { label: "Upcoming", id: "upcoming", icon: "📅" },
    { label: "Collections Pipeline", id: "pipeline", icon: "🎯" },
];
export default function FinanceDashboard() {
    const [deals, setDeals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [dateRange, setDateRange] = useState("month");
    // Fetch all deals with full payment data
    useEffect(() => {
        const fetchDeals = async () => {
            try {
                setIsLoading(true);
                const response = await axios.get("/api/deals?limit=1000");
                setDeals(response.data.data || []);
            }
            catch (err) {
                toast.error("Failed to fetch deals");
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchDeals();
    }, []);
    // Calculate metrics
    const metrics = useMemo(() => {
        let totalReceivable = 0;
        let totalPaid = 0;
        let totalOverdue = 0;
        let overdueCount = 0;
        let upcomingCount = 0;
        const now = new Date();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        deals.forEach((deal) => {
            deal.payments?.forEach((p) => {
                totalReceivable += p.amount;
                if (p.status === "PAID")
                    totalPaid += p.amount;
                const dueDate = new Date(p.dueDate);
                if (p.status !== "PAID" && p.status !== "CANCELLED") {
                    if (dueDate < now) {
                        totalOverdue += p.amount;
                        overdueCount++;
                    }
                    else if (dueDate <= monthEnd && p.status !== "PDC_CLEARED") {
                        upcomingCount++;
                    }
                }
            });
        });
        return {
            totalReceivable,
            totalPaid,
            totalOverdue,
            paidPercentage: totalReceivable > 0 ? Math.round((totalPaid / totalReceivable) * 100) : 0,
            overdueCount,
            upcomingCount,
            atRisk: deals.filter((d) => {
                const deadline = new Date(d.oqoodDeadline);
                const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return daysLeft < 7 && !["COMPLETED", "CANCELLED"].includes(d.stage);
            }).length,
        };
    }, [deals]);
    // Get overdue payments
    const overduePayments = useMemo(() => {
        const now = new Date();
        const payments = [];
        deals.forEach((deal) => {
            deal.payments?.forEach((p) => {
                const dueDate = new Date(p.dueDate);
                if (dueDate < now && p.status !== "PAID" && p.status !== "CANCELLED" && p.status !== "WAIVED") {
                    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    payments.push({
                        ...p,
                        dealNumber: deal.dealNumber,
                        buyerName: `${deal.lead.firstName} ${deal.lead.lastName}`,
                        unitNumber: deal.unit.unitNumber,
                        dealStage: deal.stage,
                        daysOverdue,
                    });
                }
            });
        });
        return payments.sort((a, b) => b.daysOverdue - a.daysOverdue);
    }, [deals]);
    // Get upcoming payments
    const upcomingPayments = useMemo(() => {
        const now = new Date();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const payments = [];
        deals.forEach((deal) => {
            deal.payments?.forEach((p) => {
                const dueDate = new Date(p.dueDate);
                if (dueDate >= now &&
                    dueDate <= monthEnd &&
                    p.status !== "PAID" &&
                    p.status !== "CANCELLED" &&
                    p.status !== "WAIVED" &&
                    p.status !== "PDC_CLEARED") {
                    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    payments.push({
                        ...p,
                        dealNumber: deal.dealNumber,
                        buyerName: `${deal.lead.firstName} ${deal.lead.lastName}`,
                        unitNumber: deal.unit.unitNumber,
                        dealStage: deal.stage,
                        daysUntilDue,
                    });
                }
            });
        });
        return payments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    }, [deals]);
    // Collections pipeline
    const pipeline = useMemo(() => {
        const stages = [
            "RESERVATION_PENDING",
            "RESERVATION_CONFIRMED",
            "SPA_PENDING",
            "SPA_SIGNED",
            "OQOOD_REGISTERED",
            "INSTALLMENTS_ACTIVE",
            "COMPLETED",
        ];
        return stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            const totalValue = stageDeals.reduce((sum, d) => sum + d.salePrice, 0);
            const totalPaid = stageDeals.reduce((sum, d) => {
                const paid = d.payments?.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0) || 0;
                return sum + paid;
            }, 0);
            return {
                stage,
                dealCount: stageDeals.length,
                totalValue,
                totalPaid,
                outstanding: totalValue - totalPaid,
                collectionRate: totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0,
            };
        });
    }, [deals]);
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-96", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 bg-white border-b border-slate-200", children: [_jsx("h1", { className: "text-lg font-bold text-slate-900 mb-1", children: "Finance Dashboard" }), _jsx("p", { className: "text-xs text-slate-400", children: "Receivables tracking, overdue alerts, collections pipeline" })] }), _jsx("div", { className: "flex gap-1 px-6 py-3 border-b border-slate-200 bg-white overflow-x-auto", children: TABS.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: [_jsx("span", { className: "mr-1", children: tab.icon }), tab.label] }, tab.id))) }), _jsxs("div", { className: "flex-1 overflow-auto scrollbar-thin", children: [activeTab === "overview" && (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4", children: [_jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4", children: [_jsx("p", { className: "text-xs text-slate-500 uppercase tracking-wide mb-2", children: "Total Receivable" }), _jsxs("p", { className: "text-2xl font-bold text-slate-900", children: ["AED ", (metrics.totalReceivable / 1000000).toFixed(1), "M"] }), _jsxs("p", { className: "text-xs text-slate-400 mt-1", children: [deals.length, " deals"] })] }), _jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4", children: [_jsx("p", { className: "text-xs text-slate-500 uppercase tracking-wide mb-2", children: "Collected" }), _jsxs("p", { className: "text-2xl font-bold text-emerald-600", children: ["AED ", (metrics.totalPaid / 1000000).toFixed(1), "M"] }), _jsxs("p", { className: "text-xs text-slate-400 mt-1", children: [metrics.paidPercentage, "% collected"] })] }), _jsxs("div", { className: "bg-white border border-red-200 rounded-lg p-4 bg-red-50", children: [_jsx("p", { className: "text-xs text-red-600 uppercase tracking-wide font-semibold mb-2", children: "\uD83D\uDEA8 Overdue" }), _jsxs("p", { className: "text-2xl font-bold text-red-700", children: ["AED ", (metrics.totalOverdue / 1000000).toFixed(1), "M"] }), _jsxs("p", { className: "text-xs text-red-600 mt-1", children: [metrics.overdueCount, " payments"] })] }), _jsxs("div", { className: "bg-white border border-amber-200 rounded-lg p-4 bg-amber-50", children: [_jsx("p", { className: "text-xs text-amber-600 uppercase tracking-wide font-semibold mb-2", children: "\uD83D\uDCC5 This Month" }), _jsx("p", { className: "text-2xl font-bold text-amber-700", children: metrics.upcomingCount }), _jsx("p", { className: "text-xs text-amber-600 mt-1", children: "payments due" })] }), _jsxs("div", { className: "bg-white border border-orange-200 rounded-lg p-4 bg-orange-50", children: [_jsx("p", { className: "text-xs text-orange-600 uppercase tracking-wide font-semibold mb-2", children: "\u23F0 At Risk" }), _jsx("p", { className: "text-2xl font-bold text-orange-700", children: metrics.atRisk }), _jsxs("p", { className: "text-xs text-orange-600 mt-1", children: ["Oqood deadline ", '<', " 7 days"] })] })] }), _jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4", children: [_jsx("h3", { className: "font-semibold text-slate-800 mb-4", children: "Collection Rate by Stage" }), _jsx("div", { className: "space-y-3", children: pipeline.map((item) => (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-sm font-medium text-slate-700", children: item.stage.replace(/_/g, " ") }), _jsxs("div", { className: "text-right", children: [_jsxs("span", { className: "text-sm font-semibold text-slate-800", children: [item.collectionRate, "%"] }), _jsxs("span", { className: "text-xs text-slate-400 ml-2", children: ["(", item.dealCount, " ", item.dealCount === 1 ? "deal" : "deals", ")"] })] })] }), _jsx("div", { className: "w-full h-2 bg-slate-200 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-blue-500 rounded-full transition-all", style: { width: `${item.collectionRate}%` } }) }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: ["AED ", (item.totalPaid / 1000000).toFixed(1), "M / ", (item.totalValue / 1000000).toFixed(1), "M"] })] }, item.stage))) })] })] })), activeTab === "overdue" && (_jsx("div", { className: "p-6", children: overduePayments.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("p", { className: "text-3xl mb-2", children: "\u2705" }), _jsx("p", { className: "font-semibold text-slate-800", children: "No overdue payments" }), _jsx("p", { className: "text-sm text-slate-400", children: "All payments are current or paid" })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Deal" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Buyer" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Milestone" }), _jsx("th", { className: "text-right px-4 py-3 font-semibold text-slate-700", children: "Amount" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-700", children: "Days Overdue" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Status" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: overduePayments.map((p) => (_jsxs("tr", { className: "hover:bg-red-50/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-600", children: p.dealNumber }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium text-slate-800", children: p.buyerName }), _jsx("p", { className: "text-xs text-slate-400", children: p.unitNumber })] }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: p.milestoneLabel }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-slate-800", children: ["AED ", p.amount.toLocaleString()] }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsxs("span", { className: "px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs", children: [p.daysOverdue, "d"] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-xs capitalize text-slate-600", children: p.status.replace(/_/g, " ") }) })] }, p.id))) })] }) })) })), activeTab === "upcoming" && (_jsx("div", { className: "p-6", children: upcomingPayments.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("p", { className: "text-3xl mb-2", children: "\uD83D\uDCC5" }), _jsx("p", { className: "font-semibold text-slate-800", children: "No upcoming payments this month" }), _jsx("p", { className: "text-sm text-slate-400", children: "Expand date range to see more" })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Deal" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Buyer" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Milestone" }), _jsx("th", { className: "text-right px-4 py-3 font-semibold text-slate-700", children: "Amount" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-700", children: "Days Until Due" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-700", children: "Status" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: upcomingPayments.map((p) => (_jsxs("tr", { className: "hover:bg-amber-50/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-600", children: p.dealNumber }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium text-slate-800", children: p.buyerName }), _jsx("p", { className: "text-xs text-slate-400", children: p.unitNumber })] }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: p.milestoneLabel }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-slate-800", children: ["AED ", p.amount.toLocaleString()] }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsxs("span", { className: "px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs", children: [p.daysUntilDue, "d"] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-xs capitalize text-slate-600", children: p.status.replace(/_/g, " ") }) })] }, p.id))) })] }) })) })), activeTab === "pipeline" && (_jsx("div", { className: "p-6 space-y-4", children: pipeline.map((item) => (_jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "font-semibold text-slate-800", children: item.stage.replace(/_/g, " ") }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-sm font-bold text-blue-600", children: [item.collectionRate, "% collected"] }), _jsxs("p", { className: "text-xs text-slate-400", children: [item.dealCount, " deals"] })] })] }), _jsx("div", { className: "w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2", children: _jsx("div", { className: "h-full bg-blue-500 rounded-full transition-all", style: { width: `${item.collectionRate}%` } }) }), _jsxs("div", { className: "grid grid-cols-3 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-500 text-xs", children: "Total Value" }), _jsxs("p", { className: "font-semibold text-slate-800", children: ["AED ", (item.totalValue / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-500 text-xs", children: "Paid" }), _jsxs("p", { className: "font-semibold text-emerald-600", children: ["AED ", (item.totalPaid / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-500 text-xs", children: "Outstanding" }), _jsxs("p", { className: "font-semibold text-red-600", children: ["AED ", (item.outstanding / 1000000).toFixed(1), "M"] })] })] })] }, item.stage))) }))] })] }));
}
