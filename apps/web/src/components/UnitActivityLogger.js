import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
const ACTIVITY_TYPES = [
    { value: "CALL", label: "Call", emoji: "📞", primary: true, promptHelper: "Called client, discussed pricing and payment plan…" },
    { value: "SITE_VISIT", label: "Site visit", emoji: "🏠", primary: true, promptHelper: "Client visited the unit on site, positive feedback on the view…" },
    { value: "NOTE", label: "Note", emoji: "📝", primary: true, promptHelper: "Internal note about this unit — pricing, timing, blockers…" },
    { value: "EMAIL", label: "Email", emoji: "✉️", promptHelper: "Sent SPA draft and payment-plan summary by email…" },
    { value: "WHATSAPP", label: "WhatsApp", emoji: "💬", promptHelper: "Replied on WhatsApp — confirmed unit availability…" },
    { value: "MEETING", label: "Meeting", emoji: "🤝", promptHelper: "Met client at the office, walked through payment plan…" },
    { value: "INSPECTION", label: "Inspection", emoji: "🔎", promptHelper: "Pre-handover inspection — items found and outcome…" },
    { value: "SNAG_REPORT", label: "Snag report", emoji: "🛠", promptHelper: "Snag observed — list items, severity, room, photos to follow…" },
    { value: "VIDEO_TOUR", label: "Video tour", emoji: "🎥", promptHelper: "Sent the unit walkthrough video, recorded reaction…" },
];
const TYPE_COLORS = {
    CALL: "bg-blue-100 text-blue-700",
    SITE_VISIT: "bg-emerald-100 text-emerald-700",
    NOTE: "bg-slate-100 text-slate-600",
    EMAIL: "bg-purple-100 text-purple-700",
    WHATSAPP: "bg-green-100 text-green-700",
    MEETING: "bg-amber-100 text-amber-700",
    INSPECTION: "bg-cyan-100 text-cyan-700",
    SNAG_REPORT: "bg-rose-100 text-rose-700",
    VIDEO_TOUR: "bg-indigo-100 text-indigo-700",
};
const OUTCOME_CHIPS = [
    "Interested",
    "Not interested",
    "Wants follow-up",
    "Negotiating",
    "On hold",
    "Booked",
];
const FILTER_GROUPS = [
    { label: "All", types: null },
    { label: "Calls", types: ["CALL"] },
    { label: "Site visits", types: ["SITE_VISIT"] },
    { label: "Notes", types: ["NOTE"] },
    { label: "Snags", types: ["INSPECTION", "SNAG_REPORT"] },
    { label: "Other", types: ["EMAIL", "WHATSAPP", "MEETING", "VIDEO_TOUR"] },
];
export default function UnitActivityLogger({ unitId, interests }) {
    const queryClient = useQueryClient();
    const [type, setType] = useState("NOTE");
    const [summary, setSummary] = useState("");
    const [outcome, setOutcome] = useState("");
    const [leadId, setLeadId] = useState("");
    const [activeFilter, setActiveFilter] = useState("All");
    const summaryRef = useRef(null);
    const { data, isLoading } = useQuery({
        queryKey: ["unit-activities", unitId],
        queryFn: async () => {
            const res = await axios.get(`/api/units/${unitId}/activities`);
            return res.data.data;
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
        if (!group || !group.types)
            return activities;
        const allowed = new Set(group.types);
        return activities.filter((a) => allowed.has(a.type));
    }, [activities, activeFilter]);
    const counts = useMemo(() => {
        const m = { All: activities.length };
        for (const g of FILTER_GROUPS) {
            if (!g.types)
                continue;
            const allowed = new Set(g.types);
            m[g.label] = activities.filter((a) => allowed.has(a.type)).length;
        }
        return m;
    }, [activities]);
    const currentMeta = ACTIVITY_TYPES.find((t) => t.value === type) ?? ACTIVITY_TYPES[0];
    const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());
    return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-5", children: [_jsx("div", { className: "flex items-center justify-between mb-3", children: _jsxs("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: ["Activity log", activities.length > 0 && (_jsx("span", { className: "ml-2 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs", children: activities.length }))] }) }), _jsx("div", { className: "grid grid-cols-3 gap-2 mb-3", children: ACTIVITY_TYPES.filter((t) => t.primary).map((t) => (_jsxs("button", { type: "button", onClick: () => { setType(t.value); focusSummary(); }, className: `flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg border-2 transition-colors ${type === t.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`, children: [_jsx("span", { className: "text-base", children: t.emoji }), _jsx("span", { children: t.label })] }, t.value))) }), _jsxs("div", { className: "p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 mb-4", children: [_jsxs("details", { className: "group", children: [_jsxs("summary", { className: "flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 font-medium hover:text-slate-700 list-none", children: [_jsx("span", { className: "select-none", children: "More types \u25BE" }), currentMeta && !currentMeta.primary && (_jsxs("span", { className: "ml-auto text-[11px] text-blue-600 font-semibold", children: [currentMeta.emoji, " ", currentMeta.label, " selected"] }))] }), _jsx("div", { className: "grid grid-cols-3 gap-1.5 mt-2", children: ACTIVITY_TYPES.filter((t) => !t.primary).map((t) => (_jsxs("button", { type: "button", onClick: () => { setType(t.value); focusSummary(); }, className: `px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${type === t.value
                                        ? "border-blue-500 bg-blue-50 text-blue-700"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`, children: [t.emoji, " ", t.label] }, t.value))) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: ["Summary ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("textarea", { ref: summaryRef, value: summary, onChange: (e) => setSummary(e.target.value), placeholder: currentMeta.promptHelper, rows: 2, className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none bg-white" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1.5", children: "Outcome (optional)" }), _jsx("div", { className: "flex flex-wrap gap-1.5 mb-1.5", children: OUTCOME_CHIPS.map((chip) => (_jsx("button", { type: "button", onClick: () => setOutcome(outcome === chip ? "" : chip), className: `text-[11px] px-2 py-0.5 rounded-full border transition-colors ${outcome === chip
                                        ? "border-blue-500 bg-blue-50 text-blue-700"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`, children: chip }, chip))) }), _jsx("input", { type: "text", value: outcome, onChange: (e) => setOutcome(e.target.value), placeholder: "Or type a custom outcome\u2026", className: "w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white" })] }), interests.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Link to lead (optional)" }), _jsxs("select", { value: leadId, onChange: (e) => setLeadId(e.target.value), className: "w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white", children: [_jsx("option", { value: "", children: "\u2014 No lead \u2014" }), interests.map((i) => (_jsxs("option", { value: i.leadId, children: [i.lead.firstName, " ", i.lead.lastName, i.isPrimary ? " (Primary)" : ""] }, i.leadId)))] })] })), _jsx("button", { type: "button", onClick: () => logActivity.mutate(), disabled: !summary.trim() || logActivity.isPending, className: "w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors", children: logActivity.isPending ? "Saving…" : `Save ${currentMeta.label.toLowerCase()}` })] }), _jsx("div", { className: "flex items-center gap-1 mb-2 overflow-x-auto", children: FILTER_GROUPS.map((g) => {
                    const active = activeFilter === g.label;
                    const count = counts[g.label] ?? 0;
                    return (_jsxs("button", { type: "button", onClick: () => setActiveFilter(g.label), className: `text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`, children: [g.label, " ", _jsx("span", { className: `ml-1 ${active ? "text-slate-300" : "text-slate-400"}`, children: count })] }, g.label));
                }) }), isLoading ? (_jsx("div", { className: "space-y-2", children: [1, 2].map((i) => _jsx("div", { className: "h-12 bg-slate-100 rounded-lg animate-pulse" }, i)) })) : visibleActivities.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 text-center py-4", children: activities.length === 0 ? "No activities logged yet — log your first one above." : "Nothing in this filter." })) : (_jsxs("div", { className: "space-y-2", children: [visibleActivities.slice(0, 10).map((a) => (_jsxs("div", { className: "flex gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors", children: [_jsx("span", { className: `text-[10px] font-bold px-1.5 py-0.5 rounded self-start mt-0.5 whitespace-nowrap ${TYPE_COLORS[a.type] || "bg-slate-100 text-slate-600"}`, children: a.type.replace(/_/g, " ") }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs text-slate-800 leading-relaxed", children: a.summary }), a.outcome && _jsxs("p", { className: "text-[10px] text-slate-400 mt-0.5 italic", children: ["\u2192 ", a.outcome] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [a.lead && (_jsxs("span", { className: "text-[10px] text-blue-600", children: [a.lead.firstName, " ", a.lead.lastName] })), _jsx("span", { className: "text-[10px] text-slate-400", children: new Date(a.createdAt).toLocaleDateString("en-AE") })] })] })] }, a.id))), visibleActivities.length > 10 && (_jsxs("p", { className: "text-xs text-slate-400 text-center pt-1", children: ["+", visibleActivities.length - 10, " older activities"] }))] }))] }));
}
