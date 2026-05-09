import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Mail,
  MessageCircle,
  Smartphone,
  Inbox,
  PartyPopper,
  X,
} from "lucide-react";
import { PageHeader, PageContainer } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import ConfirmDialog from "../components/ConfirmDialog";

interface TriageRow {
  id: string;
  channel: string; // EMAIL | WHATSAPP | SMS
  fromAddress: string;
  toAddress?: string | null;
  subject?: string | null;
  body?: string | null;
  mediaUrls?: string[] | null;
  providerMessageId?: string | null;
  status: string; // UNCLAIMED | CLAIMED | RESOLVED | DISCARDED
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

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
};

const STATUS_TINT: Record<string, string> = {
  UNCLAIMED: "bg-warning-soft text-warning-soft-foreground",
  CLAIMED: "bg-info-soft text-primary",
  RESOLVED: "bg-success-soft text-success-soft-foreground",
  DISCARDED: "bg-muted text-muted-foreground",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const Icon = CHANNEL_ICON[channel] ?? Inbox;
  return <Icon className={className ?? "size-5"} aria-hidden="true" />;
}

export default function HotInboxPage() {
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"UNCLAIMED" | "CLAIMED" | "ALL">("UNCLAIMED");

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

  useEffect(() => {
    reload();
  }, [reload]);

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
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "ghost"}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f)}
                  className="text-xs"
                >
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </Button>
              );
            })}
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">
            {loading ? (
              <div className="bg-card rounded-xl border border-border px-5 py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-3">
                <Spinner size="md" />
                <span>Loading…</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border px-5 py-12 text-center">
                <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
                  {filter === "UNCLAIMED" && (
                    <PartyPopper className="size-4" aria-hidden="true" />
                  )}
                  {filter === "UNCLAIMED"
                    ? "Nothing waiting in the inbox."
                    : "No messages match this filter."}
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
  const [discardOpen, setDiscardOpen] = useState(false);
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
    setBusy(true);
    try {
      await axios.patch(`/api/triage/${row.id}/discard`);
      setDiscardOpen(false);
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
        <span className="flex-shrink-0 text-muted-foreground">
          <ChannelIcon channel={row.channel} className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{row.fromAddress}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                STATUS_TINT[row.status] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {row.status}
            </span>
            <span className="text-xs text-muted-foreground">· {timeAgo(row.receivedAt)}</span>
            <span className="text-xs text-muted-foreground">· {row.channel}</span>
          </div>
          {row.subject && (
            <p className="text-sm font-medium text-foreground mt-0.5">{row.subject}</p>
          )}
          <p
            className={`text-sm text-muted-foreground mt-1 ${expanded ? "" : "line-clamp-2"}`}
          >
            {row.body || "(no body)"}
          </p>
          {row.body && row.body.length > 160 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="h-auto p-0 text-xs"
            >
              {expanded ? "Collapse" : "Expand"}
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {row.status === "UNCLAIMED" && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => setMatchOpen(true)}
                disabled={busy}
              >
                Attach to lead…
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={claim}
                disabled={busy}
              >
                Claim
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDiscardOpen(true)}
                disabled={busy}
                className="border-destructive/30 text-destructive hover:bg-destructive-soft hover:text-destructive"
              >
                Discard
              </Button>
            </>
          )}
          {row.status === "CLAIMED" && (
            <Button
              type="button"
              size="sm"
              onClick={() => setMatchOpen(true)}
              disabled={busy}
            >
              Attach to lead…
            </Button>
          )}
          {row.status === "RESOLVED" && row.resolvedActivityId && (
            <span className="text-[11px] text-muted-foreground">
              → Activity {row.resolvedActivityId.slice(0, 8)}…
            </span>
          )}
        </div>
      </div>
      {matchOpen && (
        <AttachToLeadModal
          row={row}
          onClose={() => setMatchOpen(false)}
          onAttached={onAction}
        />
      )}
      <ConfirmDialog
        open={discardOpen}
        title="Discard this message?"
        message="The message will be marked as discarded and won't notify anyone. This cannot be undone."
        confirmLabel={busy ? "Discarding…" : "Discard"}
        cancelLabel="Keep"
        variant="danger"
        onConfirm={discard}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}

// ─── "Attach to lead" modal ─────────────────────────────────────────────────

function AttachToLeadModal({
  row,
  onClose,
  onAttached,
}: {
  row: TriageRow;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [query, setQuery] = useState(row.fromAddress);
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
    const t = setTimeout(() => {
      if (query.trim()) search(query.trim());
    }, 250);
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Inbound from <span className="font-mono text-foreground">{row.fromAddress}</span>.
            Pick the lead this should attach to.
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, email, phone…"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto divide-y divide-border border border-border rounded-lg">
            {searching && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
                <Spinner size="xs" />
                Searching…
              </p>
            )}
            {!searching && results.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</p>
            )}
            {!searching &&
              results.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  disabled={attaching}
                  onClick={() => attach(lead.id)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-sm font-medium text-foreground">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lead.phone}
                    {lead.email ? ` · ${lead.email}` : ""}
                  </p>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
