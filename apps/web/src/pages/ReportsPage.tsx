import { useState, useEffect } from "react";
import axios from "axios";
import { PageHeader } from "../components/ui/PageHeader";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  unitsSold: number; totalUnits: number; soldPercentage: string;
  revenueCollected: number; pipelineValue: number; overduePayments: number;
  totalLeads: number; totalDeals: number;
}
interface DealStage   { stage: string; count: number; totalValue: number }
interface LeadReport  { byStage: Record<string, number>; bySource: Record<string, number>; conversionRate: string; totalLeads: number; convertedToDeals: number }
interface MonthlyRev  { key: string; label: string; collected: number; expected: number }
interface InventoryProject { projectName: string; total: number; byStatus: Record<string, number>; totalValue: number; availableRate: string }
interface AgentSummary { agentId: string; agentName: string; role: string; totalLeads: number; closedLeads: number; closeRate: string; totalDeals: number; dealRevenue: number; commissionEarned: number; tasksCompleted: number }
interface Collections {
  overdue: { count: number; total: number };
  aging: Array<{ range: string; count: number; amount: number }>;
  upcoming: {
    next7Days:  { count: number; total: number; payments: any[] };
    next30Days: { count: number; total: number; payments: any[] };
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGE_ORDER = ["RESERVATION_PENDING","RESERVATION_CONFIRMED","SPA_PENDING","SPA_SENT","SPA_SIGNED","OQOOD_PENDING","OQOOD_REGISTERED","INSTALLMENTS_ACTIVE","HANDOVER_PENDING","COMPLETED","CANCELLED"];
const STAGE_LABELS: Record<string, string> = {
  RESERVATION_PENDING: "Res. Pending", RESERVATION_CONFIRMED: "Res. Confirmed",
  SPA_PENDING: "SPA Pending", SPA_SENT: "SPA Sent", SPA_SIGNED: "SPA Signed",
  OQOOD_PENDING: "Oqood Pending", OQOOD_REGISTERED: "Oqood Reg.",
  INSTALLMENTS_ACTIVE: "Installments", HANDOVER_PENDING: "Handover Pending",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981", RESERVED: "#3b82f6", BOOKED: "#a855f7",
  SOLD: "#f59e0b", HANDED_OVER: "#6b7280", BLOCKED: "#ef4444", NOT_RELEASED: "#94a3b8",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAED  = (n: number) => n >= 1_000_000 ? `AED ${(n/1_000_000).toFixed(2)}M` : n >= 1000 ? `AED ${(n/1000).toFixed(0)}K` : `AED ${n.toLocaleString()}`;
const fmtNum  = (n: number) => n.toLocaleString();
const pct     = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%";

function KPI({ label, value, sub, color = "text-slate-800" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-700 mb-3">{children}</h3>;
}

function exportCSV(rows: object[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv  = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify((r as any)[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── Tab: Sales Pipeline ──────────────────────────────────────────────────────

function PipelineTab({ overview, dealStages, leads }: { overview: Overview; dealStages: DealStage[]; leads: LeadReport }) {
  const sorted = STAGE_ORDER.map((s) => {
    const found = dealStages.find((d) => d.stage === s);
    return { stage: STAGE_LABELS[s] || s, count: found?.count ?? 0, value: found?.totalValue ?? 0 };
  }).filter((d) => d.count > 0);

  const leadStages = Object.entries(leads.byStage).map(([stage, count]) => ({ stage: stage.replace(/_/g, " "), count }));
  const leadSources = Object.entries(leads.bySource).map(([source, count]) => ({ source, count }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Deals"      value={fmtNum(overview.totalDeals)}  />
        <KPI label="Pipeline Value"   value={fmtAED(overview.pipelineValue)} color="text-blue-700" />
        <KPI label="Total Leads"      value={fmtNum(overview.totalLeads)}  />
        <KPI label="Conversion Rate"  value={leads.conversionRate + "%"}   color="text-emerald-700"
          sub={`${leads.convertedToDeals} of ${leads.totalLeads} leads`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Deals by stage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Deals by Stage</SectionTitle>
            <button onClick={() => exportCSV(sorted, "deals-by-stage.csv")} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1">Export</button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sorted} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v: any) => [v, "Deals"]} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Lead Pipeline</SectionTitle>
            <button onClick={() => exportCSV(leadStages, "lead-pipeline.csv")} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1">Export</button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={leadStages}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Lead Sources</p>
            <div className="flex flex-wrap gap-2">
              {leadSources.map(({ source, count }) => (
                <span key={source} className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600">
                  {source}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conversion funnel */}
      {(() => {
        const funnelStages = [
          { label: "Total Leads",  value: overview.totalLeads,  color: "bg-purple-500" },
          { label: "Active Deals", value: overview.totalDeals,  color: "bg-blue-500"   },
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
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <SectionTitle>Conversion Funnel</SectionTitle>
            <div className="space-y-3 mt-2">
              {funnelStages.map((stage, i) => {
                const pctOfFirst = max > 0 ? (stage.value / max) * 100 : 0;
                const pctOfPrev  = i > 0 && funnelStages[i - 1].value > 0
                  ? ((stage.value / funnelStages[i - 1].value) * 100).toFixed(0) + "% of prev"
                  : "";
                return (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{stage.label}</span>
                      <span className="text-xs text-slate-500">
                        <strong className="text-slate-800">{stage.value.toLocaleString()}</strong>
                        {pctOfPrev && <span className="ml-2 text-slate-400">({pctOfPrev})</span>}
                      </span>
                    </div>
                    <div className="h-6 bg-slate-100 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${stage.color} rounded-lg transition-all`}
                        style={{ width: `${Math.max(pctOfFirst, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Tab: Revenue ─────────────────────────────────────────────────────────────

function RevenueTab({ overview, monthly }: { overview: Overview; monthly: MonthlyRev[] }) {
  const totalExpected   = monthly.reduce((s, m) => s + m.expected, 0);
  const totalCollected  = overview.revenueCollected;
  const collectionRate  = pct(totalCollected, totalExpected);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Collected"       value={fmtAED(totalCollected)}           color="text-emerald-700" />
        <KPI label="Overdue"         value={fmtAED(overview.overduePayments)} color="text-red-700" />
        <KPI label="Pipeline Value"  value={fmtAED(overview.pipelineValue)}   color="text-blue-700" />
        <KPI label="Collection Rate" value={collectionRate} sub={`${fmtAED(totalCollected)} of ${fmtAED(totalExpected)}`} />
      </div>

      {/* Monthly revenue chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Monthly Revenue — Last 12 Months</SectionTitle>
          <button onClick={() => exportCSV(monthly, "monthly-revenue.csv")} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1">Export</button>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthly} margin={{ top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip formatter={(v: any) => [`AED ${Number(v).toLocaleString()}`, ""]} />
            <Legend />
            <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expected"  name="Expected"  fill="#e2e8f0" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Tab: Agent Performance ───────────────────────────────────────────────────

function AgentsTab({ agents }: { agents: AgentSummary[] }) {
  const chartData = agents.map((a) => ({
    name:    a.agentName.split(" ")[0],
    leads:   a.totalLeads,
    deals:   a.totalDeals,
    closed:  a.closedLeads,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Agents"     value={String(agents.length)} />
        <KPI label="Total Deals"      value={fmtNum(agents.reduce((s, a) => s + a.totalDeals, 0))} />
        <KPI label="Commission Paid"  value={fmtAED(agents.reduce((s, a) => s + a.commissionEarned, 0))} color="text-emerald-700" />
        <KPI label="Avg Close Rate"   value={agents.length ? (agents.reduce((s, a) => s + parseFloat(a.closeRate), 0) / agents.length).toFixed(1) + "%" : "0%"} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Leads vs. Deals vs. Closed — Per Agent</SectionTitle>
          <button onClick={() => exportCSV(agents, "agent-performance.csv")} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1">Export</button>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="leads"  name="Leads"  fill="#94a3b8" radius={[4,4,0,0]} />
            <Bar dataKey="deals"  name="Deals"  fill="#3b82f6" radius={[4,4,0,0]} />
            <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {["Agent","Role","Leads","Deals","Closed Leads","Close Rate","Revenue","Commission"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {agents.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No agent data</td></tr>
            ) : agents.map((a) => (
              <tr key={a.agentId} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-semibold text-slate-800">{a.agentName}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{a.role.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{a.totalLeads}</td>
                <td className="px-4 py-3">{a.totalDeals}</td>
                <td className="px-4 py-3">{a.closedLeads}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${parseFloat(a.closeRate) >= 50 ? "text-emerald-600" : parseFloat(a.closeRate) >= 25 ? "text-amber-600" : "text-red-500"}`}>
                    {a.closeRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{fmtAED(a.dealRevenue)}</td>
                <td className="px-4 py-3 text-emerald-700 font-medium">{fmtAED(a.commissionEarned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Inventory ───────────────────────────────────────────────────────────

function InventoryTab({ overview, inventory }: { overview: Overview; inventory: InventoryProject[] }) {
  const totalUnits = inventory.reduce((s, p) => s + p.total, 0);
  const totalAvail = inventory.reduce((s, p) => s + (p.byStatus["AVAILABLE"] || 0), 0);
  const totalSold  = inventory.reduce((s, p) => s + (p.byStatus["SOLD"] || 0), 0);
  const totalValue = inventory.reduce((s, p) => s + p.totalValue, 0);

  // Aggregate all statuses across projects for pie chart
  const aggStatus: Record<string, number> = {};
  inventory.forEach((p) => {
    Object.entries(p.byStatus).forEach(([s, c]) => { aggStatus[s] = (aggStatus[s] || 0) + c; });
  });
  const pieData = Object.entries(aggStatus).map(([name, value]) => ({ name, value }));

  // Stacked bar per project
  const allStatuses = Array.from(new Set(inventory.flatMap((p) => Object.keys(p.byStatus))));
  const stackData = inventory.map((p) => ({ name: p.projectName.slice(0, 15), ...p.byStatus }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Units"  value={fmtNum(overview.totalUnits)} />
        <KPI label="Available"    value={fmtNum(totalAvail)} color="text-emerald-700"
          sub={pct(totalAvail, totalUnits) + " of total"} />
        <KPI label="Sold"         value={fmtNum(totalSold)} color="text-amber-700"
          sub={overview.soldPercentage + "% sold"} />
        <KPI label="Total Value"  value={fmtAED(totalValue)} color="text-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie chart — status distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Unit Status Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map(({ name }) => (
                  <Cell key={name} fill={STATUS_COLORS[name] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [v, "Units"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {pieData.map(({ name, value }) => (
              <span key={name} className="flex items-center gap-1 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: STATUS_COLORS[name] || "#94a3b8" }} />
                {name}: {value}
              </span>
            ))}
          </div>
        </div>

        {/* Stacked bar per project */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>Units by Project</SectionTitle>
            <button onClick={() => exportCSV(inventory, "inventory.csv")} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1">Export</button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stackData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {allStatuses.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s] || "#94a3b8"} name={s} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project summary table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {["Project","Total","Available","Reserved","Booked","Sold","Blocked","Avail. Rate","Total Value"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {inventory.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">No inventory data</td></tr>
            ) : inventory.map((p) => (
              <tr key={p.projectName} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-semibold text-slate-800">{p.projectName}</td>
                <td className="px-4 py-3">{p.total}</td>
                <td className="px-4 py-3 text-emerald-600 font-medium">{p.byStatus["AVAILABLE"] || 0}</td>
                <td className="px-4 py-3 text-blue-600">{p.byStatus["RESERVED"] || 0}</td>
                <td className="px-4 py-3 text-purple-600">{p.byStatus["BOOKED"] || 0}</td>
                <td className="px-4 py-3 text-amber-600 font-medium">{p.byStatus["SOLD"] || 0}</td>
                <td className="px-4 py-3 text-red-500">{p.byStatus["BLOCKED"] || 0}</td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${parseFloat(p.availableRate) > 50 ? "text-emerald-600" : parseFloat(p.availableRate) > 20 ? "text-amber-600" : "text-red-500"}`}>
                    {p.availableRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{fmtAED(p.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Finance / Collections ───────────────────────────────────────────────

function FinanceTab({ overview, collections }: { overview: Overview; collections: Collections | null }) {
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

  if (!collections) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const agingColors: Record<string, string> = {
    "0-30":  "bg-amber-50 border-amber-200 text-amber-700",
    "31-60": "bg-orange-50 border-orange-200 text-orange-700",
    "61-90": "bg-red-50 border-red-200 text-red-700",
    "90+":   "bg-red-100 border-red-300 text-red-800",
  };

  // The collections API returns overdue count/total but not payment rows; we'll show upcoming for the table
  const upcomingPayments7 = collections.upcoming.next7Days.payments ?? [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Collected"    value={fmtAED(overview.revenueCollected)} color="text-emerald-700" />
        <KPI label="Overdue Amount"     value={fmtAED(overview.overduePayments)}  color="text-red-700"
          sub={`${collections.overdue.count} payment${collections.overdue.count !== 1 ? "s" : ""}`} />
        <KPI label="Due in 7 Days"      value={fmtAED(collections.upcoming.next7Days.total)}  color="text-amber-700"
          sub={`${collections.upcoming.next7Days.count} payments`} />
        <KPI label="Due in 30 Days"     value={fmtAED(collections.upcoming.next30Days.total)} color="text-blue-700"
          sub={`${collections.upcoming.next30Days.count} payments`} />
      </div>

      {/* Aging buckets */}
      <div>
        <SectionTitle>Overdue Aging Buckets</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          {collections.aging.map(({ range, count, amount }) => (
            <div key={range} className={`rounded-xl border p-4 ${agingColors[range] || "bg-slate-50 border-slate-200 text-slate-600"}`}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1">{range} days</p>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5 opacity-80">AED {amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming payments */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <SectionTitle>Payments Due in Next 7 Days</SectionTitle>
          <button
            onClick={() => exportCSV(upcomingPayments7.map((p: any) => ({
              deal:      p.deal?.dealNumber ?? "",
              buyer:     `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`,
              unit:      p.deal?.unit?.unitNumber ?? "",
              milestone: p.milestoneLabel,
              dueDate:   new Date(p.dueDate).toLocaleDateString("en-AE"),
              amount:    p.amount,
            })), "upcoming-7days.csv")}
            className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-2 py-1"
          >Export</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {upcomingPayments7.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No payments due in the next 7 days</td></tr>
            ) : upcomingPayments7.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.deal?.dealNumber}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{p.deal?.lead?.firstName} {p.deal?.lead?.lastName}</td>
                <td className="px-4 py-3 text-slate-700">{p.deal?.unit?.unitNumber}</td>
                <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px] truncate" title={p.milestoneLabel}>{p.milestoneLabel}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {(() => {
                    const days = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000);
                    return (
                      <>
                        <p className="text-slate-700">{fmtDate(p.dueDate)}</p>
                        <p className="text-xs text-amber-600 font-medium">{days <= 0 ? "Today" : `in ${days}d`}</p>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">AED {p.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "pipeline" | "revenue" | "agents" | "inventory" | "finance";

const TABS: { id: Tab; label: string }[] = [
  { id: "pipeline",  label: "Sales Pipeline"    },
  { id: "revenue",   label: "Revenue"           },
  { id: "agents",    label: "Agent Performance" },
  { id: "inventory", label: "Inventory"         },
  { id: "finance",   label: "Finance"           },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [loading, setLoading] = useState(true);

  const [overview,     setOverview]     = useState<Overview     | null>(null);
  const [dealStages,   setDealStages]   = useState<DealStage[]>([]);
  const [leads,        setLeads]        = useState<LeadReport   | null>(null);
  const [monthly,      setMonthly]      = useState<MonthlyRev[]>([]);
  const [agents,       setAgents]       = useState<AgentSummary[]>([]);
  const [inventory,    setInventory]    = useState<InventoryProject[]>([]);
  const [collections,  setCollections]  = useState<Collections  | null>(null);

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

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Live data across pipeline, revenue, agents, and inventory"
      />
      <div className="p-6 space-y-5">

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !overview || !leads ? (
        <div className="text-center py-16 text-slate-400 text-sm">Failed to load data</div>
      ) : (
        <>
          {tab === "pipeline"  && <PipelineTab  overview={overview} dealStages={dealStages} leads={leads} />}
          {tab === "revenue"   && <RevenueTab   overview={overview} monthly={monthly} />}
          {tab === "agents"    && <AgentsTab    agents={agents} />}
          {tab === "inventory" && <InventoryTab overview={overview} inventory={inventory} />}
          {tab === "finance"   && <FinanceTab   overview={overview} collections={collections} />}
        </>
      )}
      </div>
    </>
  );
}
