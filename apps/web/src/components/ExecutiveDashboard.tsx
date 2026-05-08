import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton, SkeletonKpi } from "./Skeleton";
import { IconRefresh } from "./Icons";

function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Overview {
  unitsSold: number; totalUnits: number; soldPercentage: number | string;
  revenueCollected: number; pipelineValue: number; overduePayments: number;
  totalLeads: number; totalDeals: number;
}
interface LeadsReport {
  byStage: Record<string, number>; bySource: Record<string, number>;
  conversionRate: number | string; totalLeads: number; convertedToDeals: number;
}
interface UnitStatus { [key: string]: number; }
const fmtM = (n: number) => `${(n / 1_000_000).toFixed(2)}M`;
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

const STAGE_COLORS: Record<string, string> = {
  NEW: "#64748b", CONTACTED: "#3b82f6", OFFER_SENT: "#8b5cf6",
  SITE_VISIT: "#06b6d4", NEGOTIATING: "#f59e0b", CLOSED_WON: "#10b981", CLOSED_LOST: "#ef4444",
};
const BAR_COLORS = ["#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];

export default function ExecutiveDashboard(): React.ReactNode {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [unitStatus, setUnitStatus] = useState<UnitStatus>({});
  const [leadsReport, setLeadsReport] = useState<LeadsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
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
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading && !overview) return (
    <div className="p-6 space-y-6" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonKpi key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 w-full" rounded="xl" />
        <Skeleton className="h-64 w-full" rounded="xl" />
      </div>
    </div>
  );
  if (error) return (
    <div className="p-6 flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-red-500 font-medium">{error}</p>
      <button onClick={fetchDashboardData} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Retry</button>
    </div>
  );
  if (!overview || !leadsReport) return null;

  const unitChartData = Object.entries(unitStatus).map(([status, count], i) => ({
    name: status.replace(/_/g, " "), value: count, fill: BAR_COLORS[i % BAR_COLORS.length],
  }));

  const stageEntries = Object.entries(leadsReport.byStage);
  const totalStageLeads = stageEntries.reduce((s, [, v]) => s + v, 0);

  const kpis = [
    { label: "Revenue Collected", value: fmtM(overview.revenueCollected), sub: "AED",              color: "bg-blue-600",   icon: "↑", to: "/payments" },
    { label: "Pipeline Value",     value: fmtM(overview.pipelineValue),    sub: "AED in pipeline",  color: "bg-indigo-600", icon: "◈", to: "/deals" },
    { label: "Units Sold",         value: `${overview.unitsSold}/${overview.totalUnits}`, sub: `${overview.soldPercentage}% sold`, color: "bg-emerald-600", icon: "⊞", to: "/units" },
    { label: "Overdue Payments",   value: fmtK(overview.overduePayments),  sub: "AED overdue",      color: "bg-red-500",    icon: "!", to: "/payments" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Command Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time sales pipeline overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-slate-400"
            title={lastFetched ? lastFetched.toLocaleString() : ""}
            aria-live="polite"
          >
            Updated {timeAgo(lastFetched)}
          </span>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Refresh dashboard"
          >
            <IconRefresh size={12} aria-hidden="true" className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className={`${k.color} rounded-xl p-4 text-white block hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all`}
            aria-label={`${k.label}: ${k.value}. View ${k.to.replace("/", "")}.`}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium opacity-80">{k.label}</p>
              <span className="text-lg opacity-60 leading-none" aria-hidden="true">{k.icon}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{k.value}</p>
            <p className="text-xs opacity-70 mt-0.5">{k.sub}</p>
          </Link>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Leads",      value: overview.totalLeads,   color: "text-blue-600",    to: "/leads" },
          { label: "Active Deals",     value: overview.totalDeals,   color: "text-emerald-600", to: "/deals" },
          { label: "Conversion Rate",  value: `${leadsReport.conversionRate}%`, color: "text-purple-600", to: "/reports" },
        ].map((m) => (
          <Link
            key={m.label}
            to={m.to}
            className="bg-white rounded-xl border border-slate-200 p-4 block hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
          >
            <p className="text-slate-500 text-xs mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Units by status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Units by Status</h2>
          {unitChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={unitChartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {unitChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm">No data</p>}
        </div>

        {/* Leads by stage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Lead Pipeline</h2>
          <div className="space-y-2.5">
            {stageEntries.map(([stage, count]) => {
              const pct = totalStageLeads > 0 ? Math.round((count / totalStageLeads) * 100) : 0;
              const color = STAGE_COLORS[stage] || "#94a3b8";
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{stage.replace(/_/g, " ")}</span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-900 rounded-xl p-5 text-white">
        <h2 className="text-sm font-semibold mb-3 text-slate-300">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-400 text-xs">Sold Rate</p><p className="font-bold text-lg">{overview.soldPercentage}%</p></div>
          <div><p className="text-slate-400 text-xs">Collected</p><p className="font-bold text-lg">AED {fmtM(overview.revenueCollected)}</p></div>
          <div><p className="text-slate-400 text-xs">Leads → Deals</p><p className="font-bold text-lg">{leadsReport.conversionRate}%</p></div>
          <div><p className="text-slate-400 text-xs">Overdue</p><p className="font-bold text-lg text-red-400">AED {fmtK(overview.overduePayments)}</p></div>
        </div>
      </div>
    </div>
  );
}
