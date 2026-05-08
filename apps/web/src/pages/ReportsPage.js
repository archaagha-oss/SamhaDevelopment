import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
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
const fmtAEDFull = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n) => n.toLocaleString();
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%";
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
function KPI({ label, value, sub, color = "text-slate-800" }) {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1", children: label }), _jsx("p", { className: `text-2xl font-bold ${color}`, children: value }), sub && _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: sub })] }));
}
function SectionTitle({ children }) {
    return _jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-3", children: children });
}
/** RFC4180-compliant CSV: quote any field containing comma/quote/newline; double internal quotes. */
function toCSV(rows) {
    if (!rows.length)
        return "";
    const keys = Object.keys(rows[0]);
    const escape = (v) => {
        if (v === null || v === undefined)
            return "";
        let s = typeof v === "object" ? JSON.stringify(v) : String(v);
        if (/[",\n\r]/.test(s))
            s = `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    return [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))].join("\r\n");
}
function downloadCSV(rows, filename) {
    if (!rows.length)
        return;
    // Prepend BOM so Excel recognises UTF-8 (e.g. Arabic names)
    const blob = new Blob(["﻿" + toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
async function downloadXLSX(url, filename) {
    const res = await axios.get(url, { responseType: "blob" });
    const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
const ExportMenu = ({ csvRows, csvName, xlsxUrl, xlsxName }) => (_jsxs("div", { className: "flex gap-1.5 print:hidden", children: [_jsx("button", { onClick: () => downloadCSV(csvRows, csvName), className: "text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded px-2.5 py-1 transition-colors", title: "Download as CSV", children: "CSV" }), xlsxUrl && xlsxName && (_jsx("button", { onClick: () => downloadXLSX(xlsxUrl, xlsxName), className: "text-xs text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 rounded px-2.5 py-1 transition-colors", title: "Download styled Excel report", children: "Excel" }))] }));
// ─── Tab: Sales Pipeline ──────────────────────────────────────────────────────
function PipelineTab({ overview, dealStages, leads, range }) {
    const sorted = STAGE_ORDER.map((s) => {
        const found = dealStages.find((d) => d.stage === s);
        return { stage: STAGE_LABELS[s] || s, count: found?.count ?? 0, value: found?.totalValue ?? 0 };
    }).filter((d) => d.count > 0);
    const leadStages = Object.entries(leads.byStage).map(([stage, count]) => ({ stage: stage.replace(/_/g, " "), count }));
    const leadSources = Object.entries(leads.bySource).map(([source, count]) => ({ source, count }));
    const xlsxQs = new URLSearchParams();
    if (range.startDate)
        xlsxQs.set("startDate", range.startDate);
    if (range.endDate)
        xlsxQs.set("endDate", range.endDate);
    const dealsXlsx = `/api/reports/export/deals${xlsxQs.toString() ? "?" + xlsxQs.toString() : ""}`;
    const leadsXlsx = `/api/reports/export/leads${xlsxQs.toString() ? "?" + xlsxQs.toString() : ""}`;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Deals", value: fmtNum(overview.totalDeals) }), _jsx(KPI, { label: "Pipeline Value", value: fmtAED(overview.pipelineValue), color: "text-blue-700" }), _jsx(KPI, { label: "Total Leads", value: fmtNum(overview.totalLeads) }), _jsx(KPI, { label: "Conversion Rate", value: leads.conversionRate + "%", color: "text-emerald-700", sub: `${leads.convertedToDeals} of ${leads.totalLeads} leads` })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Deals by Stage" }), _jsx(ExportMenu, { csvRows: sorted.map((s) => ({ stage: s.stage, count: s.count, totalValue: s.value })), csvName: "deals-by-stage.csv", xlsxUrl: dealsXlsx, xlsxName: "deals-report.xlsx" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(BarChart, { data: sorted, layout: "vertical", margin: { left: 20 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", horizontal: false }), _jsx(XAxis, { type: "number", tick: { fontSize: 11 } }), _jsx(YAxis, { type: "category", dataKey: "stage", tick: { fontSize: 11 }, width: 110 }), _jsx(Tooltip, { formatter: (v) => [v, "Deals"] }), _jsx(Bar, { dataKey: "count", fill: "#3b82f6", radius: [0, 4, 4, 0] })] }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Lead Pipeline" }), _jsx(ExportMenu, { csvRows: leadStages, csvName: "lead-pipeline.csv", xlsxUrl: leadsXlsx, xlsxName: "leads-report.xlsx" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 180, children: _jsxs(BarChart, { data: leadStages, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "stage", tick: { fontSize: 10 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "count", fill: "#a855f7", radius: [4, 4, 0, 0] })] }) }), _jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 mb-2", children: "Lead Sources" }), _jsx("div", { className: "flex flex-wrap gap-2", children: leadSources.map(({ source, count }) => (_jsxs("span", { className: "text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600", children: [source, ": ", _jsx("strong", { children: count })] }, source))) })] })] })] }), (() => {
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
function RevenueTab({ overview, monthly, range }) {
    const totalExpected = monthly.reduce((s, m) => s + m.expected, 0);
    const totalCollected = overview.revenueCollected;
    const collectionRate = pct(totalCollected, totalExpected);
    const xlsxQs = new URLSearchParams();
    if (range.startDate)
        xlsxQs.set("startDate", range.startDate);
    if (range.endDate)
        xlsxQs.set("endDate", range.endDate);
    const csvRows = monthly.map((m) => ({
        month: m.label,
        collected: m.collected,
        expected: m.expected,
        variance: m.collected - m.expected,
        collectionRatePct: m.expected > 0 ? ((m.collected / m.expected) * 100).toFixed(1) : "0",
    }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Collected", value: fmtAED(totalCollected), color: "text-emerald-700" }), _jsx(KPI, { label: "Overdue", value: fmtAED(overview.overduePayments), color: "text-red-700" }), _jsx(KPI, { label: "Pipeline Value", value: fmtAED(overview.pipelineValue), color: "text-blue-700" }), _jsx(KPI, { label: "Collection Rate", value: collectionRate, sub: `${fmtAED(totalCollected)} of ${fmtAED(totalExpected)}` })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Monthly Revenue \u2014 Collected vs. Expected" }), _jsx(ExportMenu, { csvRows: csvRows, csvName: "monthly-revenue.csv", xlsxUrl: `/api/reports/export/revenue${xlsxQs.toString() ? "?" + xlsxQs.toString() : ""}`, xlsxName: "revenue-report.xlsx" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: monthly, margin: { top: 4 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "label", tick: { fontSize: 11 } }), _jsx(YAxis, { tick: { fontSize: 11 }, tickFormatter: (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v }), _jsx(Tooltip, { formatter: (v) => [`AED ${Number(v).toLocaleString()}`, ""] }), _jsx(Legend, {}), _jsx(Bar, { dataKey: "collected", name: "Collected", fill: "#10b981", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "expected", name: "Expected", fill: "#e2e8f0", radius: [4, 4, 0, 0] })] }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsx("div", { className: "px-5 py-3 border-b border-slate-100", children: _jsx(SectionTitle, { children: "Monthly Breakdown" }) }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Month", "Collected", "Expected", "Variance", "Collection %"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: monthly.map((m) => {
                                    const variance = m.collected - m.expected;
                                    const ratePct = m.expected > 0 ? (m.collected / m.expected) * 100 : 0;
                                    return (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-medium text-slate-800", children: m.label }), _jsx("td", { className: "px-4 py-3 text-emerald-700 font-medium", children: fmtAEDFull(m.collected) }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: fmtAEDFull(m.expected) }), _jsxs("td", { className: `px-4 py-3 font-medium ${variance >= 0 ? "text-emerald-700" : "text-red-600"}`, children: [variance >= 0 ? "+" : "", fmtAEDFull(variance)] }), _jsxs("td", { className: `px-4 py-3 font-semibold ${ratePct >= 90 ? "text-emerald-600" : ratePct >= 70 ? "text-amber-600" : "text-red-500"}`, children: [ratePct.toFixed(1), "%"] })] }, m.key));
                                }) }), _jsx("tfoot", { className: "bg-slate-50 border-t-2 border-slate-200", children: _jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3 font-bold text-slate-800 uppercase tracking-wide text-xs", children: "Total" }), _jsx("td", { className: "px-4 py-3 font-bold text-emerald-700", children: fmtAEDFull(totalCollected) }), _jsx("td", { className: "px-4 py-3 font-bold text-slate-700", children: fmtAEDFull(totalExpected) }), _jsxs("td", { className: `px-4 py-3 font-bold ${totalCollected - totalExpected >= 0 ? "text-emerald-700" : "text-red-600"}`, children: [totalCollected - totalExpected >= 0 ? "+" : "", fmtAEDFull(totalCollected - totalExpected)] }), _jsx("td", { className: "px-4 py-3 font-bold text-slate-800", children: collectionRate })] }) })] })] })] }));
}
// ─── Tab: Agent Performance ───────────────────────────────────────────────────
function AgentsTab({ agents }) {
    const chartData = agents.map((a) => ({
        name: a.agentName.split(" ")[0],
        leads: a.totalLeads,
        deals: a.totalDeals,
        closed: a.closedLeads,
    }));
    const totalLeads = agents.reduce((s, a) => s + a.totalLeads, 0);
    const totalClosed = agents.reduce((s, a) => s + a.closedLeads, 0);
    const totalDeals = agents.reduce((s, a) => s + a.totalDeals, 0);
    const totalRevenue = agents.reduce((s, a) => s + a.dealRevenue, 0);
    const totalComm = agents.reduce((s, a) => s + a.commissionEarned, 0);
    const avgClose = totalLeads > 0 ? (totalClosed / totalLeads) * 100 : 0;
    const csvRows = agents.map((a) => ({
        agent: a.agentName, role: a.role, leads: a.totalLeads,
        closedLeads: a.closedLeads, closeRate: a.closeRate + "%",
        deals: a.totalDeals, revenue: a.dealRevenue, commission: a.commissionEarned,
    }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Agents", value: String(agents.length) }), _jsx(KPI, { label: "Total Deals", value: fmtNum(totalDeals) }), _jsx(KPI, { label: "Commission Paid", value: fmtAED(totalComm), color: "text-emerald-700" }), _jsx(KPI, { label: "Avg Close Rate", value: avgClose.toFixed(1) + "%" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(SectionTitle, { children: "Leads vs. Deals vs. Closed \u2014 Per Agent" }), _jsx(ExportMenu, { csvRows: csvRows, csvName: "agent-performance.csv", xlsxUrl: "/api/reports/export/agents", xlsxName: "agent-performance.xlsx" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { dataKey: "leads", name: "Leads", fill: "#94a3b8", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "deals", name: "Deals", fill: "#3b82f6", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "closed", name: "Closed", fill: "#10b981", radius: [4, 4, 0, 0] })] }) })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Agent", "Role", "Leads", "Deals", "Closed Leads", "Close Rate", "Revenue", "Commission"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: agents.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No agent data" }) })) : agents.map((a) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-semibold text-slate-800", children: a.agentName }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-500", children: a.role.replace(/_/g, " ") }), _jsx("td", { className: "px-4 py-3", children: a.totalLeads }), _jsx("td", { className: "px-4 py-3", children: a.totalDeals }), _jsx("td", { className: "px-4 py-3", children: a.closedLeads }), _jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: `text-sm font-semibold ${parseFloat(a.closeRate) >= 50 ? "text-emerald-600" : parseFloat(a.closeRate) >= 25 ? "text-amber-600" : "text-red-500"}`, children: [a.closeRate, "%"] }) }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: fmtAED(a.dealRevenue) }), _jsx("td", { className: "px-4 py-3 text-emerald-700 font-medium", children: fmtAED(a.commissionEarned) })] }, a.agentId))) }), agents.length > 0 && (_jsx("tfoot", { className: "bg-slate-50 border-t-2 border-slate-200", children: _jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3 font-bold text-slate-800 uppercase tracking-wide text-xs", children: "Total" }), _jsx("td", { className: "px-4 py-3" }), _jsx("td", { className: "px-4 py-3 font-bold", children: fmtNum(totalLeads) }), _jsx("td", { className: "px-4 py-3 font-bold", children: fmtNum(totalDeals) }), _jsx("td", { className: "px-4 py-3 font-bold", children: fmtNum(totalClosed) }), _jsxs("td", { className: "px-4 py-3 font-bold", children: [avgClose.toFixed(1), "%"] }), _jsx("td", { className: "px-4 py-3 font-bold text-slate-800", children: fmtAED(totalRevenue) }), _jsx("td", { className: "px-4 py-3 font-bold text-emerald-700", children: fmtAED(totalComm) })] }) }))] }) })] }));
}
// ─── Tab: Inventory ───────────────────────────────────────────────────────────
function InventoryTab({ overview, inventory }) {
    const totalUnits = inventory.reduce((s, p) => s + p.total, 0);
    const totalAvail = inventory.reduce((s, p) => s + (p.byStatus["AVAILABLE"] || 0), 0);
    const totalSold = inventory.reduce((s, p) => s + (p.byStatus["SOLD"] || 0), 0);
    const totalRes = inventory.reduce((s, p) => s + (p.byStatus["RESERVED"] || 0), 0);
    const totalBook = inventory.reduce((s, p) => s + (p.byStatus["BOOKED"] || 0), 0);
    const totalBlock = inventory.reduce((s, p) => s + (p.byStatus["BLOCKED"] || 0), 0);
    const totalValue = inventory.reduce((s, p) => s + p.totalValue, 0);
    const aggStatus = {};
    inventory.forEach((p) => {
        Object.entries(p.byStatus).forEach(([s, c]) => { aggStatus[s] = (aggStatus[s] || 0) + c; });
    });
    const pieData = Object.entries(aggStatus).map(([name, value]) => ({ name, value }));
    const allStatuses = Array.from(new Set(inventory.flatMap((p) => Object.keys(p.byStatus))));
    const stackData = inventory.map((p) => ({ name: p.projectName.slice(0, 15), ...p.byStatus }));
    const csvRows = inventory.map((p) => ({
        project: p.projectName,
        total: p.total,
        available: p.byStatus["AVAILABLE"] || 0,
        reserved: p.byStatus["RESERVED"] || 0,
        booked: p.byStatus["BOOKED"] || 0,
        sold: p.byStatus["SOLD"] || 0,
        blocked: p.byStatus["BLOCKED"] || 0,
        availabilityPct: p.availableRate + "%",
        totalValue: p.totalValue,
    }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Units", value: fmtNum(overview.totalUnits) }), _jsx(KPI, { label: "Available", value: fmtNum(totalAvail), color: "text-emerald-700", sub: pct(totalAvail, totalUnits) + " of total" }), _jsx(KPI, { label: "Sold", value: fmtNum(totalSold), color: "text-amber-700", sub: overview.soldPercentage + "% sold" }), _jsx(KPI, { label: "Total Value", value: fmtAED(totalValue), color: "text-blue-700" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx(SectionTitle, { children: "Unit Status Distribution" }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: pieData, cx: "50%", cy: "50%", outerRadius: 90, dataKey: "value", label: ({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`, labelLine: false, children: pieData.map(({ name }) => (_jsx(Cell, { fill: STATUS_COLORS[name] || "#94a3b8" }, name))) }), _jsx(Tooltip, { formatter: (v) => [v, "Units"] })] }) }), _jsx("div", { className: "flex flex-wrap gap-2 mt-2 justify-center", children: pieData.map(({ name, value }) => (_jsxs("span", { className: "flex items-center gap-1 text-xs text-slate-600", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm inline-block", style: { background: STATUS_COLORS[name] || "#94a3b8" } }), name, ": ", value] }, name))) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx(SectionTitle, { children: "Units by Project" }), _jsx(ExportMenu, { csvRows: csvRows, csvName: "inventory.csv", xlsxUrl: "/api/reports/export/inventory", xlsxName: "inventory-report.xlsx" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: stackData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 10 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Legend, { iconType: "square", iconSize: 10, wrapperStyle: { fontSize: 11 } }), allStatuses.map((s) => (_jsx(Bar, { dataKey: s, stackId: "a", fill: STATUS_COLORS[s] || "#94a3b8", name: s }, s)))] }) })] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Project", "Total", "Available", "Reserved", "Booked", "Sold", "Blocked", "Avail. Rate", "Total Value"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: inventory.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No inventory data" }) })) : inventory.map((p) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-semibold text-slate-800", children: p.projectName }), _jsx("td", { className: "px-4 py-3", children: p.total }), _jsx("td", { className: "px-4 py-3 text-emerald-600 font-medium", children: p.byStatus["AVAILABLE"] || 0 }), _jsx("td", { className: "px-4 py-3 text-blue-600", children: p.byStatus["RESERVED"] || 0 }), _jsx("td", { className: "px-4 py-3 text-purple-600", children: p.byStatus["BOOKED"] || 0 }), _jsx("td", { className: "px-4 py-3 text-amber-600 font-medium", children: p.byStatus["SOLD"] || 0 }), _jsx("td", { className: "px-4 py-3 text-red-500", children: p.byStatus["BLOCKED"] || 0 }), _jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: `font-semibold ${parseFloat(p.availableRate) > 50 ? "text-emerald-600" : parseFloat(p.availableRate) > 20 ? "text-amber-600" : "text-red-500"}`, children: [p.availableRate, "%"] }) }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: fmtAED(p.totalValue) })] }, p.projectName))) }), inventory.length > 0 && (_jsx("tfoot", { className: "bg-slate-50 border-t-2 border-slate-200", children: _jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3 font-bold text-slate-800 uppercase tracking-wide text-xs", children: "Total" }), _jsx("td", { className: "px-4 py-3 font-bold", children: fmtNum(totalUnits) }), _jsx("td", { className: "px-4 py-3 font-bold text-emerald-700", children: fmtNum(totalAvail) }), _jsx("td", { className: "px-4 py-3 font-bold text-blue-700", children: fmtNum(totalRes) }), _jsx("td", { className: "px-4 py-3 font-bold text-purple-700", children: fmtNum(totalBook) }), _jsx("td", { className: "px-4 py-3 font-bold text-amber-700", children: fmtNum(totalSold) }), _jsx("td", { className: "px-4 py-3 font-bold text-red-600", children: fmtNum(totalBlock) }), _jsx("td", { className: "px-4 py-3 font-bold", children: pct(totalAvail, totalUnits) }), _jsx("td", { className: "px-4 py-3 font-bold text-slate-800", children: fmtAED(totalValue) })] }) }))] }) })] }));
}
// ─── Tab: Finance / Collections ───────────────────────────────────────────────
function FinanceTab({ overview, collections }) {
    if (!collections)
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    const agingColors = {
        "0-30": "bg-amber-50 border-amber-200 text-amber-700",
        "31-60": "bg-orange-50 border-orange-200 text-orange-700",
        "61-90": "bg-red-50 border-red-200 text-red-700",
        "90+": "bg-red-100 border-red-300 text-red-800",
    };
    const bucketBadge = {
        "0-30": "bg-amber-100 text-amber-700",
        "31-60": "bg-orange-100 text-orange-700",
        "61-90": "bg-red-100 text-red-700",
        "90+": "bg-red-200 text-red-900",
    };
    const overduePayments = collections.overdue.payments ?? [];
    const upcomingPayments7 = collections.upcoming.next7Days.payments ?? [];
    const overdueCsv = overduePayments.map((p) => ({
        deal: p.deal?.dealNumber ?? "",
        buyer: `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`.trim(),
        unit: p.deal?.unit?.unitNumber ?? "",
        milestone: p.milestoneLabel,
        dueDate: new Date(p.dueDate).toISOString().split("T")[0],
        daysLate: p.daysLate,
        aging: p.agingBucket,
        amount: p.amount,
        status: p.status,
    }));
    const upcomingCsv = upcomingPayments7.map((p) => ({
        deal: p.deal?.dealNumber ?? "",
        buyer: `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`.trim(),
        unit: p.deal?.unit?.unitNumber ?? "",
        milestone: p.milestoneLabel,
        dueDate: new Date(p.dueDate).toISOString().split("T")[0],
        amount: p.amount,
    }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(KPI, { label: "Total Collected", value: fmtAED(overview.revenueCollected), color: "text-emerald-700" }), _jsx(KPI, { label: "Overdue Amount", value: fmtAED(overview.overduePayments), color: "text-red-700", sub: `${collections.overdue.count} payment${collections.overdue.count !== 1 ? "s" : ""}` }), _jsx(KPI, { label: "Due in 7 Days", value: fmtAED(collections.upcoming.next7Days.total), color: "text-amber-700", sub: `${collections.upcoming.next7Days.count} payments` }), _jsx(KPI, { label: "Due in 30 Days", value: fmtAED(collections.upcoming.next30Days.total), color: "text-blue-700", sub: `${collections.upcoming.next30Days.count} payments` })] }), _jsxs("div", { children: [_jsx(SectionTitle, { children: "Overdue Aging Buckets" }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: collections.aging.map(({ range, count, amount }) => (_jsxs("div", { className: `rounded-xl border p-4 ${agingColors[range] || "bg-slate-50 border-slate-200 text-slate-600"}`, children: [_jsxs("p", { className: "text-xs font-bold uppercase tracking-wide mb-1", children: [range, " days"] }), _jsx("p", { className: "text-2xl font-bold", children: count }), _jsx("p", { className: "text-xs mt-0.5 opacity-80", children: fmtAEDFull(amount) })] }, range))) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3 border-b border-slate-100", children: [_jsx(SectionTitle, { children: "Overdue Payments" }), _jsx(ExportMenu, { csvRows: overdueCsv, csvName: "overdue-payments.csv", xlsxUrl: "/api/reports/export/collections", xlsxName: "collections-report.xlsx" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Days Late", "Aging", "Amount"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: overduePayments.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No overdue payments" }) })) : overduePayments.map((p) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-500", children: p.deal?.dealNumber }), _jsxs("td", { className: "px-4 py-3 font-semibold text-slate-800", children: [p.deal?.lead?.firstName, " ", p.deal?.lead?.lastName] }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: p.deal?.unit?.unitNumber }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate", title: p.milestoneLabel, children: p.milestoneLabel }), _jsx("td", { className: "px-4 py-3 whitespace-nowrap text-slate-700", children: fmtDate(p.dueDate) }), _jsxs("td", { className: "px-4 py-3 text-red-600 font-semibold", children: [p.daysLate, "d"] }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-semibold ${bucketBadge[p.agingBucket] || "bg-slate-100 text-slate-700"}`, children: p.agingBucket }) }), _jsx("td", { className: "px-4 py-3 font-semibold text-red-700", children: fmtAEDFull(p.amount) })] }, p.id))) }), overduePayments.length > 0 && (_jsx("tfoot", { className: "bg-slate-50 border-t-2 border-slate-200", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 7, className: "px-4 py-3 font-bold text-slate-800 uppercase tracking-wide text-xs", children: "Total Overdue" }), _jsx("td", { className: "px-4 py-3 font-bold text-red-700", children: fmtAEDFull(collections.overdue.total) })] }) }))] }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3 border-b border-slate-100", children: [_jsx(SectionTitle, { children: "Payments Due in Next 7 Days" }), _jsx(ExportMenu, { csvRows: upcomingCsv, csvName: "upcoming-7days.csv" })] }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: upcomingPayments7.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-10 text-center text-slate-400 text-sm", children: "No payments due in the next 7 days" }) })) : upcomingPayments7.map((p) => (_jsxs("tr", { className: "hover:bg-slate-50/80", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-500", children: p.deal?.dealNumber }), _jsxs("td", { className: "px-4 py-3 font-semibold text-slate-800", children: [p.deal?.lead?.firstName, " ", p.deal?.lead?.lastName] }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: p.deal?.unit?.unitNumber }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-600 max-w-[140px] truncate", title: p.milestoneLabel, children: p.milestoneLabel }), _jsx("td", { className: "px-4 py-3 whitespace-nowrap", children: (() => {
                                                const days = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000);
                                                return (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-slate-700", children: fmtDate(p.dueDate) }), _jsx("p", { className: "text-xs text-amber-600 font-medium", children: days <= 0 ? "Today" : `in ${days}d` })] }));
                                            })() }), _jsx("td", { className: "px-4 py-3 font-semibold text-slate-800", children: fmtAEDFull(p.amount) })] }, p.id))) }), upcomingPayments7.length > 0 && (_jsx("tfoot", { className: "bg-slate-50 border-t-2 border-slate-200", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 5, className: "px-4 py-3 font-bold text-slate-800 uppercase tracking-wide text-xs", children: "Total Upcoming (7d)" }), _jsx("td", { className: "px-4 py-3 font-bold text-amber-700", children: fmtAEDFull(collections.upcoming.next7Days.total) })] }) }))] })] })] }));
}
// ─── Date range presets ──────────────────────────────────────────────────────
function presetRange(preset) {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    if (preset === "all")
        return { startDate: "", endDate: "" };
    const start = new Date(today);
    switch (preset) {
        case "30d":
            start.setDate(today.getDate() - 30);
            break;
        case "90d":
            start.setDate(today.getDate() - 90);
            break;
        case "ytd":
            start.setMonth(0);
            start.setDate(1);
            break;
        case "12m":
            start.setMonth(today.getMonth() - 12);
            break;
    }
    return { startDate: start.toISOString().split("T")[0], endDate: end };
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
    // Date-range filter (applies to overview + leads + revenue)
    const [range, setRange] = useState({ startDate: "", endDate: "" });
    const [overview, setOverview] = useState(null);
    const [dealStages, setDealStages] = useState([]);
    const [leads, setLeads] = useState(null);
    const [monthly, setMonthly] = useState([]);
    const [agents, setAgents] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [collections, setCollections] = useState(null);
    const [generatedAt, setGeneratedAt] = useState(null);
    const qs = useMemo(() => {
        const p = new URLSearchParams();
        if (range.startDate)
            p.set("startDate", range.startDate);
        if (range.endDate)
            p.set("endDate", range.endDate);
        const s = p.toString();
        return s ? "?" + s : "";
    }, [range]);
    useEffect(() => {
        setLoading(true);
        Promise.all([
            axios.get("/api/reports/overview" + qs),
            axios.get("/api/reports/deals/by-stage"),
            axios.get("/api/reports/leads" + qs),
            axios.get("/api/reports/revenue/monthly" + qs),
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
            setGeneratedAt(new Date());
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, [qs]);
    const activeRangeLabel = range.startDate && range.endDate
        ? `${fmtDate(range.startDate)} → ${fmtDate(range.endDate)}`
        : "All time";
    return (_jsxs("div", { className: "p-6 space-y-5 print:p-2 print:space-y-3", children: [_jsx("style", { children: `
        @media print {
          @page { margin: 12mm; size: A4 landscape; }
          .print\\:hidden { display: none !important; }
          body { background: #fff; }
          .recharts-wrapper, .recharts-surface { page-break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      ` }), _jsxs("div", { className: "flex items-start justify-between flex-wrap gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Reports & Analytics" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [activeRangeLabel, generatedAt && _jsxs("span", { className: "ml-2 text-slate-300", children: ["\u00B7  Generated ", generatedAt.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })] })] })] }), _jsx("div", { className: "flex items-center gap-2 print:hidden", children: _jsx("button", { onClick: () => window.print(), className: "text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50", title: "Print or save as PDF", children: "Print / PDF" }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap print:hidden", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Date range" }), _jsx("div", { className: "flex gap-1", children: [
                            { id: "30d", label: "30d" }, { id: "90d", label: "90d" },
                            { id: "ytd", label: "YTD" }, { id: "12m", label: "12m" },
                            { id: "all", label: "All" },
                        ].map((p) => (_jsx("button", { onClick: () => setRange(presetRange(p.id)), className: "text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50", children: p.label }, p.id))) }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "date", value: range.startDate, onChange: (e) => setRange({ ...range, startDate: e.target.value }), className: "text-xs px-2 py-1 border border-slate-200 rounded-md text-slate-700" }), _jsx("span", { className: "text-slate-400 text-xs", children: "to" }), _jsx("input", { type: "date", value: range.endDate, onChange: (e) => setRange({ ...range, endDate: e.target.value }), className: "text-xs px-2 py-1 border border-slate-200 rounded-md text-slate-700" })] }), (range.startDate || range.endDate) && (_jsx("button", { onClick: () => setRange({ startDate: "", endDate: "" }), className: "text-xs text-slate-500 hover:text-slate-800 underline ml-1", children: "Clear" }))] }), _jsx("div", { className: "flex gap-1 bg-slate-100 p-1 rounded-xl w-fit print:hidden", children: TABS.map((t) => (_jsx("button", { onClick: () => setTab(t.id), className: `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: t.label }, t.id))) }), _jsx("div", { className: "hidden print:block", children: _jsx("h2", { className: "text-base font-bold text-slate-900", children: TABS.find((t) => t.id === tab)?.label }) }), loading ? (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : !overview || !leads ? (_jsx("div", { className: "text-center py-16 text-slate-400 text-sm", children: "Failed to load data" })) : (_jsxs(_Fragment, { children: [tab === "pipeline" && _jsx(PipelineTab, { overview: overview, dealStages: dealStages, leads: leads, range: range }), tab === "revenue" && _jsx(RevenueTab, { overview: overview, monthly: monthly, range: range }), tab === "agents" && _jsx(AgentsTab, { agents: agents }), tab === "inventory" && _jsx(InventoryTab, { overview: overview, inventory: inventory }), tab === "finance" && _jsx(FinanceTab, { overview: overview, collections: collections })] }))] }));
}
