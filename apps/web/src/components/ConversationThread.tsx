import { useState, useMemo } from "react";
import {
  Mail,
  MessageCircle,
  Smartphone,
  Phone,
  Handshake,
  Building2,
  FileText,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ConversationActivity {
  id: string;
  type: string;          // EMAIL | WHATSAPP | SMS | CALL | MEETING | NOTE | STAGE_CHANGE | SITE_VISIT
  direction?: string | null;        // INBOUND | OUTBOUND | null (system events)
  deliveryStatus?: string | null;   // queued | sent | delivered | read | failed | received
  providerMessageSid?: string | null;
  summary: string;
  outcome?: string | null;
  activityDate?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

interface Props {
  activities: ConversationActivity[];
  emptyMessage?: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL:    "Email",
  WHATSAPP: "WhatsApp",
  SMS:      "SMS",
};

const CHANNEL_ICON: Record<string, LucideIcon> = {
  EMAIL:        Mail,
  WHATSAPP:     MessageCircle,
  SMS:          Smartphone,
  CALL:         Phone,
  MEETING:      Handshake,
  SITE_VISIT:   Building2,
  NOTE:         FileText,
  STAGE_CHANGE: RefreshCw,
};

const CHANNEL_TINT_OUT: Record<string, string> = {
  EMAIL:    "bg-info-soft border-primary/40 text-info-soft-foreground",
  WHATSAPP: "bg-success-soft border-success/30 text-success-soft-foreground",
  SMS:      "bg-stage-active border-accent-2/30 text-accent-2",
};

const CHANNEL_TINT_IN: Record<string, string> = {
  EMAIL:    "bg-card border-border text-foreground",
  WHATSAPP: "bg-card border-border text-foreground",
  SMS:      "bg-card border-border text-foreground",
};

const STATUS_BADGE: Record<string, string> = {
  queued:    "text-muted-foreground",
  sent:      "text-muted-foreground",
  delivered: "text-success",
  read:      "text-success font-semibold",
  failed:    "text-destructive font-semibold",
  received:  "text-muted-foreground",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short" });
}

function fmtTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-AE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isChannelType(t: string): boolean {
  return t === "EMAIL" || t === "WHATSAPP" || t === "SMS";
}

export default function ConversationThread({ activities, emptyMessage = "No conversation yet" }: Props) {
  // Newest at the bottom (chat convention)
  const ordered = useMemo(() => {
    const list = [...activities];
    list.sort((a, b) =>
      new Date(a.activityDate ?? a.createdAt).getTime() -
      new Date(b.activityDate ?? b.createdAt).getTime()
    );
    return list;
  }, [activities]);

  if (ordered.length === 0) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  return (
    <div className="px-4 py-4 space-y-3 max-h-[520px] overflow-y-auto scrollbar-thin">
      {ordered.map((act) => {
        if (isChannelType(act.type)) {
          return <Bubble key={act.id} act={act} />;
        }
        return <SystemEvent key={act.id} act={act} />;
      })}
    </div>
  );
}

// ─── Bubble for EMAIL / WHATSAPP / SMS ──────────────────────────────────────

function Bubble({ act }: { act: ConversationActivity }) {
  const isOutbound = (act.direction ?? "OUTBOUND") === "OUTBOUND";
  const tint = isOutbound
    ? CHANNEL_TINT_OUT[act.type] ?? "bg-muted/50 border-border text-foreground"
    : CHANNEL_TINT_IN[act.type]  ?? "bg-card border-border text-foreground";

  const status = act.deliveryStatus ?? (isOutbound ? "sent" : "received");
  const statusClass = STATUS_BADGE[status] ?? "text-muted-foreground";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl border px-3.5 py-2 ${tint}`}>
        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold tracking-wide uppercase">
          {(() => {
            const Icon = CHANNEL_ICON[act.type] ?? FileText;
            return <Icon className="size-3" />;
          })()}
          <span>{CHANNEL_LABEL[act.type] ?? act.type}</span>
          <span className="opacity-50">·</span>
          <span className="opacity-60 normal-case font-medium">{isOutbound ? "Outbound" : "Inbound"}</span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{act.summary}</p>
        <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px]">
          <span className="opacity-60" title={fmtTimestamp(act.activityDate ?? act.createdAt)}>
            {timeAgo(act.activityDate ?? act.createdAt)}
          </span>
          <span className={statusClass}>{status}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Inline system event (CALL / MEETING / NOTE / STAGE_CHANGE / SITE_VISIT) ─

function SystemEvent({ act }: { act: ConversationActivity }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px bg-muted" />
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {(() => {
          const Icon = CHANNEL_ICON[act.type] ?? FileText;
          return <Icon className="size-3" />;
        })()}
        <span className="font-medium uppercase tracking-wide">{act.type.replace("_", " ")}</span>
        <span className="opacity-60">·</span>
        <span className="max-w-[400px] truncate">{act.summary}</span>
        <span className="opacity-50">·</span>
        <span className="opacity-60">{timeAgo(act.activityDate ?? act.createdAt)}</span>
      </div>
      <div className="flex-1 h-px bg-muted" />
    </div>
  );
}

// ─── Reply box (separate component so screens that don't accept inbound replies can omit it) ─

interface ReplyBoxProps {
  /** Lead id (preferred) — recipient inferred server-side */
  leadId?: string;
  contactId?: string;
  dealId?: string;
  /** Optional: pre-select a channel and disable the picker */
  forcedChannel?: "EMAIL" | "WHATSAPP" | "SMS";
  /** Channels that can be deliverable to this recipient (we hide ones with no contact info) */
  availableChannels: ("EMAIL" | "WHATSAPP" | "SMS")[];
  onSent?: () => void;
}

export function ConversationReplyBox({
  leadId, contactId, dealId, forcedChannel, availableChannels, onSent,
}: ReplyBoxProps) {
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS">(
    forcedChannel ?? availableChannels[0] ?? "EMAIL"
  );
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true); setError(null);
    try {
      const axios = (await import("axios")).default;
      await axios.post("/api/communications/send", {
        leadId, contactId, dealId, channel,
        subject: channel === "EMAIL" ? (subject || undefined) : undefined,
        body,
      });
      setBody(""); setSubject("");
      onSent?.();
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (availableChannels.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground italic">
        No deliverable channel for this recipient (no email or phone on file, or all channels opted out).
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-border bg-muted/50 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {availableChannels.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!!forcedChannel && forcedChannel !== c}
            onClick={() => setChannel(c)}
            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 ${
              channel === c
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border hover:border-border"
            } disabled:opacity-40`}
          >
            {(() => {
              const Icon = CHANNEL_ICON[c] ?? FileText;
              return <Icon className="size-3.5" />;
            })()}
            <span>{CHANNEL_LABEL[c]}</span>
          </button>
        ))}
      </div>
      {channel === "EMAIL" && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-ring"
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={`Type your ${CHANNEL_LABEL[channel]?.toLowerCase() ?? ""} message…`}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring resize-y"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {channel === "WHATSAPP"
            ? "Freeform WhatsApp only delivers within the 24h service window or in sandbox."
            : channel === "SMS"
              ? "Keep it under ~160 chars to fit in one segment."
              : "Reply-To header threads any reply back to this conversation."}
        </p>
        <button
          type="button"
          disabled={sending || !body.trim()}
          onClick={handleSend}
          className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
