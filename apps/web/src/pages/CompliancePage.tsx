import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Sparkles, Search, Filter } from "lucide-react";
import { PageHeader, PageContainer } from "../components/layout";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Severity = "EXPIRED" | "CRITICAL" | "WARNING" | "ATTENTION" | "OK";
type Category = "ALL" | "BROKER" | "AGENT" | "BUYER";

interface ExpiryRow {
  kind: string;
  category: "BROKER" | "AGENT" | "BUYER";
  severity: Severity;
  daysToExpiry: number;
  expiresAt: string;
  ownerId: string;
  ownerType: string;
  ownerName: string;
  ownerSubLabel?: string;
  documentNumber?: string | null;
  documentId?: string;
  brokerCompanyId?: string;
}

// Severity tokens — keep `row` + `pill` for the grouped sections below, and
// add `chip` + `dot` so the PageHeader chips use the same Leads pill+dot
// pattern as every other list page.
const SEVERITY_TINT: Record<Severity, {
  row: string; pill: string; label: string;
  chip: string; dot: string; valueClass: string;
}> = {
  EXPIRED:   {
    row: "border-destructive/30 bg-destructive-soft/40",
    pill: "bg-destructive text-white",
    label: "Expired",
    chip: "bg-stage-danger text-stage-danger-foreground",
    dot: "bg-destructive",
    valueClass: "text-destructive",
  },
  CRITICAL:  {
    row: "border-warning/30 bg-warning-soft/40",
    pill: "bg-warning text-white",
    label: "≤ 14 days",
    chip: "bg-stage-attention text-stage-attention-foreground",
    dot: "bg-warning",
    valueClass: "text-warning",
  },
  WARNING:   {
    row: "border-warning/30 bg-warning-soft/40",
    pill: "bg-warning text-white",
    label: "≤ 30 days",
    chip: "bg-stage-attention text-stage-attention-foreground",
    dot: "bg-warning",
    valueClass: "text-warning",
  },
  ATTENTION: {
    row: "border-warning/30 bg-warning-soft/30",
    pill: "bg-warning/50 text-warning-soft-foreground",
    label: "≤ 90 days",
    chip: "bg-stage-info text-stage-info-foreground",
    dot: "bg-info",
    valueClass: "text-foreground",
  },
  OK:        {
    row: "border-border bg-card",
    pill: "bg-neutral-200 text-muted-foreground",
    label: "OK",
    chip: "bg-stage-success text-stage-success-foreground",
    dot: "bg-success",
    valueClass: "text-foreground",
  },
};

const SEVERITY_ORDER: Severity[] = ["EXPIRED", "CRITICAL", "WARNING", "ATTENTION"];

const KIND_LABEL: Record<string, string> = {
  BROKER_RERA_LICENSE:  "Broker RERA License",
  BROKER_TRADE_LICENSE: "Trade License",
  BROKER_VAT_CERT:      "VAT Certificate",
  AGENT_RERA_CARD:      "Agent RERA Card",
  AGENT_EID:            "Agent Emirates ID",
  BUYER_EID:            "Buyer Emirates ID",
  BUYER_PASSPORT:       "Buyer Passport",
  BUYER_VISA:           "Buyer Visa",
};

const CATEGORY_LABEL: Record<Category, string> = {
  ALL:    "All categories",
  BROKER: "Broker companies",
  AGENT:  "Broker agents",
  BUYER:  "Buyers",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLabel(days: number): string {
  if (days < 0)  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

function ownerHref(row: ExpiryRow): string | null {
  if (row.ownerType === "BROKER_COMPANY") return `/brokers`;
  if (row.ownerType === "BROKER_AGENT")   return `/brokers`;
  if (row.ownerType === "LEAD")           return `/leads/${row.ownerId}`;
  return null;
}

export default function CompliancePage() {
  const [rows, setRows]                 = useState<ExpiryRow[]>([]);
  const [counts, setCounts]             = useState<Record<Severity, number> | null>(null);
  const [loading, setLoading]           = useState(true);

  // Filters — severity now lives in PageHeader.tabs (the primary filter),
  // category + horizon move into the inline Filters dropdown, search joins
  // the compact filter zone next to it. Same layout shape as Leads / Deals.
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null);
  const [category, setCategory]             = useState<Category>("ALL");
  const [horizon, setHorizon]               = useState<30 | 60 | 90 | 365>(90);
  const [search, setSearch]                 = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("withinDays", String(horizon));
      params.set("minSeverity", "ATTENTION");
      if (category !== "ALL") params.set("category", category);
      const [list, summary] = await Promise.all([
        axios.get(`/api/compliance/expiring?${params.toString()}`),
        axios.get("/api/compliance/expiring/counts"),
      ]);
      setRows(list.data?.data ?? []);
      setCounts(summary.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [category, horizon]);

  useEffect(() => { reload(); }, [reload]);

  // ── Client-side filter (severity chip + search) ─────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (severityFilter && r.severity !== severityFilter) return false;
      if (q) {
        const hay = `${r.ownerName} ${r.ownerSubLabel ?? ""} ${KIND_LABEL[r.kind] ?? r.kind}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, severityFilter, search]);

  const grouped = useMemo(() => {
    const out: Record<Severity, ExpiryRow[]> = { EXPIRED: [], CRITICAL: [], WARNING: [], ATTENTION: [], OK: [] };
    for (const r of visible) out[r.severity].push(r);
    return out;
  }, [visible]);

  // ── Filter chips ────────────────────────────────────────────────────────
  const anyAdvancedFilter = category !== "ALL" || horizon !== 90;

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search) chips.push({ key: "search", label: "Search", value: search, onRemove: () => setSearch("") });
    if (category !== "ALL") {
      const catLabel: string = CATEGORY_LABEL[category as Category];
      chips.push({ key: "category", label: "Category", value: catLabel, onRemove: () => setCategory("ALL") });
    }
    if (horizon !== 90) {
      chips.push({
        key: "horizon",
        label: "Horizon",
        value: horizon === 365 ? "1 year" : `${horizon} days`,
        onRemove: () => setHorizon(90),
      });
    }
    return chips;
  }, [search, category, horizon]);

  const resetFilters = () => {
    setSearch("");
    setCategory("ALL");
    setHorizon(90);
    setSeverityFilter(null);
  };

  // ── Severity chip strip (PageHeader.tabs) ───────────────────────────────
  const severityTabs = (
    <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Filter credentials by severity">
      {SEVERITY_ORDER.map((s) => {
        const active = severityFilter === s;
        const cfg = SEVERITY_TINT[s];
        return (
          <button
            key={s}
            onClick={() => setSeverityFilter(active ? null : s)}
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
              active ? `${cfg.chip} border-current shadow-sm` : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
            {cfg.label}
            <span className={`ml-0.5 text-[10px] tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
              {counts?.[s] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );

  // ── Compact filter zone ─────────────────────────────────────────────────
  const filterZone = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search owner, document type…"
          aria-label="Search compliance rows"
          className="w-full h-9 pl-8 pr-3 text-sm border border-input rounded-lg bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium border rounded-lg ${
              anyAdvancedFilter ? "border-primary/40 bg-info-soft text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="size-3.5" />
            Filters
            {anyAdvancedFilter && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {[category !== "ALL", horizon !== 90].filter(Boolean).length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-3 space-y-3">
          <DropdownMenuLabel className="px-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Filters
          </DropdownMenuLabel>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card"
            >
              {(["ALL", "BROKER", "AGENT", "BUYER"] as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Horizon</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value) as 30 | 60 | 90 | 365)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card"
            >
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
              <option value={365}>Next year</option>
            </select>
          </div>
          {anyAdvancedFilter && (
            <button
              onClick={() => { setCategory("ALL"); setHorizon(90); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground border border-border rounded-md py-1.5"
            >
              Clear filters
            </button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── KPI strip ───────────────────────────────────────────────────────────
  const kpiStrip = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Expired</div>
        <div className="text-lg font-bold text-destructive tabular-nums">{counts?.EXPIRED ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground">need action now</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Critical (≤ 14 d)</div>
        <div className="text-lg font-bold text-warning tabular-nums">{counts?.CRITICAL ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground">block OQOOD soon</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Warning (≤ 30 d)</div>
        <div className="text-lg font-bold text-warning tabular-nums">{counts?.WARNING ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground">renew this month</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total expiring</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{rows.length}</div>
        <div className="text-[11px] text-muted-foreground">within horizon</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Compliance" }]}
        title="Compliance"
        subtitle={`${rows.length} expiring credentials`}
        actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
        tabs={severityTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {kpiStrip}
        {filterZone}
        {activeChips.length > 0 && (
          <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
        )}
      </PageContainer>

      <div className="flex-1 overflow-auto">
        <PageContainer padding="default" className="space-y-5">
          {loading ? (
            <div className="bg-card rounded-xl border border-border px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="bg-card rounded-xl border border-border px-5 py-10 text-center">
              <p className="text-success text-sm font-medium inline-flex items-center gap-1.5">
                <Sparkles className="size-4" />
                {rows.length === 0
                  ? <>Nothing expiring within {horizon === 365 ? "a year" : `${horizon} days`}.</>
                  : <>No credentials match the current filters.</>}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {SEVERITY_ORDER.map((sev) =>
                grouped[sev].length > 0 ? (
                  <section key={sev}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${SEVERITY_TINT[sev].pill}`}>
                        {sev}
                      </span>
                      <span className="text-xs text-muted-foreground">{SEVERITY_TINT[sev].label}</span>
                      <span className="text-xs text-muted-foreground">· {grouped[sev].length}</span>
                    </div>
                    <div className="space-y-2">
                      {grouped[sev].map((row, i) => (
                        <ExpiryRowCard key={`${row.kind}-${row.ownerId}-${i}`} row={row} />
                      ))}
                    </div>
                  </section>
                ) : null,
              )}
            </div>
          )}
        </PageContainer>
      </div>
    </div>
  );
}

function ExpiryRowCard({ row }: { row: ExpiryRow }) {
  const tint = SEVERITY_TINT[row.severity];
  const link = ownerHref(row);

  return (
    <div className={`rounded-xl border ${tint.row} px-4 py-3 flex items-start gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{row.ownerName}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${tint.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tint.dot}`} aria-hidden="true" />
            {row.severity}
          </span>
          {row.ownerSubLabel && (
            <span className="text-xs text-muted-foreground">· {row.ownerSubLabel}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {KIND_LABEL[row.kind] ?? row.kind} expires <span className="font-medium text-foreground">{fmtDate(row.expiresAt)}</span> ({daysLabel(row.daysToExpiry)})
        </p>
      </div>
      {link && (
        <Link
          to={link}
          className="text-xs text-primary hover:underline flex-shrink-0 mt-0.5"
        >
          Open →
        </Link>
      )}
    </div>
  );
}
