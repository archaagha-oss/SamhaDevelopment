import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
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

const ACTIVITY_TYPES = [
  { value: "CALL",       label: "📞 Call" },
  { value: "SITE_VISIT", label: "🏠 Site Visit" },
  { value: "NOTE",       label: "📝 Note" },
  { value: "EMAIL",      label: "✉️ Email" },
  { value: "WHATSAPP",   label: "💬 WhatsApp" },
  { value: "MEETING",    label: "🤝 Meeting" },
];

const TYPE_COLORS: Record<string, string> = {
  CALL:       "bg-blue-100 text-blue-700",
  SITE_VISIT: "bg-emerald-100 text-emerald-700",
  NOTE:       "bg-slate-100 text-slate-600",
  EMAIL:      "bg-purple-100 text-purple-700",
  WHATSAPP:   "bg-green-100 text-green-700",
  MEETING:    "bg-amber-100 text-amber-700",
};

export default function UnitActivityLogger({ unitId, interests }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("NOTE");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [leadId, setLeadId] = useState("");

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
        summary,
        outcome: outcome || undefined,
        leadId: leadId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-activities", unitId] });
      queryClient.invalidateQueries({ queryKey: ["unit", unitId] });
      setSummary("");
      setOutcome("");
      setLeadId("");
      setType("NOTE");
      setShowForm(false);
    },
  });

  const activities = data ?? [];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Activity Log
          {activities.length > 0 && (
            <span className="ml-2 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">{activities.length}</span>
          )}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "+ Log Activity"}
        </button>
      </div>

      {/* Log Form */}
      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-1.5">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  type === t.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Summary *</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={
                type === "CALL" ? "Called client, discussed pricing..." :
                type === "SITE_VISIT" ? "Client visited unit, positive feedback..." :
                "Notes about this unit..."
              }
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none bg-white"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Outcome (optional)</label>
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Client interested, follow up Friday"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
            />
          </div>

          {/* Link to lead */}
          {interests.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Link to Lead (optional)</label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">— No lead —</option>
                {interests.map((i) => (
                  <option key={i.leadId} value={i.leadId}>
                    {i.lead.firstName} {i.lead.lastName}
                    {i.isPrimary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => logActivity.mutate()}
            disabled={!summary.trim() || logActivity.isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {logActivity.isPending ? "Saving…" : "Save Activity"}
          </button>

          {logActivity.isError && (
            <p className="text-xs text-red-600">Failed to save activity. Try again.</p>
          )}
        </div>
      )}

      {/* Activity Feed */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No activities logged yet</p>
      ) : (
        <div className="space-y-2">
          {activities.slice(0, 10).map((a) => (
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
          {activities.length > 10 && (
            <p className="text-xs text-slate-400 text-center pt-1">+{activities.length - 10} older activities</p>
          )}
        </div>
      )}
    </div>
  );
}
