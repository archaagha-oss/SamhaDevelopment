import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSettings, type NotificationPrefs } from "../contexts/SettingsContext";
import { optimisticAction } from "../lib/optimisticToast";
import { PageContainer, PageHeader } from "../components/layout";

/**
 * Per-user notification preferences. Layered on top of the org-wide defaults
 * managed in Settings → Notifications:
 *
 *   final[event][channel] = userOverride ?? orgEvent ?? false
 *
 * Channels are master-gated by org settings: if the org has `email` off, the
 * email column is disabled here regardless of user override. This mirrors the
 * server-side resolver in `notificationService` (TODO).
 */

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const EVENTS: { key: string; label: string; desc: string }[] = [
  { key: "leadAssigned",        label: "Lead Assigned",        desc: "When a new lead is routed to you" },
  { key: "dealStageChanged",    label: "Deal Stage Changed",   desc: "Movement across the deal pipeline" },
  { key: "paymentDue",          label: "Payment Due",          desc: "Upcoming or overdue installments" },
  { key: "paymentReceived",     label: "Payment Received",     desc: "Confirmation when a payment lands" },
  { key: "documentUploaded",    label: "Document Uploaded",    desc: "New file attached to a deal/lead" },
  { key: "taskAssigned",        label: "Task Assigned",        desc: "New task on your queue" },
  { key: "commissionUnlocked",  label: "Commission Unlocked",  desc: "Your commission becomes payable" },
  { key: "kycExpiring",         label: "KYC Expiring",         desc: "Buyer documents nearing expiry" },
];

const CHANNELS = ["inApp", "email", "sms", "whatsapp"] as const;
type Channel = (typeof CHANNELS)[number];

interface Me {
  id: string;
  name: string;
  email: string;
  notificationPrefs: NotificationPrefs | null;
}

type Override = "default" | "on" | "off";

export default function NotificationPreferencesPage() {
  const { settings: org } = useSettings();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({});

  async function load() {
    setLoading(true);
    try {
      const r = await axios.get<Me>("/api/users/me");
      setMe(r.data);
      setPrefs(r.data.notificationPrefs ?? {});
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!me) return;
    setSaving(true);
    try {
      await axios.patch(`/api/settings/user-prefs/${me.id}`, { notificationPrefs: prefs });
      toast.success("Preferences saved");
    } catch (e: any) {
      const details = e.response?.data?.details;
      toast.error(details?.[0] ?? e.response?.data?.error ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    // Optimistic clear with Undo (UX_AUDIT_2 §R5): snapshot the current
    // overrides, clear immediately, restore them if the user clicks Undo.
    const snapshot = prefs;
    optimisticAction({
      do: async () => { setPrefs({}); },
      undo: async () => { setPrefs(snapshot); },
      message: "Overrides cleared",
      description: "Now using organization defaults. Undo within 5 seconds.",
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const orgChannels = org.notificationPrefs?.channels ?? { inApp: true, email: true, sms: false, whatsapp: false };
  const orgEvents = org.notificationPrefs?.events ?? {};

  function getOverride(eventKey: string, channel: Channel): Override {
    const ev = (prefs.events ?? {})[eventKey] as Record<Channel, boolean> | undefined;
    if (!ev || !(channel in ev)) return "default";
    return ev[channel] ? "on" : "off";
  }

  function setOverride(eventKey: string, channel: Channel, value: Override) {
    const next = { ...(prefs.events ?? {}) };
    const cur = { ...(next[eventKey] ?? {}) } as Record<Channel, boolean>;
    if (value === "default") {
      delete cur[channel];
    } else {
      cur[channel] = value === "on";
    }
    if (Object.keys(cur).length === 0) {
      delete next[eventKey];
    } else {
      next[eventKey] = cur;
    }
    setPrefs({ ...prefs, events: next });
  }

  function getOrgDefault(eventKey: string, channel: Channel): boolean {
    const ev = orgEvents[eventKey] as Record<Channel, boolean> | undefined;
    return !!ev?.[channel];
  }

  function effectiveValue(eventKey: string, channel: Channel): boolean {
    if (!orgChannels[channel]) return false; // org master-off
    const o = getOverride(eventKey, channel);
    if (o === "default") return getOrgDefault(eventKey, channel);
    return o === "on";
  }

  const overrideCount = Object.values(prefs.events ?? {})
    .reduce((n, ev) => n + Object.keys(ev as object).length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!me) {
    return <p className="p-6 text-sm text-muted-foreground">Could not load your profile.</p>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Notifications" }]}
        title="My notifications"
        subtitle={`${overrideCount} override${overrideCount === 1 ? "" : "s"} · ${me.email}`}
      />

      <div className="flex-1 overflow-auto">
      <PageContainer padding="default" className="space-y-5">
        <div className="bg-info-soft border border-info-soft-foreground/20 rounded-xl px-4 py-3 text-xs text-info-soft-foreground flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold mb-1">How overrides work</p>
            <p className="leading-relaxed">
              Each cell can be <strong>Default</strong> (follow org), <strong>On</strong>, or <strong>Off</strong>.
              "Default" tracks whatever the admin sets — change it in one place, applies everywhere.
            </p>
          </div>
          <span className="text-[10px] font-semibold bg-info-soft-foreground/10 px-2 py-1 rounded-full whitespace-nowrap">
            {overrideCount} override{overrideCount === 1 ? "" : "s"}
          </span>
        </div>

        <Card title="Per-Event Routing">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                  {CHANNELS.map((c) => (
                    <th key={c} className="py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{c === "inApp" ? "In-App" : c[0].toUpperCase() + c.slice(1)}</span>
                        {!orgChannels[c] && <span className="text-[9px] text-destructive">Disabled by admin</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {EVENTS.map(({ key, label, desc }) => (
                  <tr key={key}>
                    <td className="py-2.5 px-2">
                      <p className="text-sm text-foreground font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </td>
                    {CHANNELS.map((c) => {
                      const channelOn = !!orgChannels[c];
                      const override = getOverride(key, c);
                      const eff = effectiveValue(key, c);
                      return (
                        <td key={c} className="py-2.5 px-2 text-center">
                          <ThreeWayToggle
                            value={override}
                            disabled={!channelOn}
                            effective={eff}
                            orgDefault={getOrgDefault(key, c)}
                            onChange={(v) => setOverride(key, c, v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Quiet Hours" description="Personal quiet hours layer on top of the org-wide window. Urgent alerts still come through.">
          <QuietHoursControl
            value={prefs.quietHours}
            onChange={(qh) => setPrefs({ ...prefs, quietHours: qh })}
          />
        </Card>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={reset}
            disabled={overrideCount === 0}
            className="px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted rounded-lg disabled:opacity-50"
          >
            Reset all overrides
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </PageContainer>
      </div>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ThreeWayToggle({ value, disabled, effective, orgDefault, onChange }: {
  value: Override;
  disabled: boolean;
  effective: boolean;
  orgDefault: boolean;
  onChange: (v: Override) => void;
}) {
  // When the channel is master-disabled at the org, render a fixed indicator.
  if (disabled) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Override)}
        className="text-[11px] border border-border rounded px-1.5 py-1 bg-card focus:outline-none focus:border-ring"
        title={`Effective: ${effective ? "On" : "Off"}${value === "default" ? ` (org default: ${orgDefault ? "on" : "off"})` : ""}`}
      >
        <option value="default">Default ({orgDefault ? "on" : "off"})</option>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
    </div>
  );
}

function QuietHoursControl({ value, onChange }: {
  value: NotificationPrefs["quietHours"];
  onChange: (v: NotificationPrefs["quietHours"]) => void;
}) {
  const qh = value ?? { enabled: false, start: "22:00", end: "08:00" };
  return (
    <>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={qh.enabled}
          onChange={(e) => onChange({ ...qh, enabled: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-sm text-foreground">Enable personal quiet hours</span>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Start</label>
          <input
            type="time"
            className={inp}
            value={qh.start}
            disabled={!qh.enabled}
            onChange={(e) => onChange({ ...qh, start: e.target.value })}
          />
        </div>
        <div>
          <label className={lbl}>End</label>
          <input
            type="time"
            className={inp}
            value={qh.end}
            disabled={!qh.enabled}
            onChange={(e) => onChange({ ...qh, end: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}
