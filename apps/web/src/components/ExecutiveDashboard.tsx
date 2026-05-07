import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

// ===== Types =====
interface Overview {
  unitsSold: number; totalUnits: number; soldPercentage: number | string;
  revenueCollected: number; pipelineValue: number; overduePayments: number;
  totalLeads: number; totalDeals: number;
  developerIncentives?: { dldWaivedTotal: number; adminFeeWaivedCount: number };
}
interface LeadsReport {
  byStage: Record<string, number>; bySource: Record<string, number>;
  conversionRate: number | string; totalLeads: number; convertedToDeals: number;
}
interface UnitStatus { [key: string]: number; }
interface MonthlyRevenue { key: string; label: string; collected: number; expected: number; }
interface CollectionsData {
  overdue: { count: number; total: number };
  aging: { range: string; count: number; amount: number }[];
  upcoming: {
    next7Days:  { count: number; total: number; payments: any[] };
    next30Days: { count: number; total: number; payments: any[] };
  };
}
interface AgentSummary {
  agentId: string; agentName: string; role: string;
  totalLeads: number; closedLeads: number; closeRate: string;
  totalDeals: number; dealRevenue: number; commissionEarned: number;
}
interface InventoryProject {
  projectId: string; projectName: string; total: number;
  byStatus: Record<string, number>; totalValue: number; availableRate: string;
}
interface Task {
  id: string; title: string; type: string; priority: string; status: string;
  dueDate: string;
  lead?: { id: string; firstName: string; lastName: string } | null;
  deal?: { id: string; dealNumber: string } | null;
}

// ===== Formatters =====
const fmtAED = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
  : `${Math.round(n)}`;

const fmtNum = (n: number) => n.toLocaleString();

// ===== Color tokens =====
const STAGE_COLORS: Record<string, string> = {
  NEW: "#64748b", CONTACTED: "#3b82f6", QUALIFIED: "#0ea5e9",
  OFFER_SENT: "#8b5cf6", SITE_VISIT: "#06b6d4", NEGOTIATING: "#f59e0b",
  CLOSED_WON: "#10b981", CLOSED_LOST: "#ef4444",
};
const UNIT_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981", INTERESTED: "#06b6d4", RESERVED: "#8b5cf6",
  BOOKED: "#3b82f6", SOLD: "#22c55e", BLOCKED: "#ef4444", HANDED_OVER: "#0ea5e9",
};

// ===== Component =====
export default function ExecutiveDashboard(): React.ReactNode {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [unitStatus, setUnitStatus] = useState<UnitStatus>({});
  const [leadsReport, setLeadsReport] = useState<LeadsReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [collections, setCollections] = useState<CollectionsData | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [inventory, setInventory] = useState<InventoryProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    Promise.all([
      axios.get("/api/reports/overview"),
      axios.get("/api/reports/units-by-status"),
      axios.get("/api/reports/leads"),
      axios.get("/api/reports/revenue/monthly"),
      axios.get("/api/reports/collections"),
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
  };

  useEffect(() => { fetchAll(); }, []);

  // Derived data
  const unitChartData = useMemo(
    () => Object.entries(unitStatus).map(([status, count]) => ({
      name: status.replace(/_/g, " "),
      value: count,
      fill: UNIT_COLORS[status] || "#94a3b8",
    })),
    [unitStatus],
  );

  const stageEntries = useMemo(
    () => leadsReport ? Object.entries(leadsReport.byStage) : [],
    [leadsReport],
  );
  const totalStageLeads = stageEntries.reduce((s, [, v]) => s + v, 0);

  // Overdue payments needing action (top 3)
  const overdueAlertsCount = collections?.overdue.count ?? 0;
  const oqoodDueSoon = useMemo(() => {
    // tasks with type containing "OQOOD" or "DEADLINE" or due within 7 days
    const inOneWeek = Date.now() + 7 * 86400000;
    return tasks.filter((t) =>
      (t.type || "").toUpperCase().includes("OQOOD") ||
      (t.priority === "URGENT" || t.priority === "HIGH") ||
      (new Date(t.dueDate).getTime() < inOneWeek),
    ).slice(0, 5);
  }, [tasks]);

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-slate-950">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="p-6 flex flex-col items-center justify-center h-full gap-3 bg-slate-950">
      <p className="text-red-400 font-medium">{error}</p>
      <button onClick={() => fetchAll()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Retry</button>
    </div>
  );
  if (!overview || !leadsReport || !collections) return null;

  // ===== KPIs (top strip) =====
  const kpis = [
    {
      label: "Revenue Collected",
      value: `AED ${fmtAED(overview.revenueCollected)}`,
      sub: `${monthly.length > 0 ? `Last 12mo: AED ${fmtAED(monthly.reduce((s,m) => s + m.collected, 0))}` : "All time"}`,
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
  const actionItemsCount =
    overdueAlertsCount +
    (collections.upcoming.next7Days.count) +
    oqoodDueSoon.length;

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-full">
      {/* ===== Header ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time pipeline overview · {new Date().toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span>
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            View Reports
          </button>
        </div>
      </div>

      {/* ===== KPI Strip ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={k.onClick}
            disabled={!k.onClick}
            className={`text-left bg-gradient-to-br ${k.tone} bg-slate-900 border border-slate-800 rounded-xl p-4 ${k.onClick ? "hover:border-slate-700 cursor-pointer" : "cursor-default"} transition-colors`}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium text-slate-400">{k.label}</p>
              <span className={`text-base ${k.accent} leading-none`}>{k.icon}</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{k.value}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* ===== Action Items / Alerts ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⚠</span>
            <h2 className="text-sm font-semibold text-white">Action Items</h2>
            {actionItemsCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-bold rounded-full">
                {actionItemsCount}
              </span>
            )}
          </div>
          <button onClick={() => navigate("/tasks")} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Overdue */}
          <button
            onClick={() => navigate("/payments")}
            className="text-left p-5 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Overdue Payments</p>
            </div>
            <p className="text-2xl font-bold text-white">{collections.overdue.count}</p>
            <p className="text-xs text-red-400 mt-1">AED {fmtAED(collections.overdue.total)} past due</p>
          </button>

          {/* Upcoming 7 days */}
          <button
            onClick={() => navigate("/payments")}
            className="text-left p-5 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Due in 7 Days</p>
            </div>
            <p className="text-2xl font-bold text-white">{collections.upcoming.next7Days.count}</p>
            <p className="text-xs text-amber-400 mt-1">AED {fmtAED(collections.upcoming.next7Days.total)} expected</p>
          </button>

          {/* Pending Tasks */}
          <button
            onClick={() => navigate("/tasks")}
            className="text-left p-5 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pending Tasks</p>
            </div>
            <p className="text-2xl font-bold text-white">{tasks.length}</p>
            <p className="text-xs text-blue-400 mt-1">{oqoodDueSoon.length} urgent / due soon</p>
          </button>
        </div>
      </div>

      {/* ===== Revenue Trend ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Revenue Trend</h2>
            <p className="text-xs text-slate-500 mt-0.5">Collected vs expected · last 12 months</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-slate-400">Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/50" />
              <span className="text-slate-400">Expected</span>
            </div>
          </div>
        </div>
        {monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtAED(v)}
              />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#cbd5e1" }}
                formatter={(v) => `AED ${fmtAED(Number(v) || 0)}`}
              />
              <Area type="monotone" dataKey="expected"  stroke="#3b82f6" strokeWidth={2} fill="url(#colExpected)"  />
              <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#colCollected)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="text-slate-500 text-sm py-8 text-center">No revenue data yet</p>}
      </div>

      {/* ===== Inventory + Lead Pipeline ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Unit Inventory</h2>
            <button onClick={() => navigate("/units")} className="text-xs text-blue-400 hover:text-blue-300">Manage →</button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-40 h-40 flex-shrink-0">
              {unitChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={unitChartData}
                      dataKey="value"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {unitChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#cbd5e1" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">No data</div>}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {unitChartData.map((u) => (
                <div key={u.name} className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: u.fill }} />
                  <span className="text-xs text-slate-400 truncate">{u.name}</span>
                  <span className="text-xs font-semibold text-white ml-auto">{u.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Per-project mini-rows */}
          {inventory.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              {inventory.slice(0, 4).map((p) => {
                const sold = p.byStatus["SOLD"] || 0;
                const pct = p.total > 0 ? Math.round((sold / p.total) * 100) : 0;
                return (
                  <div key={p.projectId} className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 truncate w-24">{p.projectName}</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-16 text-right">{sold}/{p.total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead pipeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Lead Pipeline</h2>
            <button onClick={() => navigate("/leads")} className="text-xs text-blue-400 hover:text-blue-300">View leads →</button>
          </div>
          {stageEntries.length > 0 ? (
            <div className="space-y-3">
              {stageEntries.map(([stage, count]) => {
                const pct = totalStageLeads > 0 ? Math.round((count / totalStageLeads) * 100) : 0;
                const color = STAGE_COLORS[stage] || "#94a3b8";
                return (
                  <div key={stage}>
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="text-slate-300 font-medium">{stage.replace(/_/g, " ")}</span>
                      <span className="text-slate-500">
                        <span className="text-white font-semibold">{count}</span> · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-slate-500 text-sm py-8 text-center">No leads yet</p>}
        </div>
      </div>

      {/* ===== Top Agents + Today's Tasks ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top agents leaderboard */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">Top Performers</h2>
            <button onClick={() => navigate("/team")} className="text-xs text-blue-400 hover:text-blue-300">Team →</button>
          </div>
          {agents.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {agents.slice(0, 5).map((a, i) => (
                <div key={a.agentId} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                    ${i === 0 ? "bg-amber-500/20 text-amber-400"
                    : i === 1 ? "bg-slate-500/20 text-slate-300"
                    : i === 2 ? "bg-orange-700/20 text-orange-400"
                    : "bg-slate-800 text-slate-500"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.agentName}</p>
                    <p className="text-xs text-slate-500">
                      {a.totalDeals} deals · {a.closeRate}% close rate
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">AED {fmtAED(a.dealRevenue)}</p>
                    <p className="text-xs text-slate-500">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-500 text-sm py-12 text-center">No agent activity yet</p>}
        </div>

        {/* Tasks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">Open Tasks</h2>
            <button onClick={() => navigate("/tasks")} className="text-xs text-blue-400 hover:text-blue-300">All tasks →</button>
          </div>
          {tasks.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {tasks.slice(0, 5).map((t) => {
                const due  = new Date(t.dueDate);
                const days = Math.floor((due.getTime() - Date.now()) / 86400000);
                const overdue = days < 0;
                const target = t.deal ? `/deals/${t.deal.id}` : t.lead ? `/leads/${t.lead.id}` : "/tasks";
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(target)}
                    className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${t.priority === "URGENT" ? "bg-red-500"
                      : t.priority === "HIGH" ? "bg-orange-500"
                      : t.priority === "MEDIUM" ? "bg-amber-500"
                      : "bg-slate-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 font-medium truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {t.lead ? `${t.lead.firstName} ${t.lead.lastName}` : t.deal ? t.deal.dealNumber : t.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0
                      ${overdue ? "text-red-400" : days <= 1 ? "text-amber-400" : "text-slate-400"}`}>
                      {overdue ? `${Math.abs(days)}d overdue`
                       : days === 0 ? "Today"
                       : days === 1 ? "Tomorrow"
                       : `${days}d`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : <p className="text-slate-500 text-sm py-12 text-center">No pending tasks 🎉</p>}
        </div>
      </div>

      {/* ===== Quick Actions ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "New Lead",     desc: "Capture inquiry",     icon: "◉", to: "/leads" },
            { label: "New Deal",     desc: "Start sales process", icon: "◈", to: "/deals" },
            { label: "Reservations", desc: "Manage bookings",     icon: "⊗", to: "/reservations" },
            { label: "Commissions",  desc: "Approve & pay",       icon: "◇", to: "/commissions" },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-base flex-shrink-0">
                {a.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{a.label}</p>
                <p className="text-xs text-slate-500 truncate">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ===== Footer summary ===== */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Total Leads</p>
            <p className="text-xl font-bold text-white mt-0.5">{fmtNum(overview.totalLeads)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Active Deals</p>
            <p className="text-xl font-bold text-white mt-0.5">{fmtNum(overview.totalDeals)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Sold Rate</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{overview.soldPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">DLD Waived</p>
            <p className="text-xl font-bold text-blue-400 mt-0.5">
              AED {fmtAED(overview.developerIncentives?.dldWaivedTotal ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
