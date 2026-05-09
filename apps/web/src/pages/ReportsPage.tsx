import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PageContainer, PageHeader } from "../components/layout";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  unitsSold: number; totalUnits: number; soldPercentage: string;
  revenueCollected: number; pipelineValue: number; overduePayments: number;
  totalLeads: number; totalDeals: number;
  meta?: { generatedAt?: string };
}
interface DealStage   { stage: string; count: number; totalValue: number }
interface LeadReport  { byStage: Record<string, number>; bySource: Record<string, number>; conversionRate: string; totalLeads: number; convertedToDeals: number }
interface MonthlyRev  { key: string; label: string; collected: number; expected: number; collectionRate?: number }
interface InventoryProject { projectName: string; total: number; byStatus: Record<string, number>; totalValue: number; availableRate: string }
interface AgentSummary { agentId: string; agentName: string; role: string; totalLeads: number; closedLeads: number; closeRate: string; totalDeals: number; dealRevenue: number; commissionEarned: number }
interface OverduePayment {
  id: string;
  amount: number;
  dueDate: string;
  milestoneLabel: string;
  status: string;
  daysLate: number;
  agingBucket: string;
  deal?: { dealNumber?: string; lead?: { firstName?: string; lastName?: string }; unit?: { unitNumber?: string } };
}
interface Collections {
  overdue: { count: number; total: number; payments: OverduePayment[] };
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

// Chart series colors map to design-system semantic tokens so the report
// re-themes correctly across light/dark mode and any tenant-brand rotation.
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:    "hsl(var(--success))",
  RESERVED:     "hsl(var(--info))",
  BOOKED:       "hsl(var(--chart-7))",
  SOLD:         "hsl(var(--warning))",
  HANDED_OVER:  "hsl(var(--muted-foreground))",
  BLOCKED:      "hsl(var(--destructive))",
  NOT_RELEASED: "hsl(var(--neutral-400))",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAED  = (n: number) => n >= 1_000_000 ? `AED ${(n/1_000_000).toFixed(2)}M` : n >= 1000 ? `AED ${(n/1000).toFixed(0)}K` : `AED ${n.toLocaleString()}`;
const fmtAEDFull = (n: number) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum  = (n: number) => n.toLocaleString();
const pct     = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%";
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

function KPI({ label, value, sub, color = "text-foreground" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mb-3">{children}</h3>;
}

/** RFC4180-compliant CSV: quote any field containing comma/quote/newline; double internal quotes. */
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => escape((r as any)[k])).join(","))].join("\r\n");
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  // Prepend BOM so Excel recognises UTF-8 (e.g. Arabic names)
  const blob = new Blob(["﻿" + toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadXLSX(url: string, filename: string) {
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

const ExportMenu = ({ csvRows, csvName, xlsxUrl, xlsxName }: {
  csvRows: Record<string, unknown>[];
  csvName: string;
  xlsxUrl?: string;
  xlsxName?: string;
}) => (
  <div className="flex gap-1.5 print:hidden">
    <button
      onClick={() => downloadCSV(csvRows, csvName)}
      className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded px-2.5 py-1 transition-colors"
      title="Download as CSV"
    >CSV</button>
    {xlsxUrl && xlsxName && (
      <button
        onClick={() => downloadXLSX(xlsxUrl, xlsxName)}
        className="text-xs text-success hover:text-white hover:bg-success border border-success/30 rounded px-2.5 py-1 transition-colors"
        title="Download styled Excel report"
      >Excel</button>
    )}
  </div>
);

// ─── Tab: Sales Pipeline ──────────────────────────────────────────────────────

function PipelineTab({ overview, dealStages, leads, range }: {
  overview: Overview; dealStages: DealStage[]; leads: LeadReport;
  range: { startDate?: string; endDate?: string };
}) {
  const sorted = STAGE_ORDER.map((s) => {
    const found = dealStages.find((d) => d.stage === s);
    return { stage: STAGE_LABELS[s] || s, count: found?.count ?? 0, value: found?.totalValue ?? 0 };
  }).filter((d) => d.count > 0);

  const leadStages = Object.entries(leads.byStage).map(([stage, count]) => ({ stage: stage.replace(/_/g, " "), count }));
  const leadSources = Object.entries(leads.bySource).map(([source, count]) => ({ source, count }));
  const xlsxQs = new URLSearchParams();
  if (range.startDate) xlsxQs.set("startDate", range.startDate);
  if (range.endDate) xlsxQs.set("endDate", range.endDate);
  const dealsXlsx = `/api/reports/export/deals${xlsxQs.toString() ? "?" + xlsxQs.toString() : ""}`;
  const leadsXlsx = `/api/reports/export/leads${xlsxQs.toString() ? "?" + xlsxQs.toString() : ""}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Deals"      value={fmtNum(overview.totalDeals)}  />
        <KPI label="Pipeline Value"   value={fmtAED(overview.pipelineValue)} color="text-primary" />
        <KPI label="Total Leads"      value={fmtNum(overview.totalLeads)}  />
        <KPI label="Conversion Rate"  value={leads.conversionRate + "%"}   color="text-success"
          sub={`${leads.convertedToDeals} of ${leads.totalLeads} leads`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Deals by Stage</SectionTitle>
            <ExportMenu
              csvRows={sorted.map((s) => ({ stage: s.stage, count: s.count, totalValue: s.value }))}
              csvName="deals-by-stage.csv"
              xlsxUrl={dealsXlsx}
              xlsxName="deals-report.xlsx"
            />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sorted} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v: any) => [v, "Deals"]} />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Lead Pipeline</SectionTitle>
            <ExportMenu
              csvRows={leadStages}
              csvName="lead-pipeline.csv"
              xlsxUrl={leadsXlsx}
              xlsxName="leads-report.xlsx"
            />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={leadStages}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Lead Sources</p>
            <div className="flex flex-wrap gap-2">
              {leadSources.map(({ source, count }) => (
                <span key={source} className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">
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
          { label: "Total Leads",  value: overview.totalLeads,  color: "bg-chart-7" },
          { label: "Active Deals", value: overview.totalDeals,  color: "bg-primary"   },
          {
            label: "Res. Confirmed",
            value: sorted.find((s) => s.stage === STAGE_LABELS["RESERVATION_CONFIRMED"])?.count
              ?? sorted.filter((s) => !["Cancelled", "Res. Pending"].includes(s.stage)).reduce((a, s) => a + s.count, 0),
            color: "bg-chart-4",
          },
          {
            label: "Completed",
            value: sorted.find((s) => s.stage === STAGE_LABELS["COMPLETED"])?.count ?? 0,
            color: "bg-success",
          },
        ];
        const max = funnelStages[0]?.value || 1;
        return (
          <div className="bg-card rounded-xl border border-border p-5">
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
                      <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                      <span className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{stage.value.toLocaleString()}</strong>
                        {pctOfPrev && <span className="ml-2 text-muted-foreground">({pctOfPrev})</span>}
                      </span>
                    </div>
                    <div className="h-6 bg-muted rounded-lg overflow-hidden">
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

function RevenueTab({ overview, monthly, range }: {
  overview: Overview; monthly: MonthlyRev[];
  range: { startDate?: string; endDate?: string };
}) {
  const totalExpected   = monthly.reduce((s, m) => s + m.expected, 0);
  const totalCollected  = overview.revenueCollected;
  const collectionRate  = pct(totalCollected, totalExpected);

  const xlsxQs = new URLSearchParams();
  if (range.startDate) xlsxQs.set("startDate", range.startDate);
  if (range.endDate) xlsxQs.set("endDate", range.endDate);

  const csvRows = monthly.map((m) => ({
    month:    m.label,
    collected: m.collected,
    expected:  m.expected,
    variance:  m.collected - m.expected,
    collectionRatePct: m.expected > 0 ? ((m.collected / m.expected) * 100).toFixed(1) : "0",
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Collected"       value={fmtAED(totalCollected)}           color="text-success" />
        <KPI label="Overdue"         value={fmtAED(overview.overduePayments)} color="text-destructive" />
        <KPI label="Pipeline Value"  value={fmtAED(overview.pipelineValue)}   color="text-primary" />
        <KPI label="Collection Rate" value={collectionRate} sub={`${fmtAED(totalCollected)} of ${fmtAED(totalExpected)}`} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Monthly Revenue — Collected vs. Expected</SectionTitle>
          <ExportMenu
            csvRows={csvRows}
            csvName="monthly-revenue.csv"
            xlsxUrl={`/api/reports/export/revenue${xlsxQs.toString() ? "?" + xlsxQs.toString() : ""}`}
            xlsxName="revenue-report.xlsx"
          />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthly} margin={{ top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip formatter={(v: any) => [`AED ${Number(v).toLocaleString()}`, ""]} />
            <Legend />
            <Bar dataKey="collected" name="Collected" fill="hsl(var(--success))"     radius={[4, 4, 0, 0]} />
            <Bar dataKey="expected"  name="Expected"  fill="hsl(var(--neutral-200))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <SectionTitle>Monthly Breakdown</SectionTitle>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {["Month","Collected","Expected","Variance","Collection %"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {monthly.map((m) => {
              const variance = m.collected - m.expected;
              const ratePct = m.expected > 0 ? (m.collected / m.expected) * 100 : 0;
              return (
                <tr key={m.key} className="hover:bg-muted/80">
                  <td className="px-4 py-3 font-medium text-foreground">{m.label}</td>
                  <td className="px-4 py-3 text-success font-medium">{fmtAEDFull(m.collected)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtAEDFull(m.expected)}</td>
                  <td className={`px-4 py-3 font-medium ${variance >= 0 ? "text-success" : "text-destructive"}`}>
                    {variance >= 0 ? "+" : ""}{fmtAEDFull(variance)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${ratePct >= 90 ? "text-success" : ratePct >= 70 ? "text-warning" : "text-destructive"}`}>
                    {ratePct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 border-border">
            <tr>
              <td className="px-4 py-3 font-bold text-foreground uppercase tracking-wide text-xs">Total</td>
              <td className="px-4 py-3 font-bold text-success">{fmtAEDFull(totalCollected)}</td>
              <td className="px-4 py-3 font-bold text-foreground">{fmtAEDFull(totalExpected)}</td>
              <td className={`px-4 py-3 font-bold ${totalCollected - totalExpected >= 0 ? "text-success" : "text-destructive"}`}>
                {totalCollected - totalExpected >= 0 ? "+" : ""}{fmtAEDFull(totalCollected - totalExpected)}
              </td>
              <td className="px-4 py-3 font-bold text-foreground">{collectionRate}</td>
            </tr>
          </tfoot>
        </table>
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

  const totalLeads   = agents.reduce((s, a) => s + a.totalLeads, 0);
  const totalClosed  = agents.reduce((s, a) => s + a.closedLeads, 0);
  const totalDeals   = agents.reduce((s, a) => s + a.totalDeals, 0);
  const totalRevenue = agents.reduce((s, a) => s + a.dealRevenue, 0);
  const totalComm    = agents.reduce((s, a) => s + a.commissionEarned, 0);
  const avgClose     = totalLeads > 0 ? (totalClosed / totalLeads) * 100 : 0;

  const csvRows = agents.map((a) => ({
    agent: a.agentName, role: a.role, leads: a.totalLeads,
    closedLeads: a.closedLeads, closeRate: a.closeRate + "%",
    deals: a.totalDeals, revenue: a.dealRevenue, commission: a.commissionEarned,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Agents"     value={String(agents.length)} />
        <KPI label="Total Deals"      value={fmtNum(totalDeals)} />
        <KPI label="Commission Paid"  value={fmtAED(totalComm)} color="text-success" />
        <KPI label="Avg Close Rate"   value={avgClose.toFixed(1) + "%"} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Leads vs. Deals vs. Closed — Per Agent</SectionTitle>
          <ExportMenu
            csvRows={csvRows}
            csvName="agent-performance.csv"
            xlsxUrl="/api/reports/export/agents"
            xlsxName="agent-performance.xlsx"
          />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="leads"  name="Leads"  fill="hsl(var(--neutral-400))" radius={[4,4,0,0]} />
            <Bar dataKey="deals"  name="Deals"  fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
            <Bar dataKey="closed" name="Closed" fill="hsl(var(--success))" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {["Agent","Role","Leads","Deals","Closed Leads","Close Rate","Revenue","Commission"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No agent data</td></tr>
            ) : agents.map((a) => (
              <tr key={a.agentId} className="hover:bg-muted/80">
                <td className="px-4 py-3 font-semibold text-foreground">{a.agentName}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{a.role.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{a.totalLeads}</td>
                <td className="px-4 py-3">{a.totalDeals}</td>
                <td className="px-4 py-3">{a.closedLeads}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${parseFloat(a.closeRate) >= 50 ? "text-success" : parseFloat(a.closeRate) >= 25 ? "text-warning" : "text-destructive"}`}>
                    {a.closeRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{fmtAED(a.dealRevenue)}</td>
                <td className="px-4 py-3 text-success font-medium">{fmtAED(a.commissionEarned)}</td>
              </tr>
            ))}
          </tbody>
          {agents.length > 0 && (
            <tfoot className="bg-muted/50 border-t-2 border-border">
              <tr>
                <td className="px-4 py-3 font-bold text-foreground uppercase tracking-wide text-xs">Total</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 font-bold">{fmtNum(totalLeads)}</td>
                <td className="px-4 py-3 font-bold">{fmtNum(totalDeals)}</td>
                <td className="px-4 py-3 font-bold">{fmtNum(totalClosed)}</td>
                <td className="px-4 py-3 font-bold">{avgClose.toFixed(1)}%</td>
                <td className="px-4 py-3 font-bold text-foreground">{fmtAED(totalRevenue)}</td>
                <td className="px-4 py-3 font-bold text-success">{fmtAED(totalComm)}</td>
              </tr>
            </tfoot>
          )}
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
  const totalRes   = inventory.reduce((s, p) => s + (p.byStatus["RESERVED"] || 0), 0);
  const totalBook  = inventory.reduce((s, p) => s + (p.byStatus["BOOKED"] || 0), 0);
  const totalBlock = inventory.reduce((s, p) => s + (p.byStatus["BLOCKED"] || 0), 0);
  const totalValue = inventory.reduce((s, p) => s + p.totalValue, 0);

  const aggStatus: Record<string, number> = {};
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
    reserved:  p.byStatus["RESERVED"]  || 0,
    booked:    p.byStatus["BOOKED"]    || 0,
    sold:      p.byStatus["SOLD"]      || 0,
    blocked:   p.byStatus["BLOCKED"]   || 0,
    availabilityPct: p.availableRate + "%",
    totalValue: p.totalValue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Units"  value={fmtNum(overview.totalUnits)} />
        <KPI label="Available"    value={fmtNum(totalAvail)} color="text-success"
          sub={pct(totalAvail, totalUnits) + " of total"} />
        <KPI label="Sold"         value={fmtNum(totalSold)} color="text-warning"
          sub={overview.soldPercentage + "% sold"} />
        <KPI label="Total Value"  value={fmtAED(totalValue)} color="text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionTitle>Unit Status Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map(({ name }) => (
                  <Cell key={name} fill={STATUS_COLORS[name] || "hsl(var(--neutral-400))"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [v, "Units"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {pieData.map(({ name, value }) => (
              <span key={name} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: STATUS_COLORS[name] || "hsl(var(--neutral-400))" }} />
                {name}: {value}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>Units by Project</SectionTitle>
            <ExportMenu
              csvRows={csvRows}
              csvName="inventory.csv"
              xlsxUrl="/api/reports/export/inventory"
              xlsxName="inventory-report.xlsx"
            />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stackData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {allStatuses.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s] || "hsl(var(--neutral-400))"} name={s} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {["Project","Total","Available","Reserved","Booked","Sold","Blocked","Avail. Rate","Total Value"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inventory.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">No inventory data</td></tr>
            ) : inventory.map((p) => (
              <tr key={p.projectName} className="hover:bg-muted/80">
                <td className="px-4 py-3 font-semibold text-foreground">{p.projectName}</td>
                <td className="px-4 py-3">{p.total}</td>
                <td className="px-4 py-3 text-success font-medium">{p.byStatus["AVAILABLE"] || 0}</td>
                <td className="px-4 py-3 text-primary">{p.byStatus["RESERVED"] || 0}</td>
                <td className="px-4 py-3 text-chart-7">{p.byStatus["BOOKED"] || 0}</td>
                <td className="px-4 py-3 text-warning font-medium">{p.byStatus["SOLD"] || 0}</td>
                <td className="px-4 py-3 text-destructive">{p.byStatus["BLOCKED"] || 0}</td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${parseFloat(p.availableRate) > 50 ? "text-success" : parseFloat(p.availableRate) > 20 ? "text-warning" : "text-destructive"}`}>
                    {p.availableRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{fmtAED(p.totalValue)}</td>
              </tr>
            ))}
          </tbody>
          {inventory.length > 0 && (
            <tfoot className="bg-muted/50 border-t-2 border-border">
              <tr>
                <td className="px-4 py-3 font-bold text-foreground uppercase tracking-wide text-xs">Total</td>
                <td className="px-4 py-3 font-bold">{fmtNum(totalUnits)}</td>
                <td className="px-4 py-3 font-bold text-success">{fmtNum(totalAvail)}</td>
                <td className="px-4 py-3 font-bold text-primary">{fmtNum(totalRes)}</td>
                <td className="px-4 py-3 font-bold text-chart-7">{fmtNum(totalBook)}</td>
                <td className="px-4 py-3 font-bold text-warning">{fmtNum(totalSold)}</td>
                <td className="px-4 py-3 font-bold text-destructive">{fmtNum(totalBlock)}</td>
                <td className="px-4 py-3 font-bold">{pct(totalAvail, totalUnits)}</td>
                <td className="px-4 py-3 font-bold text-foreground">{fmtAED(totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Finance / Collections ───────────────────────────────────────────────

function FinanceTab({ overview, collections }: { overview: Overview; collections: Collections | null }) {
  if (!collections) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const agingColors: Record<string, string> = {
    "0-30":  "bg-warning-soft border-warning/30 text-warning",
    "31-60": "bg-warning-soft border-warning/30 text-warning",
    "61-90": "bg-destructive-soft border-destructive/30 text-destructive",
    "90+":   "bg-destructive-soft border-destructive/30 text-destructive-soft-foreground",
  };
  const bucketBadge: Record<string, string> = {
    "0-30":  "bg-warning-soft text-warning",
    "31-60": "bg-warning-soft text-warning",
    "61-90": "bg-destructive-soft text-destructive",
    "90+":   "bg-destructive/30 text-destructive-soft-foreground",
  };

  const overduePayments  = collections.overdue.payments ?? [];
  const upcomingPayments7 = collections.upcoming.next7Days.payments ?? [];

  const overdueCsv = overduePayments.map((p) => ({
    deal:      p.deal?.dealNumber ?? "",
    buyer:     `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`.trim(),
    unit:      p.deal?.unit?.unitNumber ?? "",
    milestone: p.milestoneLabel,
    dueDate:   new Date(p.dueDate).toISOString().split("T")[0],
    daysLate:  p.daysLate,
    aging:     p.agingBucket,
    amount:    p.amount,
    status:    p.status,
  }));

  const upcomingCsv = upcomingPayments7.map((p: any) => ({
    deal:      p.deal?.dealNumber ?? "",
    buyer:     `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`.trim(),
    unit:      p.deal?.unit?.unitNumber ?? "",
    milestone: p.milestoneLabel,
    dueDate:   new Date(p.dueDate).toISOString().split("T")[0],
    amount:    p.amount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Collected"    value={fmtAED(overview.revenueCollected)} color="text-success" />
        <KPI label="Overdue Amount"     value={fmtAED(overview.overduePayments)}  color="text-destructive"
          sub={`${collections.overdue.count} payment${collections.overdue.count !== 1 ? "s" : ""}`} />
        <KPI label="Due in 7 Days"      value={fmtAED(collections.upcoming.next7Days.total)}  color="text-warning"
          sub={`${collections.upcoming.next7Days.count} payments`} />
        <KPI label="Due in 30 Days"     value={fmtAED(collections.upcoming.next30Days.total)} color="text-primary"
          sub={`${collections.upcoming.next30Days.count} payments`} />
      </div>

      <div>
        <SectionTitle>Overdue Aging Buckets</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {collections.aging.map(({ range, count, amount }) => (
            <div key={range} className={`rounded-xl border p-4 ${agingColors[range] || "bg-muted/50 border-border text-muted-foreground"}`}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1">{range} days</p>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5 opacity-80">{fmtAEDFull(amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue payments table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <SectionTitle>Overdue Payments</SectionTitle>
          <ExportMenu
            csvRows={overdueCsv}
            csvName="overdue-payments.csv"
            xlsxUrl="/api/reports/export/collections"
            xlsxName="collections-report.xlsx"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Deal #","Buyer","Unit","Milestone","Due Date","Days Late","Aging","Amount"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overduePayments.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No overdue payments</td></tr>
              ) : overduePayments.map((p) => (
                <tr key={p.id} className="hover:bg-muted/80">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.deal?.dealNumber}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{p.deal?.lead?.firstName} {p.deal?.lead?.lastName}</td>
                  <td className="px-4 py-3 text-foreground">{p.deal?.unit?.unitNumber}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate" title={p.milestoneLabel}>{p.milestoneLabel}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground">{fmtDate(p.dueDate)}</td>
                  <td className="px-4 py-3 text-destructive font-semibold">{p.daysLate}d</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bucketBadge[p.agingBucket] || "bg-muted text-foreground"}`}>
                      {p.agingBucket}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-destructive">{fmtAEDFull(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            {overduePayments.length > 0 && (
              <tfoot className="bg-muted/50 border-t-2 border-border">
                <tr>
                  <td colSpan={7} className="px-4 py-3 font-bold text-foreground uppercase tracking-wide text-xs">Total Overdue</td>
                  <td className="px-4 py-3 font-bold text-destructive">{fmtAEDFull(collections.overdue.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Upcoming payments table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <SectionTitle>Payments Due in Next 7 Days</SectionTitle>
          <ExportMenu csvRows={upcomingCsv} csvName="upcoming-7days.csv" />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {upcomingPayments7.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">No payments due in the next 7 days</td></tr>
            ) : upcomingPayments7.map((p: any) => (
              <tr key={p.id} className="hover:bg-muted/80">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.deal?.dealNumber}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{p.deal?.lead?.firstName} {p.deal?.lead?.lastName}</td>
                <td className="px-4 py-3 text-foreground">{p.deal?.unit?.unitNumber}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate" title={p.milestoneLabel}>{p.milestoneLabel}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {(() => {
                    const days = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000);
                    return (
                      <>
                        <p className="text-foreground">{fmtDate(p.dueDate)}</p>
                        <p className="text-xs text-warning font-medium">{days <= 0 ? "Today" : `in ${days}d`}</p>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{fmtAEDFull(p.amount)}</td>
              </tr>
            ))}
          </tbody>
          {upcomingPayments7.length > 0 && (
            <tfoot className="bg-muted/50 border-t-2 border-border">
              <tr>
                <td colSpan={5} className="px-4 py-3 font-bold text-foreground uppercase tracking-wide text-xs">Total Upcoming (7d)</td>
                <td className="px-4 py-3 font-bold text-warning">{fmtAEDFull(collections.upcoming.next7Days.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Date range presets ──────────────────────────────────────────────────────

function presetRange(preset: "30d" | "90d" | "ytd" | "12m" | "all"): { startDate: string; endDate: string } {
  const today = new Date();
  const end = today.toISOString().split("T")[0];
  if (preset === "all") return { startDate: "", endDate: "" };
  const start = new Date(today);
  switch (preset) {
    case "30d":  start.setDate(today.getDate() - 30); break;
    case "90d":  start.setDate(today.getDate() - 90); break;
    case "ytd":  start.setMonth(0); start.setDate(1); break;
    case "12m":  start.setMonth(today.getMonth() - 12); break;
  }
  return { startDate: start.toISOString().split("T")[0], endDate: end };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "pipeline" | "revenue" | "agents" | "inventory" | "finance";

const TABS: { id: Tab; label: string }[] = [
  { id: "pipeline",  label: "Sales pipeline"    },
  { id: "revenue",   label: "Revenue"           },
  { id: "agents",    label: "Agent performance" },
  { id: "inventory", label: "Inventory"         },
  { id: "finance",   label: "Finance"           },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [loading, setLoading] = useState(true);

  // Date-range filter (applies to overview + leads + revenue)
  const [range, setRange] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });

  const [overview,     setOverview]     = useState<Overview     | null>(null);
  const [dealStages,   setDealStages]   = useState<DealStage[]>([]);
  const [leads,        setLeads]        = useState<LeadReport   | null>(null);
  const [monthly,      setMonthly]      = useState<MonthlyRev[]>([]);
  const [agents,       setAgents]       = useState<AgentSummary[]>([]);
  const [inventory,    setInventory]    = useState<InventoryProject[]>([]);
  const [collections,  setCollections]  = useState<Collections  | null>(null);
  const [generatedAt,  setGeneratedAt]  = useState<Date | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (range.startDate) p.set("startDate", range.startDate);
    if (range.endDate)   p.set("endDate",   range.endDate);
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

  return (
    <div className="flex flex-col h-full bg-background print:block">
      {/* Print stylesheet — keeps tables/charts paper-friendly */}
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 landscape; }
          .print\\:hidden { display: none !important; }
          body { background: hsl(var(--neutral-0)); }
          .recharts-wrapper, .recharts-surface { page-break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      <div className="print:hidden">
        <PageHeader
          crumbs={[{ label: "Home", path: "/" }, { label: "Reports" }]}
          title="Reports"
          subtitle={
            <>
              {activeRangeLabel}
              {generatedAt && <span className="ml-2 text-foreground/80">·  Generated {generatedAt.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}</span>}
            </>
          }
          actions={<Button variant="outline" onClick={() => window.print()} title="Print or save as PDF">Print / PDF</Button>}
          tabs={
            <div
              className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 scrollbar-thin py-2 items-center"
              role="tablist"
              aria-label="Report section"
            >
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    role="tab"
                    aria-selected={active}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-auto print:overflow-visible">
      <PageContainer padding="default" className="space-y-5 print:p-2 print:space-y-3">
      {/* Date-range filter */}
      <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3 flex-wrap print:hidden">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date range</span>
        <div className="flex gap-1">
          {[
            { id: "30d", label: "30d"  }, { id: "90d", label: "90d" },
            { id: "ytd", label: "YTD"  }, { id: "12m", label: "12m" },
            { id: "all", label: "All"  },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setRange(presetRange(p.id as any))}
              className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted/50"
            >{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={range.startDate}
            onChange={(e) => setRange({ ...range, startDate: e.target.value })}
            className="text-xs px-2 py-1 border border-border rounded-md text-foreground bg-card"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="date"
            value={range.endDate}
            onChange={(e) => setRange({ ...range, endDate: e.target.value })}
            className="text-xs px-2 py-1 border border-border rounded-md text-foreground bg-card"
          />
        </div>
        {(range.startDate || range.endDate) && (
          <button
            onClick={() => setRange({ startDate: "", endDate: "" })}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >Clear</button>
        )}
      </div>

      {/* Section title for printed page only */}
      <div className="hidden print:block">
        <h2 className="text-base font-bold text-foreground">
          {TABS.find((t) => t.id === tab)?.label}
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !overview || !leads ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Failed to load data</div>
      ) : (
        <>
          {tab === "pipeline"  && <PipelineTab  overview={overview} dealStages={dealStages} leads={leads} range={range} />}
          {tab === "revenue"   && <RevenueTab   overview={overview} monthly={monthly} range={range} />}
          {tab === "agents"    && <AgentsTab    agents={agents} />}
          {tab === "inventory" && <InventoryTab overview={overview} inventory={inventory} />}
          {tab === "finance"   && <FinanceTab   overview={overview} collections={collections} />}
        </>
      )}
      </PageContainer>
      </div>
    </div>
  );
}
