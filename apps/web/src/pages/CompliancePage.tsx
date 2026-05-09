import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

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

const SEVERITY_TINT: Record<Severity, { row: string; pill: string; label: string }> = {
  EXPIRED:   { row: "border-destructive/30    bg-destructive-soft/40",    pill: "bg-destructive text-white",       label: "Expired" },
  CRITICAL:  { row: "border-warning/30 bg-warning-soft/40", pill: "bg-warning text-white",    label: "≤ 14 days" },
  WARNING:   { row: "border-warning/30  bg-warning-soft/40",  pill: "bg-warning text-white",     label: "≤ 30 days" },
  ATTENTION: { row: "border-warning/30 bg-warning-soft/30", pill: "bg-warning/50 text-warning-soft-foreground", label: "≤ 90 days" },
  OK:        { row: "border-border  bg-card",        pill: "bg-neutral-200 text-muted-foreground", label: "OK" },
};

const KIND_LABEL: Record<string, string> = {
  BROKER_RERA_LICENSE:  "Broker RERA License",
  BROKER_TRADE_LICENSE: "Trade License",
  BROKER_VAT_CERT:      "VAT Certificate",
  AGENT_RERA_CARD:      "Agent RERA Card",
  AGENT_EID:            "Agent Emirates ID",
  BUYER_EID:            "Buyer Emirates ID",
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
  if (row.ownerType === "BROKER_COMPANY")           return `/brokers`;
  if (row.ownerType === "BROKER_AGENT")             return `/brokers`;
  if (row.ownerType === "LEAD")                     return `/leads/${row.ownerId}`;
  return null;
}

export default function CompliancePage() {
  const [rows, setRows]         = useState<ExpiryRow[]>([]);
  const [counts, setCounts]     = useState<Record<Severity, number> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Category>("ALL");
  const [horizon, setHorizon]   = useState<30 | 60 | 90 | 365>(90);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("withinDays", String(horizon));
      params.set("minSeverity", horizon <= 90 ? "ATTENTION" : "ATTENTION");
      if (tab !== "ALL") params.set("category", tab);
      const [list, summary] = await Promise.all([
        axios.get(`/api/compliance/expiring?${params.toString()}`),
        axios.get("/api/compliance/expiring/counts"),
      ]);
      setRows(list.data?.data ?? []);
      setCounts(summary.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [tab, horizon]);

  useEffect(() => { reload(); }, [reload]);

  const grouped = useMemo(() => {
    const out: Record<Severity, ExpiryRow[]> = { EXPIRED: [], CRITICAL: [], WARNING: [], ATTENTION: [], OK: [] };
    for (const r of rows) out[r.severity].push(r);
    return out;
  }, [rows]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Compliance Radar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every UAE credential expiring within the horizon, sorted by urgency. Stop OQOOD rejections before they happen.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {([30, 60, 90, 365] as const).map((d) => (
            <button
              key={d}
              onClick={() => setHorizon(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                horizon === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === 365 ? "1 year" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Severity summary cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {(["EXPIRED", "CRITICAL", "WARNING", "ATTENTION", "OK"] as Severity[]).map((sev) => (
          <div key={sev} className={`rounded-xl border ${SEVERITY_TINT[sev].row} px-4 py-3`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {SEVERITY_TINT[sev].label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {counts?.[sev] ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {(["ALL", "BROKER", "AGENT", "BUYER"] as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === c ? "border-primary/40 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {c === "ALL" ? "All" : c === "BROKER" ? "Broker companies" : c === "AGENT" ? "Broker agents" : "Buyers"}
          </button>
        ))}
      </div>

      {/* Rows grouped by severity */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-xl border border-border px-5 py-10 text-center">
          <p className="text-success text-sm font-medium">🎉 Nothing expiring within {horizon === 365 ? "a year" : `${horizon} days`}.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(["EXPIRED", "CRITICAL", "WARNING", "ATTENTION"] as Severity[]).map((sev) =>
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
            ) : null
          )}
        </div>
      )}
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
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${tint.pill}`}>
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
