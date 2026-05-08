import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { UnitInterestContext } from "../types";

interface Activity {
  id: string;
  type: string;
  summary: string;
  outcome?: string;
  createdAt: string;
  lead?: { id: string; firstName: string; lastName: string } | null;
}

interface Props {
  unitId: string;
  interests: UnitInterestContext[];
}

interface ActivityTypeMeta {
  value: string;
  label: string;
  emoji: string;
  primary?: boolean;          // shown as a quick-log button
  promptHelper: string;
}

const ACTIVITY_TYPES: ActivityTypeMeta[] = [
  { value: "CALL",        label: "Call",         emoji: "📞", primary: true,  promptHelper: "Called client, discussed pricing and payment plan…" },
  { value: "SITE_VISIT",  label: "Site visit",   emoji: "🏠", primary: true,  promptHelper: "Client visited the unit on site, positive feedback on the view…" },
  { value: "NOTE",        label: "Note",         emoji: "📝", primary: true,  promptHelper: "Internal note about this unit — pricing, timing, blockers…" },
  { value: "EMAIL",       label: "Email",        emoji: "✉️",                 promptHelper: "Sent SPA draft and payment-plan summary by email…" },
  { value: "WHATSAPP",    label: "WhatsApp",     emoji: "💬",                 promptHelper: "Replied on WhatsApp — confirmed unit availability…" },
  { value: "MEETING",     label: "Meeting",      emoji: "🤝",                 promptHelper: "Met client at the office, walked through payment plan…" },
  { value: "INSPECTION",  label: "Inspection",   emoji: "🔎",                 promptHelper: "Pre-handover inspection — items found and outcome…" },
  { value: "SNAG_REPORT", label: "Snag report",  emoji: "🛠",                 promptHelper: "Snag observed — list items, severity, room, photos to follow…" },
  { value: "VIDEO_TOUR",  label: "Video tour",   emoji: "🎥",                 promptHelper: "Sent the unit walkthrough video, recorded reaction…" },
];

const TYPE_COLORS: Record<string, string> = {
  CALL:        "bg-blue-100 text-blue-700",
  SITE_VISIT:  "bg-emerald-100 text-emerald-700",
  NOTE:        "bg-slate-100 text-slate-600",
  EMAIL:       "bg-purple-100 text-purple-700",
  WHATSAPP:    "bg-green-100 text-green-700",
  MEETING:     "bg-amber-100 text-amber-700",
  INSPECTION:  "bg-cyan-100 text-cyan-700",
  SNAG_REPORT: "bg-rose-100 text-rose-700",
  VIDEO_TOUR:  "bg-indigo-100 text-indigo-700",
};

const OUTCOME_CHIPS = [
  "Interested",
  "Not interested",
  "Wants follow-up",
  "Negotiating",
  "On hold",
  "Booked",
];

const FILTER_GROUPS: { label: string; types: string[] | null }[] = [
  { label: "All",         types: null },
  { label: "Calls",       types: ["CALL"] },
  { label: "Site visits", types: ["SITE_VISIT"] },
  { label: "Notes",       types: ["NOTE"] },
  { label: "Snags",       types: ["INSPECTION", "SNAG_REPORT"] },
  { label: "Other",       types: ["EMAIL", "WHATSAPP", "MEETING", "VIDEO_TOUR"] },
];

export default function UnitActivityLogger({ unitId, interests }: Props) {
  const queryClient                       = useQueryClient();
  const [type, setType]                   = useState("NOTE");
  const [summary, setSummary]             = useState("");
  const [outcome, setOutcome]             = useState("");
  const [leadId, setLeadId]               = useState("");
  const [activeFilter, setActiveFilter]   = useState<string>("All");
  const summaryRef                        = useRef<HTMLTextAreaElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["unit-activities", unitId],
    queryFn: async () => {
      const res = await axios.get(`/api/units/${unitId}/activities`);
      return res.data.data as Activity[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const logActivity = useMutation({
    mutationFn: async () => {
      await axios.post(`/api/units/${unitId}/activities`, {
        type,
        summary: summary.trim(),
        outcome: outcome.trim() || undefined,
        leadId: leadId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-activities", unitId] });
      queryClient.invalidateQueries({ queryKey: ["unit", unitId] });
      toast.success(`${ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? "Activity"} logged`);
      setSummary("");
      setOutcome("");
      setLeadId("");
      // keep type selection sticky so logging multiple of the same kind is fast
    },
    onError: () => {
      toast.error("Could not save activity — try again");
    },
  });

  const activities = data ?? [];
  const visibleActivities = useMemo(() => {
    const group = FILTER_GROUPS.find((g) => g.label === activeFilter);
    if (!group || !group.types) return activities;
    const allowed = new Set(group.types);
    return activities.filter((a) => allowed.has(a.type));
  }, [activities, activeFilter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: activities.length };
    for (const g of FILTER_GROUPS) {
      if (!g.types) continue;
      const allowed = new Set(g.types);
      m[g.label] = activities.filter((a) => allowed.has(a.type)).length;
    }
    return m;
  }, [activities]);

  const currentMeta = ACTIVITY_TYPES.find((t) => t.value === type) ?? ACTIVITY_TYPES[0];

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Activity log
          {activities.length > 0 && (
            <span className="ml-2 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">{activities.length}</span>
          )}
        </p>
      </div>

      {/* Quick-log primary buttons (Call / Site visit / Note) */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {ACTIVITY_TYPES.filter((t) => t.primary).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); focusSummary(); }}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg border-2 transition-colors ${
              type === t.value
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="text-base">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Always-visible logger form */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 mb-4">
        {/* Secondary type chips (shown collapsed by default) */}
        <details className="group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 font-medium hover:text-slate-700 list-none">
            <span className="select-none">More types ▾</span>
            {currentMeta && !currentMeta.primary && (
              <span className="ml-auto text-[11px] text-blue-600 font-semibold">
                {currentMeta.emoji} {currentMeta.label} selected
              </span>
            )}
          </summary>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {ACTIVITY_TYPES.filter((t) => !t.primary).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setType(t.value); focusSummary(); }}
                className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  type === t.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </details>

        {/* Summary */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Summary <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={summaryRef}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={currentMeta.promptHelper}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none bg-white"
          />
        </div>

        {/* Outcome — chips + free text */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Outcome (optional)</label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {OUTCOME_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setOutcome(outcome === chip ? "" : chip)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  outcome === chip
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Or type a custom outcome…"
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>

        {/* Link to lead */}
        {interests.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Link to lead (optional)</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">— No lead —</option>
              {interests.map((i) => (
                <option key={i.leadId} value={i.leadId}>
                  {i.lead.firstName} {i.lead.lastName}{i.isPrimary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => logActivity.mutate()}
          disabled={!summary.trim() || logActivity.isPending}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
        >
          {logActivity.isPending ? "Saving…" : `Save ${currentMeta.label.toLowerCase()}`}
        </button>
      </div>

      {/* Filter tabs above the feed */}
      <div className="flex items-center gap-1 mb-2 overflow-x-auto">
        {FILTER_GROUPS.map((g) => {
          const active = activeFilter === g.label;
          const count  = counts[g.label] ?? 0;
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => setActiveFilter(g.label)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {g.label} <span className={`ml-1 ${active ? "text-slate-300" : "text-slate-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Activity Feed */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : visibleActivities.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          {activities.length === 0 ? "No activities logged yet — log your first one above." : "Nothing in this filter."}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleActivities.slice(0, 10).map((a) => (
            <div key={a.id} className="flex gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded self-start mt-0.5 whitespace-nowrap ${TYPE_COLORS[a.type] || "bg-slate-100 text-slate-600"}`}>
                {a.type.replace(/_/g, " ")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-800 leading-relaxed">{a.summary}</p>
                {a.outcome && <p className="text-[10px] text-slate-400 mt-0.5 italic">→ {a.outcome}</p>}
                <div className="flex items-center gap-2 mt-1">
                  {a.lead && (
                    <span className="text-[10px] text-blue-600">{a.lead.firstName} {a.lead.lastName}</span>
                  )}
                  <span className="text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleDateString("en-AE")}</span>
                </div>
              </div>
            </div>
          ))}
          {visibleActivities.length > 10 && (
            <p className="text-xs text-slate-400 text-center pt-1">+{visibleActivities.length - 10} older activities</p>
          )}
        </div>
      )}
    </div>
  );
}
