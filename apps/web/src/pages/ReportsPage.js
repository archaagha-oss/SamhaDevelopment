import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, } from "recharts";
// ─── Config ───────────────────────────────────────────────────────────────────
const STAGE_ORDER = ["RESERVATION_PENDING", "RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT", "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED", "CANCELLED"];
const STAGE_LABELS = {
    RESERVATION_PENDING: "Res. Pending", RESERVATION_CONFIRMED: "Res. Confirmed",
    SPA_PENDING: "SPA Pending", SPA_SENT: "SPA Sent", SPA_SIGNED: "SPA Signed",
    OQOOD_PENDING: "Oqood Pending", OQOOD_REGISTERED: "Oqood Reg.",
    INSTALLMENTS_ACTIVE: "Installments", HANDOVER_PENDING: "Handover Pending",
    COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const STATUS_COLORS = {
    AVAILABLE: "#10b981", RESERVED: "#3b82f6", BOOKED: "#a855f7",
    SOLD: "#f59e0b", HANDED_OVER: "#6b7280", BLOCKED: "#ef4444", NOT_RELEASED: "#94a3b8",
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAED = (n) => n >= 1000000 ? `AED ${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `AED ${(n / 1000).toFixed(0)}K` : `AED ${n.toLocaleString()}`;
const fmtNum = (n) => n.toLocaleString();
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%";
function KPI({ label, value, sub, color = "text-slate-800" }) {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1", children: label }), _jsx("p", { className: `text-2xl font-bold ${color}`, children: value }), sub && _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: sub })] }));
}
function SectionTitle({ children }) {
    return _jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-3", children: children });
}
function exportCSV(rows, filename) {
    if (!rows.length)
        return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}
// ─── Tab: Sales Pipeline ──────────────────────────────────────────────────────
function PipelineTab({ overview, dealStages, leads }) {
    const sorted = STAGE_ORDER.map((s) => {
        const found = dealStages.find((d) => d.stage === s);
        return { stage: STAGE_LABELS[s] || s, count: found?.count ?? 0, value: found?.totalValue ?? 0 };
    }).filter((d) => d.count > 0);
    const leadStages = Object.entries(leads.byStage).map(([stage, count]) => ({ stage: stage.replace(/_/g, " "), count }));
    const leadSources = Object.entries(leads.bySource).map(([source, count]) => ({ source, count }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Deals", value: fmtNum(overview.totalDeals) }), _jsx(KPI, { label: "Pipeline Value", value: fmtAED(overview.pipelineValue), color: "text-blue-700" }), _jsx(KPI, { label: "Total Leads", value: fmtNum(overview.totalLeads) }), _jsx(KPI, { label: "Conversion Rate", value: leads.conversionRate + "%", color: "text-emerald-700", sub: `${leads.convertedToDeals} of ${leads.totalLeads} leads` })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Deals by Stage" }), _jsx("button", { onClick: () => exportCSV(sorted, "deals-by-stage.csv"), className: "text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1", children: "Export" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(BarChart, { data: sorted, layout: "vertical", margin: { left: 20 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", horizontal: false }), _jsx(XAxis, { type: "number", tick: { fontSize: 11 } }), _jsx(YAxis, { type: "category", dataKey: "stage", tick: { fontSize: 11 }, width: 110 }), _jsx(Tooltip, { formatter: (v) => [v, "Deals"] }), _jsx(Bar, { dataKey: "count", fill: "#3b82f6", radius: [0, 4, 4, 0] })] }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Lead Pipeline" }), _jsx("button", { onClick: () => exportCSV(leadStages, "lead-pipeline.csv"), className: "text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1", children: "Export" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 180, children: _jsxs(BarChart, { data: leadStages, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "stage", tick: { fontSize: 10 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "count", fill: "#a855f7", radius: [4, 4, 0, 0] })] }) }), _jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 mb-2", children: "Lead Sources" }), _jsx("div", { className: "flex flex-wrap gap-2", children: leadSources.map(({ source, count }) => (_jsxs("span", { className: "text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600", children: [source, ": ", _jsx("strong", { children: count })] }, source))) })] })] })] }), (() => {
                const funnelStages = [
                    { label: "Total Leads", value: overview.totalLeads, color: "bg-purple-500" },
                    { label: "Active Deals", value: overview.totalDeals, color: "bg-blue-500" },
                    {
                        label: "Res. Confirmed",
                        value: sorted.find((s) => s.stage === STAGE_LABELS["RESERVATION_CONFIRMED"])?.count
                            ?? sorted.filter((s) => !["Cancelled", "Res. Pending"].includes(s.stage)).reduce((a, s) => a + s.count, 0),
                        color: "bg-indigo-500",
                    },
                    {
                        label: "Completed",
                        value: sorted.find((s) => s.stage === STAGE_LABELS["COMPLETED"])?.count ?? 0,
                        color: "bg-emerald-500",
                    },
                ];
                const max = funnelStages[0]?.value || 1;
                return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx(SectionTitle, { children: "Conversion Funnel" }), _jsx("div", { className: "space-y-3 mt-2", children: funnelStages.map((stage, i) => {
                                const pctOfFirst = max > 0 ? (stage.value / max) * 100 : 0;
                                const pctOfPrev = i > 0 && funnelStages[i - 1].value > 0
                                    ? ((stage.value / funnelStages[i - 1].value) * 100).toFixed(0) + "% of prev"
                                    : "";
                                return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-xs font-medium text-slate-600", children: stage.label }), _jsxs("span", { className: "text-xs text-slate-500", children: [_jsx("strong", { className: "text-slate-800", children: stage.value.toLocaleString() }), pctOfPrev && _jsxs("span", { className: "ml-2 text-slate-400", children: ["(", pctOfPrev, ")"] })] })] }), _jsx("div", { className: "h-6 bg-slate-100 rounded-lg overflow-hidden", children: _jsx("div", { className: `h-full ${stage.color} rounded-lg transition-all`, style: { width: `${Math.max(pctOfFirst, 1)}%` } }) })] }, stage.label));
                            }) })] }));
            })()] }));
}
// ─── Tab: Revenue ─────────────────────────────────────────────────────────────
function RevenueTab({ overview, monthly }) {
    const totalExpected = monthly.reduce((s, m) => s + m.expected, 0);
    const totalCollected = overview.revenueCollected;
    const collectionRate = pct(totalCollected, totalExpected);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Collected", value: fmtAED(totalCollected), color: "text-emerald-700" }), _jsx(KPI, { label: "Overdue", value: fmtAED(overview.overduePayments), color: "text-red-700" }), _jsx(KPI, { label: "Pipeline Value", value: fmtAED(overview.pipelineValue), color: "text-blue-700" }), _jsx(KPI, { label: "Collection Rate", value: collectionRate, sub: `${fmtAED(totalCollected)} of ${fmtAED(totalExpected)}` })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Monthly Revenue \u2014 Last 12 Months" }), _jsx("button", { onClick: () => exportCSV(monthly, "monthly-revenue.csv"), className: "text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1", children: "Export" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: monthly, margin: { top: 4 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "label", tick: { fontSize: 11 } }), _jsx(YAxis, { tick: { fontSize: 11 }, tickFormatter: (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v }), _jsx(Tooltip, { formatter: (v) => [`AED ${Number(v).toLocaleString()}`, ""] }), _jsx(Legend, {}), _jsx(Bar, { dataKey: "collected", name: "Collected", fill: "#10b981", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "expected", name: "Expected", fill: "#e2e8f0", radius: [4, 4, 0, 0] })] }) })] })] }));
}
// ─── Tab: Agent Performance ───────────────────────────────────────────────────
function AgentsTab({ agents }) {
    const chartData = agents.map((a) => ({
        name: a.agentName.split(" ")[0],
        leads: a.totalLeads,
        deals: a.totalDeals,
        closed: a.closedLeads,
    }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Agents", value: String(agents.length) }), _jsx(KPI, { label: "Total Deals", value: fmtNum(agents.reduce((s, a) => s + a.totalDeals, 0)) }), _jsx(KPI, { label: "Commission Paid", value: fmtAED(agents.reduce((s, a) => s + a.commissionEarned, 0)), color: "text-emerald-700" }), _jsx(KPI, { label: "Avg Close Rate", value: agents.length ? (agents.reduce((s, a) => s + parseFloat(a.closeRate), 0) / agents.length).toFixed(1) + "%" : "0%" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Leads vs. Deals vs. Closed \u2014 Per Agent" }), _jsx("button", { onClick: () => exportCSV(agents, "agent-performance.csv"), className: "text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1", children: "Export" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { dataKey: "leads", name: "Leads", fill: "#94a3b8", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "deals", name: "Deals", fill: "#3b82f6", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "closed", name: "Closed", fill: "#10b981", radius: [4, 4, 0, 0] })] }) })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Agent", "Role", "Leads", "Deals", "Closed Leads", "Close Rate", "Revenue", "Commission"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: agents.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No agent data" }) })) : agents.map((a) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-semibold text-slate-800", children: a.agentName }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-500", children: a.role.replace(/_/g, " ") }), _jsx("td", { className: "px-4 py-3", children: a.totalLeads }), _jsx("td", { className: "px-4 py-3", children: a.totalDeals }), _jsx("td", { className: "px-4 py-3", children: a.closedLeads }), _jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: `text-sm font-semibold ${parseFloat(a.closeRate) >= 50 ? "text-emerald-600" : parseFloat(a.closeRate) >= 25 ? "text-amber-600" : "text-red-500"}`, children: [a.closeRate, "%"] }) }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: fmtAED(a.dealRevenue) }), _jsx("td", { className: "px-4 py-3 text-emerald-700 font-medium", children: fmtAED(a.commissionEarned) })] }, a.agentId))) })] }) })] }));
}
// ─── Tab: Inventory ───────────────────────────────────────────────────────────
function InventoryTab({ overview, inventory }) {
    const totalUnits = inventory.reduce((s, p) => s + p.total, 0);
    const totalAvail = inventory.reduce((s, p) => s + (p.byStatus["AVAILABLE"] || 0), 0);
    const totalSold = inventory.reduce((s, p) => s + (p.byStatus["SOLD"] || 0), 0);
    const totalValue = inventory.reduce((s, p) => s + p.totalValue, 0);
    // Aggregate all statuses across projects for pie chart
    const aggStatus = {};
    inventory.forEach((p) => {
        Object.entries(p.byStatus).forEach(([s, c]) => { aggStatus[s] = (aggStatus[s] || 0) + c; });
    });
    const pieData = Object.entries(aggStatus).map(([name, value]) => ({ name, value }));
    // Stacked bar per project
    const allStatuses = Array.from(new Set(inventory.flatMap((p) => Object.keys(p.byStatus))));
    const stackData = inventory.map((p) => ({ name: p.projectName.slice(0, 15), ...p.byStatus }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Units", value: fmtNum(overview.totalUnits) }), _jsx(KPI, { label: "Available", value: fmtNum(totalAvail), color: "text-emerald-700", sub: pct(totalAvail, totalUnits) + " of total" }), _jsx(KPI, { label: "Sold", value: fmtNum(totalSold), color: "text-amber-700", sub: overview.soldPercentage + "% sold" }), _jsx(KPI, { label: "Total Value", value: fmtAED(totalValue), color: "text-blue-700" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx(SectionTitle, { children: "Unit Status Distribution" }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: pieData, cx: "50%", cy: "50%", outerRadius: 90, dataKey: "value", label: ({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`, labelLine: false, children: pieData.map(({ name }) => (_jsx(Cell, { fill: STATUS_COLORS[name] || "#94a3b8" }, name))) }), _jsx(Tooltip, { formatter: (v) => [v, "Units"] })] }) }), _jsx("div", { className: "flex flex-wrap gap-2 mt-2 justify-center", children: pieData.map(({ name, value }) => (_jsxs("span", { className: "flex items-center gap-1 text-xs text-slate-600", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm inline-block", style: { background: STATUS_COLORS[name] || "#94a3b8" } }), name, ": ", value] }, name))) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx(SectionTitle, { children: "Units by Project" }), _jsx("button", { onClick: () => exportCSV(inventory, "inventory.csv"), className: "text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1", children: "Export" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: stackData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 10 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Legend, { iconType: "square", iconSize: 10, wrapperStyle: { fontSize: 11 } }), allStatuses.map((s) => (_jsx(Bar, { dataKey: s, stackId: "a", fill: STATUS_COLORS[s] || "#94a3b8", name: s }, s)))] }) })] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Project", "Total", "Available", "Reserved", "Booked", "Sold", "Blocked", "Avail. Rate", "Total Value"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: inventory.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No inventory data" }) })) : inventory.map((p) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-semibold text-slate-800", children: p.projectName }), _jsx("td", { className: "px-4 py-3", children: p.total }), _jsx("td", { className: "px-4 py-3 text-emerald-600 font-medium", children: p.byStatus["AVAILABLE"] || 0 }), _jsx("td", { className: "px-4 py-3 text-blue-600", children: p.byStatus["RESERVED"] || 0 }), _jsx("td", { className: "px-4 py-3 text-purple-600", children: p.byStatus["BOOKED"] || 0 }), _jsx("td", { className: "px-4 py-3 text-amber-600 font-medium", children: p.byStatus["SOLD"] || 0 }), _jsx("td", { className: "px-4 py-3 text-red-500", children: p.byStatus["BLOCKED"] || 0 }), _jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: `font-semibold ${parseFloat(p.availableRate) > 50 ? "text-emerald-600" : parseFloat(p.availableRate) > 20 ? "text-amber-600" : "text-red-500"}`, children: [p.availableRate, "%"] }) }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: fmtAED(p.totalValue) })] }, p.projectName))) })] }) })] }));
}
// ─── Tab: Finance / Collections ───────────────────────────────────────────────
function FinanceTab({ overview, collections }) {
    const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
    if (!collections)
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    const agingColors = {
        "0-30": "bg-amber-50 border-amber-200 text-amber-700",
        "31-60": "bg-orange-50 border-orange-200 text-orange-700",
        "61-90": "bg-red-50 border-red-200 text-red-700",
        "90+": "bg-red-100 border-red-300 text-red-800",
    };
    // The collections API returns overdue count/total but not payment rows; we show upcoming for the table
    const upcomingPayments7 = collections.upcoming.next7Days.payments ?? [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Collected", value: fmtAED(overview.revenueCollected), color: "text-emerald-700" }), _jsx(KPI, { label: "Overdue Amount", value: fmtAED(overview.overduePayments), color: "text-red-700", sub: `${collections.overdue.count} payment${collections.overdue.count !== 1 ? "s" : ""}` }), _jsx(KPI, { label: "Due in 7 Days", value: fmtAED(collections.upcoming.next7Days.total), color: "text-amber-700", sub: `${collections.upcoming.next7Days.count} payments` }), _jsx(KPI, { label: "Due in 30 Days", value: fmtAED(collections.upcoming.next30Days.total), color: "text-blue-700", sub: `${collections.upcoming.next30Days.count} payments` })] }), _jsxs("div", { children: [_jsx(SectionTitle, { children: "Overdue Aging Buckets" }), _jsx("div", { className: "grid grid-cols-4 gap-3", children: collections.aging.map(({ range, count, amount }) => (_jsxs("div", { className: `rounded-xl border p-4 ${agingColors[range] || "bg-slate-50 border-slate-200 text-slate-600"}`, children: [_jsxs("p", { className: "text-xs font-bold uppercase tracking-wide mb-1", children: [range, " days"] }), _jsx("p", { className: "text-2xl font-bold", children: count }), _jsxs("p", { className: "text-xs mt-0.5 opacity-80", children: ["AED ", amount.toLocaleString()] })] }, range))) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3 border-b border-slate-100", children: [_jsx(SectionTitle, { children: "Payments Due in Next 7 Days" }), _jsx("button", { onClick: () => exportCSV(upcomingPayments7.map((p) => ({
                                    deal: p.deal?.dealNumber ?? "",
                                    buyer: `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`,
                                    unit: p.deal?.unit?.unitNumber ?? "",
                                    milestone: p.milestoneLabel,
                                    dueDate: new Date(p.dueDate).toLocaleDateString("en-AE"),
                                    amount: p.amount,
                                })), "upcoming-7days.csv"), className: "text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1", children: "Export" })] }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: upcomingPayments7.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No payments due in the next 7 days" }) })) : upcomingPayments7.map((p) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-500", children: p.deal?.dealNumber }), _jsxs("td", { className: "px-4 py-3 font-semibold text-slate-800", children: [p.deal?.lead?.firstName, " ", p.deal?.lead?.lastName] }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: p.deal?.unit?.unitNumber }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-600 max-w-[140px] truncate", title: p.milestoneLabel, children: p.milestoneLabel }), _jsx("td", { className: "px-4 py-3 whitespace-nowrap", children: (() => {
                                                const days = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000);
                                                return (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-slate-700", children: fmtDate(p.dueDate) }), _jsx("p", { className: "text-xs text-amber-600 font-medium", children: days <= 0 ? "Today" : `in ${days}d` })] }));
                                            })() }), _jsxs("td", { className: "px-4 py-3 font-semibold text-slate-800", children: ["AED ", p.amount.toLocaleString()] })] }, p.id))) })] })] })] }));
}
const TABS = [
    { id: "pipeline", label: "Sales Pipeline" },
    { id: "revenue", label: "Revenue" },
    { id: "agents", label: "Agent Performance" },
    { id: "inventory", label: "Inventory" },
    { id: "finance", label: "Finance" },
];
export default function ReportsPage() {
    const [tab, setTab] = useState("pipeline");
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [dealStages, setDealStages] = useState([]);
    const [leads, setLeads] = useState(null);
    const [monthly, setMonthly] = useState([]);
    const [agents, setAgents] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [collections, setCollections] = useState(null);
    useEffect(() => {
        setLoading(true);
        Promise.all([
            axios.get("/api/reports/overview"),
            axios.get("/api/reports/deals/by-stage"),
            axios.get("/api/reports/leads"),
            axios.get("/api/reports/revenue/monthly"),
            axios.get("/api/reports/agents/summary"),
            axios.get("/api/reports/inventory"),
            axios.get("/api/reports/collections"),
        ]).then(([ov, ds, ld, rev, ag, inv, col]) => {
            setOverview(ov.data);
            setDealStages(ds.data);
            setLeads(ld.data);
            setMonthly(rev.data);
            setAgents(ag.data);
            setInventory(inv.data);
            setCollections(col.data);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, []);
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Reports & Analytics" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Live data across pipeline, revenue, agents, and inventory" })] }), _jsx("div", { className: "flex gap-1 bg-slate-100 p-1 rounded-xl w-fit", children: TABS.map((t) => (_jsx("button", { onClick: () => setTab(t.id), className: `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: t.label }, t.id))) }), loading ? (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : !overview || !leads ? (_jsx("div", { className: "text-center py-16 text-slate-400 text-sm", children: "Failed to load data" })) : (_jsxs(_Fragment, { children: [tab === "pipeline" && _jsx(PipelineTab, { overview: overview, dealStages: dealStages, leads: leads }), tab === "revenue" && _jsx(RevenueTab, { overview: overview, monthly: monthly }), tab === "agents" && _jsx(AgentsTab, { agents: agents }), tab === "inventory" && _jsx(InventoryTab, { overview: overview, inventory: inventory }), tab === "finance" && _jsx(FinanceTab, { overview: overview, collections: collections })] }))] }));
}
