import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton, SkeletonKpi } from "./Skeleton";
import { IconRefresh } from "./Icons";
function timeAgo(d) {
    if (!d)
        return "—";
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 5)
        return "just now";
    if (diff < 60)
        return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60)
        return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
const fmtM = (n) => `${(n / 1000000).toFixed(2)}M`;
const fmtK = (n) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
const STAGE_COLORS = {
    NEW: "#64748b", CONTACTED: "#3b82f6", OFFER_SENT: "#8b5cf6",
    SITE_VISIT: "#06b6d4", NEGOTIATING: "#f59e0b", CLOSED_WON: "#10b981", CLOSED_LOST: "#ef4444",
};
const BAR_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
export default function ExecutiveDashboard() {
    const [overview, setOverview] = useState(null);
    const [unitStatus, setUnitStatus] = useState({});
    const [leadsReport, setLeadsReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastFetched, setLastFetched] = useState(null);
    const [, setNowTick] = useState(0);
    const fetchDashboardData = () => {
        setLoading(true);
        setError(null);
        Promise.all([
            axios.get("/api/reports/overview"),
            axios.get("/api/reports/units-by-status"),
            axios.get("/api/reports/leads"),
        ]).then(([o, u, l]) => {
            setOverview(o.data);
            setUnitStatus(u.data);
            setLeadsReport(l.data);
            setLastFetched(new Date());
        }).catch((err) => setError(err.response?.data?.error || "Failed to load dashboard"))
            .finally(() => setLoading(false));
    };
    useEffect(() => { fetchDashboardData(); }, []);
    // Re-render the "Updated Xm ago" label every 30s without refetching.
    useEffect(() => {
        const id = setInterval(() => setNowTick((n) => n + 1), 30000);
        return () => clearInterval(id);
    }, []);
    if (loading && !overview)
        return (_jsxs("div", { className: "p-6 space-y-6", role: "status", "aria-busy": "true", "aria-label": "Loading dashboard", children: [_jsxs("div", { children: [_jsx(Skeleton, { className: "h-6 w-44" }), _jsx(Skeleton, { className: "h-3 w-72 mt-2" })] }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: Array.from({ length: 4 }).map((_, i) => _jsx(SkeletonKpi, {}, i)) }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: Array.from({ length: 3 }).map((_, i) => _jsx(SkeletonKpi, {}, i)) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsx(Skeleton, { className: "h-64 w-full", rounded: "xl" }), _jsx(Skeleton, { className: "h-64 w-full", rounded: "xl" })] })] }));
    if (error)
        return (_jsxs("div", { className: "p-6 flex flex-col items-center justify-center h-64 gap-3", children: [_jsx("p", { className: "text-red-500 font-medium", children: error }), _jsx("button", { onClick: fetchDashboardData, className: "px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700", children: "Retry" })] }));
    if (!overview || !leadsReport)
        return null;
    const unitChartData = Object.entries(unitStatus).map(([status, count], i) => ({
        name: status.replace(/_/g, " "), value: count, fill: BAR_COLORS[i % BAR_COLORS.length],
    }));
    const stageEntries = Object.entries(leadsReport.byStage);
    const totalStageLeads = stageEntries.reduce((s, [, v]) => s + v, 0);
    const kpis = [
        { label: "Revenue Collected", value: fmtM(overview.revenueCollected), sub: "AED", color: "bg-blue-600", icon: "↑", to: "/payments" },
        { label: "Pipeline Value", value: fmtM(overview.pipelineValue), sub: "AED in pipeline", color: "bg-indigo-600", icon: "◈", to: "/deals" },
        { label: "Units Sold", value: `${overview.unitsSold}/${overview.totalUnits}`, sub: `${overview.soldPercentage}% sold`, color: "bg-emerald-600", icon: "⊞", to: "/units" },
        { label: "Overdue Payments", value: fmtK(overview.overduePayments), sub: "AED overdue", color: "bg-red-500", icon: "!", to: "/payments" },
    ];
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-900", children: "Command Center" }), _jsx("p", { className: "text-slate-500 text-sm mt-0.5", children: "Real-time sales pipeline overview" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-xs text-slate-400", title: lastFetched ? lastFetched.toLocaleString() : "", "aria-live": "polite", children: ["Updated ", timeAgo(lastFetched)] }), _jsxs("button", { onClick: fetchDashboardData, disabled: loading, className: "px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400", "aria-label": "Refresh dashboard", children: [_jsx(IconRefresh, { size: 12, "aria-hidden": "true", className: loading ? "animate-spin" : "" }), _jsx("span", { children: "Refresh" })] })] })] }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: kpis.map((k) => (_jsxs(Link, { to: k.to, className: `${k.color} rounded-xl p-4 text-white block hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all`, "aria-label": `${k.label}: ${k.value}. View ${k.to.replace("/", "")}.`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("p", { className: "text-xs font-medium opacity-80", children: k.label }), _jsx("span", { className: "text-lg opacity-60 leading-none", "aria-hidden": "true", children: k.icon })] }), _jsx("p", { className: "text-2xl font-bold tracking-tight", children: k.value }), _jsx("p", { className: "text-xs opacity-70 mt-0.5", children: k.sub })] }, k.label))) }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [
                    { label: "Total Leads", value: overview.totalLeads, color: "text-blue-600", to: "/leads" },
                    { label: "Active Deals", value: overview.totalDeals, color: "text-emerald-600", to: "/deals" },
                    { label: "Conversion Rate", value: `${leadsReport.conversionRate}%`, color: "text-purple-600", to: "/reports" },
                ].map((m) => (_jsxs(Link, { to: m.to, className: "bg-white rounded-xl border border-slate-200 p-4 block hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all", children: [_jsx("p", { className: "text-slate-500 text-xs mb-1", children: m.label }), _jsx("p", { className: `text-2xl font-bold ${m.color}`, children: m.value })] }, m.label))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-700 mb-4", children: "Units by Status" }), unitChartData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: unitChartData, barCategoryGap: "30%", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 10, fill: "#94a3b8" }, angle: -30, textAnchor: "end", height: 50 }), _jsx(YAxis, { tick: { fontSize: 10, fill: "#94a3b8" } }), _jsx(Tooltip, { contentStyle: { fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8 } }), _jsx(Bar, { dataKey: "value", radius: [4, 4, 0, 0], children: unitChartData.map((entry, i) => _jsx(Cell, { fill: entry.fill }, i)) })] }) })) : _jsx("p", { className: "text-slate-400 text-sm", children: "No data" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-700 mb-4", children: "Lead Pipeline" }), _jsx("div", { className: "space-y-2.5", children: stageEntries.map(([stage, count]) => {
                                    const pct = totalStageLeads > 0 ? Math.round((count / totalStageLeads) * 100) : 0;
                                    const color = STAGE_COLORS[stage] || "#94a3b8";
                                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs mb-1", children: [_jsx("span", { className: "text-slate-600 font-medium", children: stage.replace(/_/g, " ") }), _jsxs("span", { className: "text-slate-500", children: [count, " (", pct, "%)"] })] }), _jsx("div", { className: "h-1.5 bg-slate-100 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full transition-all", style: { width: `${pct}%`, background: color } }) })] }, stage));
                                }) })] })] }), _jsxs("div", { className: "bg-slate-900 rounded-xl p-5 text-white", children: [_jsx("h2", { className: "text-sm font-semibold mb-3 text-slate-300", children: "Summary" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-400 text-xs", children: "Sold Rate" }), _jsxs("p", { className: "font-bold text-lg", children: [overview.soldPercentage, "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400 text-xs", children: "Collected" }), _jsxs("p", { className: "font-bold text-lg", children: ["AED ", fmtM(overview.revenueCollected)] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400 text-xs", children: "Leads \u2192 Deals" }), _jsxs("p", { className: "font-bold text-lg", children: [leadsReport.conversionRate, "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400 text-xs", children: "Overdue" }), _jsxs("p", { className: "font-bold text-lg text-red-400", children: ["AED ", fmtK(overview.overduePayments)] })] })] })] })] }));
}
