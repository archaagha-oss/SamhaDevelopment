import { useState, useEffect } from "react";
import axios from "axios";
import { Phone, MessageCircle, Mail, Calendar, Building2, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ActivityType = "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "SITE_VISIT" | "NOTE";

interface ActivityModalProps {
  open: boolean;
  onClose: () => void;
  /** The entity this activity belongs to */
  entityType: "lead" | "deal" | "unit";
  entityId: string;
  onSuccess?: () => void;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: LucideIcon }[] = [
  { value: "CALL",       label: "Call",       icon: Phone },
  { value: "WHATSAPP",   label: "WhatsApp",   icon: MessageCircle },
  { value: "EMAIL",      label: "Email",      icon: Mail },
  { value: "MEETING",    label: "Meeting",    icon: Calendar },
  { value: "SITE_VISIT", label: "Site Visit", icon: Building2 },
  { value: "NOTE",       label: "Note",       icon: FileText },
];

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function ActivityModal({
  open,
  onClose,
  entityType,
  entityId,
  onSuccess,
}: ActivityModalProps) {
  const [type, setType] = useState<ActivityType>("NOTE");
  const [notes, setNotes] = useState("");
  const [activityDate, setActivityDate] = useState(nowLocal);
  const [followUpDate, setFollowUpDate] = useState("");
  const [outcome, setOutcome] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form on open
  useEffect(() => {
    if (open) {
      setType("NOTE");
      setNotes("");
      setActivityDate(nowLocal());
      setFollowUpDate("");
      setOutcome("");
      setCallDuration("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const endpoint =
    entityType === "lead"
      ? `/api/leads/${entityId}/activities`
      : entityType === "deal"
      ? `/api/deals/${entityId}/activities`
      : `/api/units/${entityId}/activities`;

  const handleSubmit = async () => {
    if (!notes.trim()) {
      setError("Notes are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post(endpoint, {
        type,
        notes: notes.trim(),
        activityDate: activityDate
          ? new Date(activityDate).toISOString()
          : new Date().toISOString(),
        followUpDate: followUpDate
          ? new Date(followUpDate).toISOString()
          : undefined,
        outcome: outcome.trim() || undefined,
        callDuration:
          type === "CALL" && callDuration ? parseInt(callDuration, 10) : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save activity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-white font-semibold text-base">Log Activity</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type grid */}
          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-2">
              Activity Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    type === value
                      ? "bg-primary border-primary/40 text-white shadow-sm"
                      : "bg-muted border-border text-foreground/80 hover:border-border hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5">
              Notes <span className="text-destructive">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what happened…"
              rows={3}
              className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring resize-none transition-colors"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5">
                Activity Date
              </label>
              <input
                type="datetime-local"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring transition-colors"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5">
                Follow-up Date{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring transition-colors"
              />
            </div>
          </div>

          {/* Call duration — only for CALL */}
          {type === "CALL" && (
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5">
                Call Duration (minutes)
              </label>
              <input
                type="number"
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                placeholder="e.g. 5"
                min={0}
                className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring transition-colors"
              />
            </div>
          )}

          {/* Outcome */}
          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5">
              Outcome{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Interested, Callback requested, Closed…"
              className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
            />
          </div>

          {/* Follow-up notice */}
          {followUpDate && (
            <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2.5">
              <p>
                A follow-up task will be created for{" "}
                {new Date(followUpDate).toLocaleDateString("en-AE", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                .
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground/80 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save Activity"}
          </button>
        </div>
      </div>
    </div>
  );
}
