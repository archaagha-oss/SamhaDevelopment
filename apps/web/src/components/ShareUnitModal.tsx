import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { formatAED as fmtAED } from "../lib/format";
import Modal from "./Modal";
import { Button } from "@/components/ui/button";

interface UnitInfo {
  unitNumber: string;
  type: string;
  price: number;
  area?: number;
  view?: string | null;
  floor?: number;
  projectName?: string;
}

interface LeadHit {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface Props {
  unit: UnitInfo;
  onClose: () => void;
}

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS" };
const CHANNEL_ICON: Record<string, string>  = { EMAIL: "✉️", WHATSAPP: "💬", SMS: "📱" };

function defaultBody(unit: UnitInfo, recipientName: string): string {
  const lines = [
    `Hi ${recipientName},`,
    "",
    `Thought you might like this${unit.projectName ? ` at ${unit.projectName}` : ""}:`,
    "",
    `• Unit ${unit.unitNumber} — ${unit.type.replace(/_/g, " ")}${unit.floor != null ? `, Floor ${unit.floor}` : ""}`,
    unit.area ? `• ${unit.area} sq m${unit.view ? `, ${unit.view.replace(/_/g, " ").toLowerCase()} view` : ""}` : "",
    `• ${fmtAED(unit.price)}`,
    "",
    `Want to take a look? Happy to share floorplans or set up a viewing.`,
  ];
  return lines.filter(Boolean).join("\n");
}

function defaultSubject(unit: UnitInfo): string {
  return `Unit ${unit.unitNumber}${unit.projectName ? ` at ${unit.projectName}` : ""} — ${fmtAED(unit.price)}`;
}

export default function ShareUnitModal({ unit, onClose }: Props) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked]     = useState<LeadHit | null>(null);

  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS">("WHATSAPP");
  const [subject, setSubject] = useState(defaultSubject(unit));
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);

  // Search leads (debounced)
  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const r = await axios.get("/api/leads", { params: { search: q, limit: 6 } });
      setResults(r.data.data ?? r.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (picked) return;
    const t = setTimeout(() => { if (query.trim()) search(query.trim()); else setResults([]); }, 250);
    return () => clearTimeout(t);
  }, [query, picked, search]);

  // When a lead is picked, pre-fill body with their first name
  useEffect(() => {
    if (picked) setBody(defaultBody(unit, picked.firstName));
  }, [picked, unit]);

  // Hide channels the picked lead can't receive
  const availableChannels: ("EMAIL" | "WHATSAPP" | "SMS")[] = (() => {
    if (!picked) return ["EMAIL", "WHATSAPP", "SMS"];
    const out: ("EMAIL" | "WHATSAPP" | "SMS")[] = [];
    if (picked.email) out.push("EMAIL");
    if (picked.phone) { out.push("WHATSAPP"); out.push("SMS"); }
    return out;
  })();

  // Adjust selected channel when picking changes available set
  useEffect(() => {
    if (!availableChannels.includes(channel) && availableChannels.length > 0) {
      setChannel(availableChannels[0]);
    }
  }, [picked, availableChannels, channel]);

  const handleSend = async () => {
    if (!picked) return;
    if (!body.trim()) return;
    setSending(true);
    try {
      await axios.post("/api/communications/send", {
        leadId: picked.id,
        channel,
        subject: channel === "EMAIL" ? subject || undefined : undefined,
        body,
      });
      toast.success(`Sent to ${picked.firstName} via ${CHANNEL_LABEL[channel]}`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Share unit with a lead"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!picked || !body.trim() || sending || availableChannels.length === 0}
          >
            {sending ? "Sending…" : `Send via ${CHANNEL_LABEL[channel] ?? "?"}`}
          </Button>
        </>
      }
    >
      <div className="px-5 py-4 space-y-4">
          {/* Unit summary */}
          <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              Unit {unit.unitNumber} · {unit.type.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">
              {unit.projectName ?? ""}{unit.projectName ? " · " : ""}{fmtAED(unit.price)}
            </p>
          </div>

          {/* Lead picker */}
          {!picked ? (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Search leads</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, phone, email…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring"
                autoFocus
              />
              <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {searching && <p className="px-3 py-3 text-xs text-muted-foreground">Searching…</p>}
                {!searching && query.trim() === "" && (
                  <p className="px-3 py-3 text-xs text-muted-foreground">Start typing to find a lead</p>
                )}
                {!searching && query.trim() !== "" && results.length === 0 && (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No leads match</p>
                )}
                {!searching && results.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setPicked(l)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium text-foreground">{l.firstName} {l.lastName}</p>
                    <p className="text-xs text-muted-foreground">{l.phone}{l.email ? ` · ${l.email}` : ""}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-info-soft border border-primary/40 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{picked.firstName} {picked.lastName}</p>
                <p className="text-xs text-muted-foreground">{picked.phone}{picked.email ? ` · ${picked.email}` : ""}</p>
              </div>
              <button
                onClick={() => { setPicked(null); setQuery(""); }}
                className="text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* Channel + content (only after a lead is picked) */}
          {picked && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {availableChannels.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      channel === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground border border-border hover:border-border"
                    }`}
                  >
                    {CHANNEL_ICON[c]} {CHANNEL_LABEL[c]}
                  </button>
                ))}
                {availableChannels.length === 0 && (
                  <p className="text-xs text-destructive">This lead has no email or phone on file.</p>
                )}
              </div>
              {channel === "EMAIL" && (
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-ring"
                />
              )}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring resize-y font-sans"
              />
            </>
          )}
      </div>
    </Modal>
  );
}
