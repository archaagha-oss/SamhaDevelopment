import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  UserPlus, Handshake, BookmarkPlus, FileText, CreditCard,
  CircleDollarSign, ClipboardCheck, LayoutGrid,
} from "lucide-react";
import { PageContainer, PageHeader } from "./layout";
import { Button } from "@/components/ui/button";
import OnboardingChecklist from "./OnboardingChecklist";

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
interface ProjectOption { id: string; name: string; }

// ===== Time period filter =====
type PeriodKey = "1M" | "3M" | "6M" | "12M" | "YTD" | "ALL";
const PERIOD_OPTIONS: { key: PeriodKey; label: string; months: number }[] = [
  { key: "1M",  label: "Last 30d", months: 1  },
  { key: "3M",  label: "Last 3mo", months: 3  },
  { key: "6M",  label: "Last 6mo", months: 6  },
  { key: "12M", label: "Last 12mo", months: 12 },
  { key: "YTD", label: "Year to date", months: 0 },
  { key: "ALL", label: "All time",  months: 0 },
];

function periodToRange(p: PeriodKey): { from?: Date; months: number } {
  const now = new Date();
  switch (p) {
    case "1M":  return { from: new Date(now.getTime() - 30  * 86400000), months: 1  };
    case "3M":  return { from: new Date(now.getTime() - 90  * 86400000), months: 3  };
    case "6M":  return { from: new Date(now.getTime() - 180 * 86400000), months: 6  };
    case "12M": return { from: new Date(now.getTime() - 365 * 86400000), months: 12 };
    case "YTD": return { from: new Date(now.getFullYear(), 0, 1),        months: now.getMonth() + 1 };
    case "ALL": return { months: 24 };
  }
}

// ===== Formatters =====
const fmtAED = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
  : `${Math.round(n)}`;

const fmtNum = (n: number) => n.toLocaleString();

// ===== Token-driven chart colors =====
// All series colors come from CSS vars so they follow the brand and dark mode.
const cssVar = (name: string) => `hsl(var(${name}))`;

const STAGE_COLOR_VAR: Record<string, string> = {
  NEW:           "--neutral-400",
  CONTACTED:     "--chart-1",       // primary brand
  QUALIFIED:     "--brand2-500",    // secondary brand
  VIEWING:       "--chart-5",
  PROPOSAL:      "--brand2-500",    // secondary brand
  NEGOTIATING:   "--chart-3",
  CLOSED_WON:    "--success",
  CLOSED_LOST:   "--chart-6",
};

const UNIT_COLOR_VAR: Record<string, string> = {
  AVAILABLE:    "--success",
  INTERESTED:   "--chart-5",
  RESERVED:     "--brand2-500",     // secondary brand
  BOOKED:       "--chart-1",        // primary brand
  SOLD:         "--success",
  BLOCKED:      "--chart-6",
  HANDED_OVER:  "--chart-5",
};

// KPI tile decorative tones — distinct accents that stay brand-coordinated.
// `active` is wired to the secondary brand so it appears on every dashboard.
const KPI_TONES = {
  success: { from: "from-success/15",     to: "to-success/5",     accent: "text-success" },
  brand:   { from: "from-chart-1/15",     to: "to-chart-1/5",     accent: "text-chart-1" },
  active:  { from: "from-accent-2/15",    to: "to-accent-2/5",    accent: "text-accent-2" },
  info:    { from: "from-chart-5/15",     to: "to-chart-5/5",     accent: "text-chart-5" },
  danger:  { from: "from-destructive/15", to: "to-destructive/5", accent: "text-destructive" },
} as const;

// Quick Action tile tones. `secondary` follows the brand-2 axis.
const QUICK_ACTION_TONE = {
  brand:     "bg-chart-1/15 text-chart-1",
  secondary: "bg-accent-2-soft text-accent-2-soft-foreground",
  amber:     "bg-chart-3/15 text-chart-3",
  emerald:   "bg-success-soft text-success",
  cyan:      "bg-chart-5/15 text-chart-5",
  pink:      "bg-chart-7/15 text-chart-7",
  orange:    "bg-chart-8/15 text-chart-8",
  neutral:   "bg-muted text-muted-foreground",
} as const;

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

  // Filters
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodKey>("12M");

  useEffect(() => {
    axios.get("/api/projects")
      .then((res) => {
        const list: ProjectOption[] = (res.data || []).map((p: any) => ({ id: p.id, name: p.name }));
        setProjects(list);
      })
      .catch(() => setProjects([]));
  }, []);

  const fetchAll = useCallback((silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);

    const { from, months } = periodToRange(period);
    const baseParams: Record<string, string> = {};
    if (projectId !== "all") baseParams.projectId = projectId;
    if (from) baseParams.from = from.toISOString();

    Promise.all([
      axios.get("/api/reports/overview",         { params: baseParams }),
      axios.get("/api/reports/units-by-status",  { params: { projectId: baseParams.projectId } }),
      axios.get("/api/reports/leads",            { params: baseParams }),
      axios.get("/api/reports/revenue/monthly",  { params: { projectId: baseParams.projectId, months } }),
      axios.get("/api/reports/collections",      { params: { projectId: baseParams.projectId } }),
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

  useEffect(() => { fetchAll(overview !== null); /* eslint-disable-next-line */ }, [projectId, period]);

  const activeProjectName = projectId === "all"
    ? "All projects"
    : projects.find((p) => p.id === projectId)?.name || "All projects";
  const activePeriodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label || "Last 12mo";

  const unitChartData = useMemo(
    () => Object.entries(unitStatus).map(([status, count]) => ({
      name: status.replace(/_/g, " "),
      value: count,
      fill: cssVar(UNIT_COLOR_VAR[status] || "--neutral-400"),
    })),
    [unitStatus],
  );

  const stageEntries = useMemo(
    () => leadsReport ? Object.entries(leadsReport.byStage) : [],
    [leadsReport],
  );
  const totalStageLeads = stageEntries.reduce((s, [, v]) => s + v, 0);

  const overdueAlertsCount = collections?.overdue.count ?? 0;
  const oqoodDueSoon = useMemo(() => {
    const inOneWeek = Date.now() + 7 * 86400000;
    return tasks.filter((t) =>
      (t.type || "").toUpperCase().includes("OQOOD") ||
      (t.priority === "URGENT" || t.priority === "HIGH") ||
      (new Date(t.dueDate).getTime() < inOneWeek),
    ).slice(0, 5);
  }, [tasks]);

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="p-6 flex flex-col items-center justify-center h-full gap-3 bg-background">
      <p className="text-destructive font-medium">{error}</p>
      <button
        onClick={() => fetchAll()}
        className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  );
  if (!overview || !leadsReport || !collections) return null;

  // ===== KPIs (top strip) =====
  const kpis = [
    {
      label: "Revenue collected",
      value: `AED ${fmtAED(overview.revenueCollected)}`,
      sub: period === "ALL" ? "All time" : activePeriodLabel,
      tone: KPI_TONES.success, icon: "↑",
    },
    {
      label: "Pipeline value",
      value: `AED ${fmtAED(overview.pipelineValue)}`,
      sub: `${overview.totalDeals} active deals`,
      tone: KPI_TONES.brand, icon: "◈",
    },
    {
      label: "Units sold",
      value: `${overview.unitsSold} / ${overview.totalUnits}`,
      sub: `${overview.soldPercentage}% sold`,
      tone: KPI_TONES.active, icon: "⊞",
    },
    {
      label: "Conversion rate",
      value: `${leadsReport.conversionRate}%`,
      sub: `${leadsReport.convertedToDeals} of ${leadsReport.totalLeads} leads`,
      tone: KPI_TONES.info, icon: "↗",
    },
    {
      label: "Overdue payments",
      value: `AED ${fmtAED(overview.overduePayments)}`,
      sub: `${overdueAlertsCount} payment${overdueAlertsCount === 1 ? "" : "s"}`,
      tone: KPI_TONES.danger, icon: "!",
      onClick: () => navigate("/payments"),
    },
  ];

  const actionItemsCount =
    overdueAlertsCount +
    (collections.upcoming.next7Days.count) +
    oqoodDueSoon.length;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            <span className="text-foreground/80">{activeProjectName}</span>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            <span className="text-foreground/80">{activePeriodLabel}</span>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            {new Date().toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </>
        }
        actions={
          <>
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg pl-3 pr-1 py-1">
              <span className="text-xs text-muted-foreground">Project</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-card text-foreground text-xs font-medium px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-ring max-w-[160px]"
                aria-label="Filter by project"
              >
                <option value="all">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    period === p.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={p.label}
                >
                  {p.key}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              title="Refresh"
              aria-label="Refresh dashboard"
            >
              <span className={refreshing ? "animate-spin inline-block" : "inline-block"} aria-hidden="true">↻</span>
            </Button>
            <Button onClick={() => navigate("/reports")}>View reports</Button>
          </>
        }
      />

      <PageContainer padding="default" className="space-y-5">
      {/* ===== Onboarding checklist (renders nothing once done / dismissed) ===== */}
      <OnboardingChecklist />

      {/* ===== KPI Strip ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={k.onClick}
            disabled={!k.onClick}
            className={`text-left bg-gradient-to-br ${k.tone.from} ${k.tone.to} bg-card border border-border rounded-xl p-4 ${k.onClick ? "hover:border-foreground/20 cursor-pointer" : "cursor-default"} transition-colors`}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <span className={`text-base ${k.tone.accent} leading-none`}>{k.icon}</span>
            </div>
            <p className="text-xl font-semibold text-foreground tracking-tight tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* ===== Action Items / Alerts ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-warning">⚠</span>
            <h2 className="text-sm font-semibold text-foreground">Action items</h2>
            {actionItemsCount > 0 && (
              <span className="px-2 py-0.5 bg-warning-soft text-warning-soft-foreground text-xs font-bold rounded-full">
                {actionItemsCount}
              </span>
            )}
          </div>
          <button onClick={() => navigate("/tasks")} className="text-xs text-primary hover:text-primary/80 transition-colors">View all →</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Overdue */}
          <button
            onClick={() => navigate("/payments")}
            className="text-left p-5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overdue Payments</p>
            </div>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{collections.overdue.count}</p>
            <p className="text-xs text-destructive mt-1 tabular-nums">AED {fmtAED(collections.overdue.total)} past due</p>
          </button>

          {/* Upcoming 7 days */}
          <button
            onClick={() => navigate("/payments")}
            className="text-left p-5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due in 7 Days</p>
            </div>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{collections.upcoming.next7Days.count}</p>
            <p className="text-xs text-warning mt-1 tabular-nums">AED {fmtAED(collections.upcoming.next7Days.total)} expected</p>
          </button>

          {/* Pending Tasks */}
          <button
            onClick={() => navigate("/tasks")}
            className="text-left p-5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-info" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Tasks</p>
            </div>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{tasks.length}</p>
            <p className="text-xs text-info mt-1">{oqoodDueSoon.length} urgent / due soon</p>
          </button>
        </div>
      </div>

      {/* ===== Revenue Trend ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Revenue trend</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Collected vs expected · {activePeriodLabel.toLowerCase()} · {activeProjectName}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-success" />
              <span className="text-muted-foreground">Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-chart-1/60" />
              <span className="text-muted-foreground">Expected</span>
            </div>
          </div>
        </div>
        {monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={cssVar("--success")} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={cssVar("--success")} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={cssVar("--chart-1")} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={cssVar("--chart-1")} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVar("--border")} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar("--muted-foreground") }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: cssVar("--muted-foreground") }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtAED(v)}
              />
              <Tooltip
                contentStyle={{
                  background: cssVar("--popover"),
                  border: `1px solid ${cssVar("--border")}`,
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  color: cssVar("--popover-foreground"),
                }}
                labelStyle={{ color: cssVar("--foreground") }}
                formatter={(v) => `AED ${fmtAED(Number(v) || 0)}`}
              />
              <Area type="monotone" dataKey="expected"  stroke={cssVar("--chart-1")} strokeWidth={2} fill="url(#colExpected)"  />
              <Area type="monotone" dataKey="collected" stroke={cssVar("--success")} strokeWidth={2} fill="url(#colCollected)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="text-muted-foreground text-sm py-8 text-center">No revenue data yet</p>}
      </div>

      {/* ===== Inventory + Lead Pipeline ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory donut */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Unit inventory</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{activeProjectName}</p>
            </div>
            <button onClick={() => navigate("/units")} className="text-xs text-primary hover:text-primary/80 transition-colors">Manage →</button>
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
                      contentStyle={{
                        background: cssVar("--popover"),
                        border: `1px solid ${cssVar("--border")}`,
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                        color: cssVar("--popover-foreground"),
                      }}
                      labelStyle={{ color: cssVar("--foreground") }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {unitChartData.map((u) => (
                <div key={u.name} className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: u.fill }} />
                  <span className="text-xs text-muted-foreground truncate">{u.name}</span>
                  <span className="text-xs font-semibold text-foreground ml-auto tabular-nums">{u.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Per-project mini-rows */}
          {projectId === "all" && inventory.length > 1 && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sold rate by project</p>
              {inventory.slice(0, 4).map((p) => {
                const sold = p.byStatus["SOLD"] || 0;
                const pct = p.total > 0 ? Math.round((sold / p.total) * 100) : 0;
                return (
                  <button
                    key={p.projectId}
                    onClick={() => setProjectId(p.projectId)}
                    className="w-full flex items-center gap-3 hover:bg-muted/40 rounded -mx-2 px-2 py-1 transition-colors"
                  >
                    <span className="text-xs text-foreground/80 truncate w-24 text-left">{p.projectName}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">{sold}/{p.total}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead pipeline */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Lead pipeline</h2>
            <button onClick={() => navigate("/leads")} className="text-xs text-primary hover:text-primary/80 transition-colors">View leads →</button>
          </div>
          {stageEntries.length > 0 ? (
            <div className="space-y-3">
              {stageEntries.map(([stage, count]) => {
                const pct = totalStageLeads > 0 ? Math.round((count / totalStageLeads) * 100) : 0;
                const color = cssVar(STAGE_COLOR_VAR[stage] || "--neutral-400");
                return (
                  <div key={stage}>
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="text-foreground/80 font-medium">{stage.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground tabular-nums">
                        <span className="text-foreground font-semibold">{count}</span> · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-muted-foreground text-sm py-8 text-center">No leads yet</p>}
        </div>
      </div>

      {/* ===== Top Agents + Today's Tasks ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top agents leaderboard */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Top performers</h2>
            <button onClick={() => navigate("/team")} className="text-xs text-primary hover:text-primary/80 transition-colors">Team →</button>
          </div>
          {agents.length > 0 ? (
            <div className="divide-y divide-border">
              {agents.slice(0, 5).map((a, i) => {
                const rankTone =
                  i === 0 ? "bg-warning-soft text-warning-soft-foreground"
                  : i === 1 ? "bg-muted text-foreground/80"
                  : i === 2 ? "bg-stage-attention text-stage-attention-foreground"
                  : "bg-muted text-muted-foreground";
                return (
                  <div key={a.agentId} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${rankTone}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.agentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.totalDeals} deals · {a.closeRate}% close rate
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-success tabular-nums">AED {fmtAED(a.dealRevenue)}</p>
                      <p className="text-xs text-muted-foreground">revenue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-muted-foreground text-sm py-12 text-center">No agent activity yet</p>}
        </div>

        {/* Tasks */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Open tasks</h2>
            <button onClick={() => navigate("/tasks")} className="text-xs text-primary hover:text-primary/80 transition-colors">All tasks →</button>
          </div>
          {tasks.length > 0 ? (
            <div className="divide-y divide-border">
              {tasks.slice(0, 5).map((t) => {
                const due  = new Date(t.dueDate);
                const days = Math.floor((due.getTime() - Date.now()) / 86400000);
                const overdue = days < 0;
                const target = t.deal ? `/deals/${t.deal.id}` : t.lead ? `/leads/${t.lead.id}` : "/tasks";
                const priorityDot =
                  t.priority === "URGENT" ? "bg-destructive"
                  : t.priority === "HIGH" ? "bg-warning"
                  : t.priority === "MEDIUM" ? "bg-info"
                  : "bg-neutral-400";
                const dueTone =
                  overdue ? "text-destructive"
                  : days <= 1 ? "text-warning"
                  : "text-muted-foreground";
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(target)}
                    className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.lead ? `${t.lead.firstName} ${t.lead.lastName}` : t.deal ? t.deal.dealNumber : t.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0 ${dueTone}`}>
                      {overdue ? `${Math.abs(days)}d overdue`
                       : days === 0 ? "Today"
                       : days === 1 ? "Tomorrow"
                       : `${days}d`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : <p className="text-muted-foreground text-sm py-12 text-center">No pending tasks</p>}
        </div>
      </div>

      {/* ===== Quick Actions ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
          <p className="text-xs text-muted-foreground">Jump straight into common flows</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: "Create lead",  desc: "Capture inquiry",     Icon: UserPlus,         to: "/leads",        tone: QUICK_ACTION_TONE.brand },
            { label: "Create deal",  desc: "Start sales process", Icon: Handshake,        to: "/deals",        tone: QUICK_ACTION_TONE.emerald },
            { label: "Reservation",  desc: "Hold a unit",         Icon: BookmarkPlus,     to: "/reservations", tone: QUICK_ACTION_TONE.secondary },
            { label: "Send Offer",   desc: "Generate offer PDF",  Icon: FileText,         to: "/offers-list",  tone: QUICK_ACTION_TONE.cyan },
            { label: "Record Pay.",  desc: "Log a payment",       Icon: CreditCard,       to: "/payments",     tone: QUICK_ACTION_TONE.amber },
            { label: "Commissions",  desc: "Approve & pay",       Icon: CircleDollarSign, to: "/commissions",  tone: QUICK_ACTION_TONE.pink },
            { label: "Add Activity", desc: "Log a touchpoint",    Icon: ClipboardCheck,   to: "/tasks",        tone: QUICK_ACTION_TONE.secondary },
            { label: "Browse Units", desc: "Inventory grid",      Icon: LayoutGrid,       to: "/units",        tone: QUICK_ACTION_TONE.neutral },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => navigate(a.to)}
              className="flex items-center gap-3 px-3 py-3 bg-muted/60 hover:bg-muted border border-border hover:border-foreground/20 rounded-lg transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.tone}`}>
                <a.Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{a.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ===== Footer summary ===== */}
      <div className="bg-gradient-to-r from-muted/60 to-muted/30 border border-border rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Leads</p>
            <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">{fmtNum(overview.totalLeads)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Deals</p>
            <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">{fmtNum(overview.totalDeals)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sold Rate</p>
            <p className="text-xl font-semibold text-success mt-0.5 tabular-nums">{overview.soldPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">DLD Waived</p>
            <p className="text-xl font-semibold text-primary mt-0.5 tabular-nums">
              AED {fmtAED(overview.developerIncentives?.dldWaivedTotal ?? 0)}
            </p>
          </div>
        </div>
      </div>
      </PageContainer>
    </div>
  );
}
