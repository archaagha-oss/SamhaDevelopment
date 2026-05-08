import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
const PERIOD_OPTIONS = [
    { key: "1M", label: "Last 30d", months: 1 },
    { key: "3M", label: "Last 3mo", months: 3 },
    { key: "6M", label: "Last 6mo", months: 6 },
    { key: "12M", label: "Last 12mo", months: 12 },
    { key: "YTD", label: "Year to date", months: 0 },
    { key: "ALL", label: "All time", months: 0 },
];
function periodToRange(p) {
    const now = new Date();
    switch (p) {
        case "1M": return { from: new Date(now.getTime() - 30 * 86400000), months: 1 };
        case "3M": return { from: new Date(now.getTime() - 90 * 86400000), months: 3 };
        case "6M": return { from: new Date(now.getTime() - 180 * 86400000), months: 6 };
        case "12M": return { from: new Date(now.getTime() - 365 * 86400000), months: 12 };
        case "YTD": return { from: new Date(now.getFullYear(), 0, 1), months: now.getMonth() + 1 };
        case "ALL": return { months: 24 };
    }
}
// ===== Formatters =====
const fmtAED = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(2)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(0)}K`
        : `${Math.round(n)}`;
const fmtNum = (n) => n.toLocaleString();
// ===== Color tokens =====
const STAGE_COLORS = {
    NEW: "#64748b", CONTACTED: "#3b82f6", QUALIFIED: "#0ea5e9",
    OFFER_SENT: "#8b5cf6", SITE_VISIT: "#06b6d4", NEGOTIATING: "#f59e0b",
    CLOSED_WON: "#10b981", CLOSED_LOST: "#ef4444",
};
const UNIT_COLORS = {
    AVAILABLE: "#10b981", INTERESTED: "#06b6d4", RESERVED: "#8b5cf6",
    BOOKED: "#3b82f6", SOLD: "#22c55e", BLOCKED: "#ef4444", HANDED_OVER: "#0ea5e9",
};
// ===== Component =====
export default function ExecutiveDashboard() {
    const navigate = useNavigate();
    const [overview, setOverview] = useState(null);
    const [unitStatus, setUnitStatus] = useState({});
    const [leadsReport, setLeadsReport] = useState(null);
    const [monthly, setMonthly] = useState([]);
    const [collections, setCollections] = useState(null);
    const [agents, setAgents] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    // Filters
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("all"); // "all" or project id
    const [period, setPeriod] = useState("12M");
    // Load projects once for the dropdown
    useEffect(() => {
        axios.get("/api/projects")
            .then((res) => {
            const list = (res.data || []).map((p) => ({ id: p.id, name: p.name }));
            setProjects(list);
        })
            .catch(() => setProjects([]));
    }, []);
    const fetchAll = useCallback((silent = false) => {
        if (silent)
            setRefreshing(true);
        else
            setLoading(true);
        setError(null);
        const { from, months } = periodToRange(period);
        const baseParams = {};
        if (projectId !== "all")
            baseParams.projectId = projectId;
        if (from)
            baseParams.from = from.toISOString();
        Promise.all([
            axios.get("/api/reports/overview", { params: baseParams }),
            axios.get("/api/reports/units-by-status", { params: { projectId: baseParams.projectId } }),
            axios.get("/api/reports/leads", { params: baseParams }),
            axios.get("/api/reports/revenue/monthly", { params: { projectId: baseParams.projectId, months } }),
            axios.get("/api/reports/collections", { params: { projectId: baseParams.projectId } }),
            axios.get("/api/reports/agents/summary"),
            axios.get("/api/reports/inventory"),
            axios.get("/api/tasks", { params: { status: "PENDING", limit: 8 } }),
        ]).then(([o, u, l, m, c, a, i, t]) => {
            setOverview(o.data);
            setUnitStatus(u.data);
            setLeadsReport(l.data);
            setMonthly(m.data || []);
            setCollections(c.data);
            setAgents(a.data || []);
            setInventory(i.data || []);
            setTasks(Array.isArray(t.data) ? t.data : (t.data?.data || []));
        }).catch((err) => setError(err.response?.data?.error || "Failed to load dashboard"))
            .finally(() => { setLoading(false); setRefreshing(false); });
    }, [projectId, period]);
    // Refetch whenever filters change (silent so the page doesn't blank out)
    useEffect(() => { fetchAll(overview !== null); /* eslint-disable-next-line */ }, [projectId, period]);
    const activeProjectName = projectId === "all"
        ? "All projects"
        : projects.find((p) => p.id === projectId)?.name || "All projects";
    const activePeriodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label || "Last 12mo";
    // Derived data
    const unitChartData = useMemo(() => Object.entries(unitStatus).map(([status, count]) => ({
        name: status.replace(/_/g, " "),
        value: count,
        fill: UNIT_COLORS[status] || "#94a3b8",
    })), [unitStatus]);
    const stageEntries = useMemo(() => leadsReport ? Object.entries(leadsReport.byStage) : [], [leadsReport]);
    const totalStageLeads = stageEntries.reduce((s, [, v]) => s + v, 0);
    // Overdue payments needing action (top 3)
    const overdueAlertsCount = collections?.overdue.count ?? 0;
    const oqoodDueSoon = useMemo(() => {
        // tasks with type containing "OQOOD" or "DEADLINE" or due within 7 days
        const inOneWeek = Date.now() + 7 * 86400000;
        return tasks.filter((t) => (t.type || "").toUpperCase().includes("OQOOD") ||
            (t.priority === "URGENT" || t.priority === "HIGH") ||
            (new Date(t.dueDate).getTime() < inOneWeek)).slice(0, 5);
    }, [tasks]);
    if (loading)
        return (_jsx("div", { className: "flex items-center justify-center h-full bg-slate-950", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error)
        return (_jsxs("div", { className: "p-6 flex flex-col items-center justify-center h-full gap-3 bg-slate-950", children: [_jsx("p", { className: "text-red-400 font-medium", children: error }), _jsx("button", { onClick: () => fetchAll(), className: "px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700", children: "Retry" })] }));
    if (!overview || !leadsReport || !collections)
        return null;
    // ===== KPIs (top strip) =====
    const kpis = [
        {
            label: "Revenue Collected",
            value: `AED ${fmtAED(overview.revenueCollected)}`,
            sub: period === "ALL" ? "All time" : activePeriodLabel,
            tone: "from-emerald-500/15 to-emerald-500/5", accent: "text-emerald-400", icon: "↑",
        },
        {
            label: "Pipeline Value",
            value: `AED ${fmtAED(overview.pipelineValue)}`,
            sub: `${overview.totalDeals} active deals`,
            tone: "from-blue-500/15 to-blue-500/5", accent: "text-blue-400", icon: "◈",
        },
        {
            label: "Units Sold",
            value: `${overview.unitsSold} / ${overview.totalUnits}`,
            sub: `${overview.soldPercentage}% sold`,
            tone: "from-indigo-500/15 to-indigo-500/5", accent: "text-indigo-400", icon: "⊞",
        },
        {
            label: "Conversion Rate",
            value: `${leadsReport.conversionRate}%`,
            sub: `${leadsReport.convertedToDeals} of ${leadsReport.totalLeads} leads`,
            tone: "from-purple-500/15 to-purple-500/5", accent: "text-purple-400", icon: "↗",
        },
        {
            label: "Overdue Payments",
            value: `AED ${fmtAED(overview.overduePayments)}`,
            sub: `${overdueAlertsCount} payment${overdueAlertsCount === 1 ? "" : "s"}`,
            tone: "from-red-500/15 to-red-500/5", accent: "text-red-400", icon: "!",
            onClick: () => navigate("/payments"),
        },
    ];
    // Action items count
    const actionItemsCount = overdueAlertsCount +
        (collections.upcoming.next7Days.count) +
        oqoodDueSoon.length;
    return (_jsxs("div", { className: "p-6 space-y-6 bg-slate-950 min-h-full", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-white tracking-tight", children: "Command Center" }), _jsxs("p", { className: "text-slate-400 text-sm mt-1", children: [_jsx("span", { className: "text-slate-300", children: activeProjectName }), _jsx("span", { className: "mx-1.5 text-slate-600", children: "\u00B7" }), _jsx("span", { className: "text-slate-300", children: activePeriodLabel }), _jsx("span", { className: "mx-1.5 text-slate-600", children: "\u00B7" }), new Date().toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg pl-3 pr-1 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Project" }), _jsxs("select", { value: projectId, onChange: (e) => setProjectId(e.target.value), className: "bg-slate-900 text-slate-100 text-xs font-medium px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px]", children: [_jsx("option", { value: "all", children: "All projects" }), projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsx("div", { className: "flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5", children: PERIOD_OPTIONS.map((p) => (_jsx("button", { onClick: () => setPeriod(p.key), className: `px-2.5 py-1 text-xs font-medium rounded transition-colors ${period === p.key ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`, title: p.label, children: p.key }, p.key))) }), _jsx("button", { onClick: () => fetchAll(true), disabled: refreshing, className: "flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium rounded-lg border border-slate-800 transition-colors disabled:opacity-50", title: "Refresh", children: _jsx("span", { className: refreshing ? "animate-spin inline-block" : "inline-block", children: "\u21BB" }) }), _jsx("button", { onClick: () => navigate("/reports"), className: "px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors", children: "View Reports" })] })] }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-3", children: kpis.map((k) => (_jsxs("button", { onClick: k.onClick, disabled: !k.onClick, className: `text-left bg-gradient-to-br ${k.tone} bg-slate-900 border border-slate-800 rounded-xl p-4 ${k.onClick ? "hover:border-slate-700 cursor-pointer" : "cursor-default"} transition-colors`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("p", { className: "text-xs font-medium text-slate-400", children: k.label }), _jsx("span", { className: `text-base ${k.accent} leading-none`, children: k.icon })] }), _jsx("p", { className: "text-xl font-bold text-white tracking-tight", children: k.value }), _jsx("p", { className: "text-xs text-slate-500 mt-1 truncate", children: k.sub })] }, k.label))) }), _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3 border-b border-slate-800", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-amber-400", children: "\u26A0" }), _jsx("h2", { className: "text-sm font-semibold text-white", children: "Action Items" }), actionItemsCount > 0 && (_jsx("span", { className: "px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-bold rounded-full", children: actionItemsCount }))] }), _jsx("button", { onClick: () => navigate("/tasks"), className: "text-xs text-blue-400 hover:text-blue-300", children: "View all \u2192" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800", children: [_jsxs("button", { onClick: () => navigate("/payments"), className: "text-left p-5 hover:bg-slate-800/40 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-red-500" }), _jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wide", children: "Overdue Payments" })] }), _jsx("p", { className: "text-2xl font-bold text-white", children: collections.overdue.count }), _jsxs("p", { className: "text-xs text-red-400 mt-1", children: ["AED ", fmtAED(collections.overdue.total), " past due"] })] }), _jsxs("button", { onClick: () => navigate("/payments"), className: "text-left p-5 hover:bg-slate-800/40 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-amber-500" }), _jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wide", children: "Due in 7 Days" })] }), _jsx("p", { className: "text-2xl font-bold text-white", children: collections.upcoming.next7Days.count }), _jsxs("p", { className: "text-xs text-amber-400 mt-1", children: ["AED ", fmtAED(collections.upcoming.next7Days.total), " expected"] })] }), _jsxs("button", { onClick: () => navigate("/tasks"), className: "text-left p-5 hover:bg-slate-800/40 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-blue-500" }), _jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wide", children: "Pending Tasks" })] }), _jsx("p", { className: "text-2xl font-bold text-white", children: tasks.length }), _jsxs("p", { className: "text-xs text-blue-400 mt-1", children: [oqoodDueSoon.length, " urgent / due soon"] })] })] })] }), _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl p-5", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-white", children: "Revenue Trend" }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: ["Collected vs expected \u00B7 ", activePeriodLabel.toLowerCase(), " \u00B7 ", activeProjectName] })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm bg-emerald-500" }), _jsx("span", { className: "text-slate-400", children: "Collected" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm bg-blue-500/50" }), _jsx("span", { className: "text-slate-400", children: "Expected" })] })] })] }), monthly.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(AreaChart, { data: monthly, margin: { top: 5, right: 10, left: 0, bottom: 0 }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "colCollected", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#10b981", stopOpacity: 0.5 }), _jsx("stop", { offset: "100%", stopColor: "#10b981", stopOpacity: 0 })] }), _jsxs("linearGradient", { id: "colExpected", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#3b82f6", stopOpacity: 0.3 }), _jsx("stop", { offset: "100%", stopColor: "#3b82f6", stopOpacity: 0 })] })] }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#1e293b", vertical: false }), _jsx(XAxis, { dataKey: "label", tick: { fontSize: 10, fill: "#64748b" }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 10, fill: "#64748b" }, axisLine: false, tickLine: false, tickFormatter: (v) => fmtAED(v) }), _jsx(Tooltip, { contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#cbd5e1" }, formatter: (v) => `AED ${fmtAED(Number(v) || 0)}` }), _jsx(Area, { type: "monotone", dataKey: "expected", stroke: "#3b82f6", strokeWidth: 2, fill: "url(#colExpected)" }), _jsx(Area, { type: "monotone", dataKey: "collected", stroke: "#10b981", strokeWidth: 2, fill: "url(#colCollected)" })] }) })) : _jsx("p", { className: "text-slate-500 text-sm py-8 text-center", children: "No revenue data yet" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl p-5", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-white", children: "Unit Inventory" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: activeProjectName })] }), _jsx("button", { onClick: () => navigate("/units"), className: "text-xs text-blue-400 hover:text-blue-300", children: "Manage \u2192" })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-40 h-40 flex-shrink-0", children: unitChartData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: unitChartData, dataKey: "value", innerRadius: 45, outerRadius: 70, paddingAngle: 2, stroke: "none", children: unitChartData.map((entry, i) => _jsx(Cell, { fill: entry.fill }, i)) }), _jsx(Tooltip, { contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#cbd5e1" } })] }) })) : _jsx("div", { className: "w-full h-full flex items-center justify-center text-xs text-slate-500", children: "No data" }) }), _jsx("div", { className: "flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5", children: unitChartData.map((u) => (_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "w-2 h-2 rounded-sm flex-shrink-0", style: { background: u.fill } }), _jsx("span", { className: "text-xs text-slate-400 truncate", children: u.name }), _jsx("span", { className: "text-xs font-semibold text-white ml-auto", children: u.value })] }, u.name))) })] }), projectId === "all" && inventory.length > 1 && (_jsxs("div", { className: "mt-4 pt-4 border-t border-slate-800 space-y-2", children: [_jsx("p", { className: "text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1", children: "Sold rate by project" }), inventory.slice(0, 4).map((p) => {
                                        const sold = p.byStatus["SOLD"] || 0;
                                        const pct = p.total > 0 ? Math.round((sold / p.total) * 100) : 0;
                                        return (_jsxs("button", { onClick: () => setProjectId(p.projectId), className: "w-full flex items-center gap-3 hover:bg-slate-800/40 rounded -mx-2 px-2 py-1 transition-colors", children: [_jsx("span", { className: "text-xs text-slate-300 truncate w-24 text-left", children: p.projectName }), _jsx("div", { className: "flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-emerald-500", style: { width: `${pct}%` } }) }), _jsxs("span", { className: "text-xs text-slate-400 w-16 text-right", children: [sold, "/", p.total] })] }, p.projectId));
                                    })] }))] }), _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl p-5", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-4", children: [_jsx("h2", { className: "text-sm font-semibold text-white", children: "Lead Pipeline" }), _jsx("button", { onClick: () => navigate("/leads"), className: "text-xs text-blue-400 hover:text-blue-300", children: "View leads \u2192" })] }), stageEntries.length > 0 ? (_jsx("div", { className: "space-y-3", children: stageEntries.map(([stage, count]) => {
                                    const pct = totalStageLeads > 0 ? Math.round((count / totalStageLeads) * 100) : 0;
                                    const color = STAGE_COLORS[stage] || "#94a3b8";
                                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between items-baseline text-xs mb-1.5", children: [_jsx("span", { className: "text-slate-300 font-medium", children: stage.replace(/_/g, " ") }), _jsxs("span", { className: "text-slate-500", children: [_jsx("span", { className: "text-white font-semibold", children: count }), " \u00B7 ", pct, "%"] })] }), _jsx("div", { className: "h-2 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full transition-all duration-500", style: { width: `${pct}%`, background: color } }) })] }, stage));
                                }) })) : _jsx("p", { className: "text-slate-500 text-sm py-8 text-center", children: "No leads yet" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-baseline justify-between px-5 py-3 border-b border-slate-800", children: [_jsx("h2", { className: "text-sm font-semibold text-white", children: "Top Performers" }), _jsx("button", { onClick: () => navigate("/team"), className: "text-xs text-blue-400 hover:text-blue-300", children: "Team \u2192" })] }), agents.length > 0 ? (_jsx("div", { className: "divide-y divide-slate-800", children: agents.slice(0, 5).map((a, i) => (_jsxs("div", { className: "flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors", children: [_jsx("span", { className: `w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                    ${i === 0 ? "bg-amber-500/20 text-amber-400"
                                                : i === 1 ? "bg-slate-500/20 text-slate-300"
                                                    : i === 2 ? "bg-orange-700/20 text-orange-400"
                                                        : "bg-slate-800 text-slate-500"}`, children: i + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-white truncate", children: a.agentName }), _jsxs("p", { className: "text-xs text-slate-500", children: [a.totalDeals, " deals \u00B7 ", a.closeRate, "% close rate"] })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsxs("p", { className: "text-sm font-semibold text-emerald-400", children: ["AED ", fmtAED(a.dealRevenue)] }), _jsx("p", { className: "text-xs text-slate-500", children: "revenue" })] })] }, a.agentId))) })) : _jsx("p", { className: "text-slate-500 text-sm py-12 text-center", children: "No agent activity yet" })] }), _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-baseline justify-between px-5 py-3 border-b border-slate-800", children: [_jsx("h2", { className: "text-sm font-semibold text-white", children: "Open Tasks" }), _jsx("button", { onClick: () => navigate("/tasks"), className: "text-xs text-blue-400 hover:text-blue-300", children: "All tasks \u2192" })] }), tasks.length > 0 ? (_jsx("div", { className: "divide-y divide-slate-800", children: tasks.slice(0, 5).map((t) => {
                                    const due = new Date(t.dueDate);
                                    const days = Math.floor((due.getTime() - Date.now()) / 86400000);
                                    const overdue = days < 0;
                                    const target = t.deal ? `/deals/${t.deal.id}` : t.lead ? `/leads/${t.lead.id}` : "/tasks";
                                    return (_jsxs("button", { onClick: () => navigate(target), className: "w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors", children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${t.priority === "URGENT" ? "bg-red-500"
                                                    : t.priority === "HIGH" ? "bg-orange-500"
                                                        : t.priority === "MEDIUM" ? "bg-amber-500"
                                                            : "bg-slate-500"}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-slate-200 font-medium truncate", children: t.title }), _jsx("p", { className: "text-xs text-slate-500 truncate", children: t.lead ? `${t.lead.firstName} ${t.lead.lastName}` : t.deal ? t.deal.dealNumber : t.type.replace(/_/g, " ") })] }), _jsx("span", { className: `text-xs font-medium flex-shrink-0
                      ${overdue ? "text-red-400" : days <= 1 ? "text-amber-400" : "text-slate-400"}`, children: overdue ? `${Math.abs(days)}d overdue`
                                                    : days === 0 ? "Today"
                                                        : days === 1 ? "Tomorrow"
                                                            : `${days}d` })] }, t.id));
                                }) })) : _jsx("p", { className: "text-slate-500 text-sm py-12 text-center", children: "No pending tasks \uD83C\uDF89" })] })] }), _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-xl p-5", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-3", children: [_jsx("h2", { className: "text-sm font-semibold text-white", children: "Quick Actions" }), _jsx("p", { className: "text-xs text-slate-500", children: "Jump straight into common flows" })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2", children: [
                            { label: "New Lead", desc: "Capture inquiry", icon: "◉", to: "/leads", tone: "bg-blue-600/20 text-blue-400" },
                            { label: "New Deal", desc: "Start sales process", icon: "◈", to: "/deals", tone: "bg-emerald-600/20 text-emerald-400" },
                            { label: "Reservation", desc: "Hold a unit", icon: "⊗", to: "/reservations", tone: "bg-purple-600/20 text-purple-400" },
                            { label: "Send Offer", desc: "Generate offer PDF", icon: "◁", to: "/offers-list", tone: "bg-cyan-600/20 text-cyan-400" },
                            { label: "Record Pay.", desc: "Log a payment", icon: "⊟", to: "/payments", tone: "bg-amber-600/20 text-amber-400" },
                            { label: "Commissions", desc: "Approve & pay", icon: "◇", to: "/commissions", tone: "bg-pink-600/20 text-pink-400" },
                            { label: "Add Activity", desc: "Log a touchpoint", icon: "✓", to: "/tasks", tone: "bg-indigo-600/20 text-indigo-400" },
                            { label: "Browse Units", desc: "Inventory grid", icon: "⊞", to: "/units", tone: "bg-slate-600/20 text-slate-300" },
                        ].map((a) => (_jsxs("button", { onClick: () => navigate(a.to), className: "flex items-center gap-3 px-3 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors text-left", children: [_jsx("span", { className: `w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${a.tone}`, children: a.icon }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold text-white truncate", children: a.label }), _jsx("p", { className: "text-[10px] text-slate-500 truncate", children: a.desc })] })] }, a.label))) })] }), _jsxs("div", { className: "bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-800 rounded-xl p-5", children: [_jsx("h2", { className: "text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3", children: "Snapshot" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Total Leads" }), _jsx("p", { className: "text-xl font-bold text-white mt-0.5", children: fmtNum(overview.totalLeads) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Active Deals" }), _jsx("p", { className: "text-xl font-bold text-white mt-0.5", children: fmtNum(overview.totalDeals) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Sold Rate" }), _jsxs("p", { className: "text-xl font-bold text-emerald-400 mt-0.5", children: [overview.soldPercentage, "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "DLD Waived" }), _jsxs("p", { className: "text-xl font-bold text-blue-400 mt-0.5", children: ["AED ", fmtAED(overview.developerIncentives?.dldWaivedTotal ?? 0)] })] })] })] })] }));
}
