import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Phone,
  Bell,
  Clock,
  CreditCard,
  Mail,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout";
import { formatDirham, formatDirhamCompact } from "@/lib/money";
import { formatRelative } from "../utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// My Day — agent home (UX_AUDIT_2 Part B)
//
// Layout (desktop ≥1024px):
//   ┌──────────────────────────────────────────────────────────────┐
//   │  Strip: pill metrics (calls / follow-ups / stalled / due)    │
//   ├──────────────────────────────────┬───────────────────────────┤
//   │  Action queue (col-span 2)       │  Pipeline pulse           │
//   │  one row per item, virtualizable │  Hot inbox preview        │
//   └──────────────────────────────────┴───────────────────────────┘
//
// Tablet drops the right column below the queue; mobile turns the right column
// into segmented-control tabs (Pipeline / Inbox).
// ─────────────────────────────────────────────────────────────────────────────

type QueueKind = "TASK" | "FOLLOW_UP" | "SILENT_LEAD" | "PAYMENT_DUE";

interface QueueItem {
  kind: QueueKind;
  id: string;
  title: string;
  subtitle: string;
  dueAt: string;
  leadId?: string;
  dealId?: string;
  overdue: boolean;
  overdueDays: number;
}

interface SummaryResponse {
  callsDue: number;
  followUpsOverdue: number;
  dealsStalled: number;
  paymentsDueWeek: number;
  paymentsDueWeekTotal: number;
}

interface StageRollup {
  stage: string;
  count: number;
  totalValue: number;
}

interface TriageItem {
  id: string;
  channel: string;
  fromAddress?: string | null;
  fromName?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: string | null;
  createdAt: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useMyDaySummary() {
  return useQuery<SummaryResponse>({
    queryKey: ["my-day", "summary"],
    queryFn: async () => {
      const res = await axios.get("/api/my-day/summary");
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

function useMyDayQueue(filter: QueueFilter) {
  return useQuery<{ items: QueueItem[] }>({
    queryKey: ["my-day", "queue"],
    queryFn: async () => {
      const res = await axios.get("/api/my-day/queue");
      return res.data;
    },
    staleTime: 60 * 1000,
    select: (data) => ({
      items: data.items.filter((item) => matchesFilter(item, filter)),
    }),
  });
}

function useMyPipelinePulse() {
  return useQuery<StageRollup[]>({
    queryKey: ["my-day", "pipeline"],
    queryFn: async () => {
      const res = await axios.get("/api/reports/deals/by-stage", {
        params: { assignedAgent: "me" },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

function useHotInboxPreview() {
  return useQuery<{ items?: TriageItem[]; rows?: TriageItem[] } | TriageItem[]>({
    queryKey: ["my-day", "inbox"],
    queryFn: async () => {
      const res = await axios.get("/api/triage", {
        params: { status: "UNCLAIMED", limit: 5 },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

function unwrapInbox(
  payload: { items?: TriageItem[]; rows?: TriageItem[] } | TriageItem[] | undefined,
): TriageItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if ("items" in payload && Array.isArray(payload.items)) return payload.items;
  if ("rows" in payload && Array.isArray(payload.rows)) return payload.rows;
  return [];
}

// ─── Filter ──────────────────────────────────────────────────────────────────

type QueueFilter = "ALL" | "TODAY" | "OVERDUE" | "CALL" | "FOLLOW_UP" | "SILENT" | "PAYMENT";

function matchesFilter(item: QueueItem, filter: QueueFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "OVERDUE":
      return item.overdue;
    case "TODAY": {
      const due = new Date(item.dueAt);
      const today = new Date();
      return (
        due.getFullYear() === today.getFullYear() &&
        due.getMonth() === today.getMonth() &&
        due.getDate() === today.getDate()
      );
    }
    case "CALL":
      // Tasks of type CALL show "Call" in subtitle prefix; the backend doesn't
      // pass the underlying TaskType separately. Match on subtitle prefix.
      return item.kind === "TASK" && item.subtitle.startsWith("Call");
    case "FOLLOW_UP":
      return item.kind === "FOLLOW_UP";
    case "SILENT":
      return item.kind === "SILENT_LEAD";
    case "PAYMENT":
      return item.kind === "PAYMENT_DUE";
    default:
      return true;
  }
}

// ─── Icon + label mapping ────────────────────────────────────────────────────

const KIND_ICON: Record<QueueKind, LucideIcon> = {
  TASK: Phone,
  FOLLOW_UP: Bell,
  SILENT_LEAD: Clock,
  PAYMENT_DUE: CreditCard,
};

const KIND_LABEL: Record<QueueKind, string> = {
  TASK: "Task",
  FOLLOW_UP: "Follow-up",
  SILENT_LEAD: "Silent lead",
  PAYMENT_DUE: "Payment due",
};

const KIND_TONE: Record<QueueKind, string> = {
  TASK: "text-chart-1",
  FOLLOW_UP: "text-accent-2",
  SILENT_LEAD: "text-warning",
  PAYMENT_DUE: "text-destructive",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyDayPage() {
  const navigate = useNavigate();
  const summary = useMyDaySummary();
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const queue = useMyDayQueue(filter);
  const pipeline = useMyPipelinePulse();
  const inbox = useHotInboxPreview();

  const items = queue.data?.items ?? [];
  const inboxItems = useMemo(() => unwrapInbox(inbox.data), [inbox.data]);

  const onRowClick = (item: QueueItem) => {
    if (item.leadId) navigate(`/leads/${item.leadId}`);
    else if (item.dealId) navigate(`/deals/${item.dealId}`);
  };

  const refresh = () => {
    summary.refetch();
    queue.refetch();
    pipeline.refetch();
    inbox.refetch();
  };

  return (
    <>
      <PageHeader
        title="My Day"
        subtitle="Your queue for today — tasks, follow-ups, silent leads, and payments due."
        actions={
          <Button variant="ghost" size="sm" onClick={refresh} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      <PageContainer width="wide" padding="default" className="space-y-5">
        <MyDayStrip summary={summary.data} filter={filter} onFilterChange={setFilter} />

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-3" aria-label="Action queue">
            <ActionQueueHeader filter={filter} onFilterChange={setFilter} />
            <ActionQueue
              items={items}
              loading={queue.isLoading}
              onRowClick={onRowClick}
            />
          </section>

          <aside className="space-y-5" aria-label="Side panels">
            <PipelinePulse data={pipeline.data} loading={pipeline.isLoading} />
            <HotInboxPreview items={inboxItems} loading={inbox.isLoading} />
          </aside>
        </div>
      </PageContainer>
    </>
  );
}

// ─── Strip ───────────────────────────────────────────────────────────────────

interface StripProps {
  summary?: SummaryResponse;
  filter: QueueFilter;
  onFilterChange: (next: QueueFilter) => void;
}

function MyDayStrip({ summary, filter, onFilterChange }: StripProps) {
  const calls = summary?.callsDue ?? 0;
  const followUps = summary?.followUpsOverdue ?? 0;
  const stalled = summary?.dealsStalled ?? 0;
  const payDueTotal = summary?.paymentsDueWeekTotal ?? 0;

  return (
    <div
      role="group"
      aria-label="My Day metrics"
      className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-lg border border-border bg-card p-3"
    >
      <StripPill
        label="calls due"
        value={String(calls)}
        active={filter === "CALL"}
        onClick={() => onFilterChange(filter === "CALL" ? "ALL" : "CALL")}
        tone="brand"
      />
      <StripPill
        label="follow-ups overdue"
        value={String(followUps)}
        active={filter === "FOLLOW_UP"}
        onClick={() => onFilterChange(filter === "FOLLOW_UP" ? "ALL" : "FOLLOW_UP")}
        tone="accent"
      />
      <StripPill
        label="deals stalled"
        value={String(stalled)}
        active={filter === "SILENT"}
        onClick={() => onFilterChange(filter === "SILENT" ? "ALL" : "SILENT")}
        tone="warning"
      />
      <StripPill
        label="due this week"
        value={formatDirham(payDueTotal)}
        active={filter === "PAYMENT"}
        onClick={() => onFilterChange(filter === "PAYMENT" ? "ALL" : "PAYMENT")}
        tone="danger"
      />
    </div>
  );
}

interface StripPillProps {
  label: string;
  value: React.ReactNode;
  onClick: () => void;
  active: boolean;
  tone: "brand" | "accent" | "warning" | "danger";
}

const STRIP_TONES: Record<StripPillProps["tone"], string> = {
  brand: "border-chart-1/30 bg-chart-1/5 text-chart-1",
  accent: "border-accent-2/30 bg-accent-2/5 text-accent-2",
  warning: "border-warning/30 bg-warning/5 text-warning",
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
};

function StripPill({ label, value, onClick, active, tone }: StripPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
        STRIP_TONES[tone],
        active ? "ring-2 ring-offset-1 ring-offset-background" : "hover:brightness-95",
      )}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-foreground/80">{label}</span>
    </button>
  );
}

// ─── Action queue ────────────────────────────────────────────────────────────

interface QueueHeaderProps {
  filter: QueueFilter;
  onFilterChange: (next: QueueFilter) => void;
}

function ActionQueueHeader({ filter, onFilterChange }: QueueHeaderProps) {
  const tabs: { key: QueueFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "TODAY", label: "Today" },
    { key: "OVERDUE", label: "Overdue" },
    { key: "SILENT", label: "Silent leads" },
  ];
  return (
    <div className="flex items-center gap-1 text-sm" role="tablist" aria-label="Queue filter">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={filter === t.key}
          onClick={() => onFilterChange(t.key)}
          className={cn(
            "rounded-md px-2.5 py-1.5 transition",
            filter === t.key
              ? "bg-foreground/5 text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface ActionQueueProps {
  items: QueueItem[];
  loading: boolean;
  onRowClick: (item: QueueItem) => void;
}

function ActionQueue({ items, loading, onRowClick }: ActionQueueProps) {
  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading queue"
        className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
      >
        Loading…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing in your queue. Take a breath.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="action-queue">
      {items.map((item) => (
        <ActionQueueRow key={`${item.kind}-${item.id}`} item={item} onClick={() => onRowClick(item)} />
      ))}
    </ul>
  );
}

interface ActionQueueRowProps {
  item: QueueItem;
  onClick: () => void;
}

function ActionQueueRow({ item, onClick }: ActionQueueRowProps) {
  const Icon = KIND_ICON[item.kind];
  const tone = KIND_TONE[item.kind];
  const label = KIND_LABEL[item.kind];

  const staleness = item.overdue
    ? item.overdueDays > 0
      ? `${item.overdueDays}d overdue`
      : "overdue"
    : formatRelative(item.dueAt);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        data-testid="queue-row"
        data-kind={item.kind}
        className={cn(
          "w-full px-4 py-3 text-left transition hover:bg-foreground/5",
          item.overdue && "border-l-2 border-destructive/60",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5",
              tone,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground truncate">{item.title}</span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  item.overdue ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                {staleness}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              <span className="sr-only">{label}: </span>
              {item.subtitle}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

// ─── Pipeline pulse ──────────────────────────────────────────────────────────

interface PulseProps {
  data?: StageRollup[];
  loading: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  VIEWING: "Viewing",
  PROPOSAL: "Proposal",
  NEGOTIATING: "Negotiating",
  RESERVATION_PENDING: "Res. pending",
  RESERVATION_CONFIRMED: "Res. confirmed",
  SPA_PENDING: "SPA pending",
  SPA_SENT: "SPA sent",
  SPA_SIGNED: "SPA signed",
  OQOOD_PENDING: "Oqood pending",
  OQOOD_REGISTERED: "Oqood reg.",
  INSTALLMENTS_ACTIVE: "Installments",
  HANDOVER_PENDING: "Handover",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function PipelinePulse({ data, loading }: PulseProps) {
  const rows = (data ?? []).filter((r) => r.count > 0).slice(0, 8);
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Pipeline pulse">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Pipeline pulse</h2>
        <span className="text-xs text-muted-foreground">your deals</span>
      </header>
      {loading ? (
        <div role="status" aria-busy="true" className="text-sm text-muted-foreground">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active deals.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.stage}
              className="flex items-baseline justify-between text-sm"
              data-testid="pipeline-row"
            >
              <span className="text-foreground">{STAGE_LABEL[r.stage] ?? r.stage}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} · {formatDirhamCompact(r.totalValue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Hot inbox preview ───────────────────────────────────────────────────────

interface InboxProps {
  items: TriageItem[];
  loading: boolean;
}

const CHANNEL_ICON: Record<string, LucideIcon> = {
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
};

function HotInboxPreview({ items, loading }: InboxProps) {
  const navigate = useNavigate();
  const preview = items.slice(0, 5);
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Hot inbox">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Hot inbox</h2>
        <button
          type="button"
          onClick={() => navigate("/inbox")}
          className="text-xs text-primary hover:underline"
        >
          Open inbox →
        </button>
      </header>
      {loading ? (
        <div role="status" aria-busy="true" className="text-sm text-muted-foreground">
          Loading…
        </div>
      ) : preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unmatched messages.</p>
      ) : (
        <ul className="space-y-2">
          {preview.map((it) => {
            const Icon = CHANNEL_ICON[it.channel] ?? Mail;
            const from = it.fromName || it.fromAddress || "Unknown sender";
            const snippet = it.subject || it.bodyPreview || it.body || "";
            return (
              <li key={it.id} data-testid="inbox-row">
                <button
                  type="button"
                  onClick={() => navigate("/inbox")}
                  className="w-full rounded-md p-2 text-left transition hover:bg-foreground/5"
                >
                  <div className="flex items-start gap-2">
                    <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-foreground">{from}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {snippet.slice(0, 80)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatRelative(it.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
