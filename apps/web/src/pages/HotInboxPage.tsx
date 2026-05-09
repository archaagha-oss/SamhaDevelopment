import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { PageHeader, PageContainer } from "../components/layout";

interface TriageRow {
  id: string;
  channel: string;          // EMAIL | WHATSAPP | SMS
  fromAddress: string;
  toAddress?: string | null;
  subject?: string | null;
  body?: string | null;
  mediaUrls?: string[] | null;
  providerMessageId?: string | null;
  status: string;           // UNCLAIMED | CLAIMED | RESOLVED | DISCARDED
  claimedById?: string | null;
  claimedAt?: string | null;
  resolvedActivityId?: string | null;
  receivedAt: string;
  createdAt: string;
}

interface LeadHit {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

const CHANNEL_ICON: Record<string, string> = { EMAIL: "✉️", WHATSAPP: "💬", SMS: "📱" };
const STATUS_TINT: Record<string, string> = {
  UNCLAIMED: "bg-warning-soft text-warning-soft-foreground",
  CLAIMED:   "bg-info-soft text-primary",
  RESOLVED:  "bg-success-soft text-success-soft-foreground",
  DISCARDED: "bg-muted text-muted-foreground",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HotInboxPage() {
  const [rows, setRows]       = useState<TriageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"UNCLAIMED" | "CLAIMED" | "ALL">("UNCLAIMED");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`/api/triage`, { params: { status: filter } });
      setRows(r.data.data ?? []);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Hot inbox" }]}
        title="Hot inbox"
        subtitle="Inbound messages we couldn't auto-attach. Match each to a lead so it lands on their conversation."
        tabs={
          <div
            className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 scrollbar-thin py-2 items-center"
            role="tablist"
            aria-label="Inbox filter"
          >
            {(["UNCLAIMED", "CLAIMED", "ALL"] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  role="tab"
                  aria-selected={active}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">

      {loading ? (
        <div className="bg-card rounded-xl border border-border px-5 py-12 text-center text-muted-foreground text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-xl border border-border px-5 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {filter === "UNCLAIMED" ? "🎉 Nothing waiting in the inbox." : "No messages match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <TriageCard key={row.id} row={row} onAction={reload} />
          ))}
        </div>
      )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}

// ─── Single triage row card ──────────────────────────────────────────────────

function TriageCard({ row, onAction }: { row: TriageRow; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    setBusy(true);
    try {
      await axios.patch(`/api/triage/${row.id}/claim`);
      onAction();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!confirm("Discard this message? (won't notify anyone)")) return;
    setBusy(true);
    try {
      await axios.patch(`/api/triage/${row.id}/discard`);
      onAction();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Discard failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{CHANNEL_ICON[row.channel] ?? "📨"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{row.fromAddress}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_TINT[row.status] ?? "bg-muted text-muted-foreground"}`}>
              {row.status}
            </span>
            <span className="text-xs text-muted-foreground">· {timeAgo(row.receivedAt)}</span>
            <span className="text-xs text-muted-foreground">· {row.channel}</span>
          </div>
          {row.subject && <p className="text-sm font-medium text-foreground mt-0.5">{row.subject}</p>}
          <p className={`text-sm text-muted-foreground mt-1 ${expanded ? "" : "line-clamp-2"}`}>{row.body || "(no body)"}</p>
          {row.body && row.body.length > 160 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {row.status === "UNCLAIMED" && (
            <>
              <button
                onClick={() => setMatchOpen(true)}
                disabled={busy}
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Attach to lead…
              </button>
              <button
                onClick={claim}
                disabled={busy}
                className="px-3 py-1.5 bg-card text-muted-foreground text-xs font-medium border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50"
              >
                Claim
              </button>
              <button
                onClick={discard}
                disabled={busy}
                className="px-3 py-1.5 bg-card text-destructive text-xs font-medium border border-destructive/30 rounded-lg hover:bg-destructive-soft disabled:opacity-50"
              >
                Discard
              </button>
            </>
          )}
          {row.status === "CLAIMED" && (
            <button
              onClick={() => setMatchOpen(true)}
              disabled={busy}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Attach to lead…
            </button>
          )}
          {row.status === "RESOLVED" && row.resolvedActivityId && (
            <span className="text-[11px] text-muted-foreground">→ Activity {row.resolvedActivityId.slice(0, 8)}…</span>
          )}
        </div>
      </div>
      {matchOpen && <AttachToLeadModal row={row} onClose={() => setMatchOpen(false)} onAttached={onAction} />}
    </div>
  );
}

// ─── "Attach to lead" modal ─────────────────────────────────────────────────

function AttachToLeadModal({ row, onClose, onAttached }: { row: TriageRow; onClose: () => void; onAttached: () => void }) {
  const [query, setQuery]     = useState(row.fromAddress);
  const [results, setResults] = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const r = await axios.get(`/api/leads`, { params: { search: q, limit: 8 } });
      setResults(r.data.data ?? r.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (query.trim()) search(query.trim()); }, 250);
    return () => clearTimeout(t);
  }, [query, search]);

  const attach = async (leadId: string) => {
    setAttaching(true);
    try {
      await axios.patch(`/api/triage/${row.id}/attach`, { leadId });
      toast.success("Attached. The reply now lives on the lead's conversation.");
      onAttached();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Attach failed");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Attach to lead</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Inbound from <span className="font-mono text-foreground">{row.fromAddress}</span>. Pick the lead this should attach to.
          </p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, email, phone…"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto divide-y divide-border border border-border rounded-lg">
            {searching && <p className="px-3 py-4 text-xs text-muted-foreground text-center">Searching…</p>}
            {!searching && results.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</p>}
            {!searching && results.map((lead) => (
              <button
                key={lead.id}
                disabled={attaching}
                onClick={() => attach(lead.id)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 disabled:opacity-50"
              >
                <p className="text-sm font-medium text-foreground">{lead.firstName} {lead.lastName}</p>
                <p className="text-xs text-muted-foreground">
                  {lead.phone}{lead.email ? ` · ${lead.email}` : ""}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
