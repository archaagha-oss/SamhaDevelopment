import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
const ACTIVITY_TYPES = [
    { value: "CALL", label: "📞 Call" },
    { value: "SITE_VISIT", label: "🏠 Site Visit" },
    { value: "NOTE", label: "📝 Note" },
    { value: "EMAIL", label: "✉️ Email" },
    { value: "WHATSAPP", label: "💬 WhatsApp" },
    { value: "MEETING", label: "🤝 Meeting" },
];
const TYPE_COLORS = {
    CALL: "bg-blue-100 text-blue-700",
    SITE_VISIT: "bg-emerald-100 text-emerald-700",
    NOTE: "bg-slate-100 text-slate-600",
    EMAIL: "bg-purple-100 text-purple-700",
    WHATSAPP: "bg-green-100 text-green-700",
    MEETING: "bg-amber-100 text-amber-700",
};
export default function UnitActivityLogger({ unitId, interests }) {
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
            return res.data.data;
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
    return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: ["Activity Log", activities.length > 0 && (_jsx("span", { className: "ml-2 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs", children: activities.length }))] }), _jsx("button", { onClick: () => setShowForm((v) => !v), className: "text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors", children: showForm ? "Cancel" : "+ Log Activity" })] }), showForm && (_jsxs("div", { className: "mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3", children: [_jsx("div", { className: "grid grid-cols-3 gap-1.5", children: ACTIVITY_TYPES.map((t) => (_jsx("button", { onClick: () => setType(t.value), className: `px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${type === t.value
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`, children: t.label }, t.value))) }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Summary *" }), _jsx("textarea", { value: summary, onChange: (e) => setSummary(e.target.value), placeholder: type === "CALL" ? "Called client, discussed pricing..." :
                                    type === "SITE_VISIT" ? "Client visited unit, positive feedback..." :
                                        "Notes about this unit...", rows: 2, className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none bg-white" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Outcome (optional)" }), _jsx("input", { type: "text", value: outcome, onChange: (e) => setOutcome(e.target.value), placeholder: "e.g. Client interested, follow up Friday", className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white" })] }), interests.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Link to Lead (optional)" }), _jsxs("select", { value: leadId, onChange: (e) => setLeadId(e.target.value), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white", children: [_jsx("option", { value: "", children: "\u2014 No lead \u2014" }), interests.map((i) => (_jsxs("option", { value: i.leadId, children: [i.lead.firstName, " ", i.lead.lastName, i.isPrimary ? " (Primary)" : ""] }, i.leadId)))] })] })), _jsx("button", { onClick: () => logActivity.mutate(), disabled: !summary.trim() || logActivity.isPending, className: "w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors", children: logActivity.isPending ? "Saving…" : "Save Activity" }), logActivity.isError && (_jsx("p", { className: "text-xs text-red-600", children: "Failed to save activity. Try again." }))] })), isLoading ? (_jsx("div", { className: "space-y-2", children: [1, 2].map((i) => _jsx("div", { className: "h-12 bg-slate-100 rounded-lg animate-pulse" }, i)) })) : activities.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 text-center py-4", children: "No activities logged yet" })) : (_jsxs("div", { className: "space-y-2", children: [activities.slice(0, 10).map((a) => (_jsxs("div", { className: "flex gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors", children: [_jsx("span", { className: `text-[10px] font-bold px-1.5 py-0.5 rounded self-start mt-0.5 whitespace-nowrap ${TYPE_COLORS[a.type] || "bg-slate-100 text-slate-600"}`, children: a.type.replace(/_/g, " ") }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs text-slate-800 leading-relaxed", children: a.summary }), a.outcome && _jsxs("p", { className: "text-[10px] text-slate-400 mt-0.5 italic", children: ["\u2192 ", a.outcome] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [a.lead && (_jsxs("span", { className: "text-[10px] text-blue-600", children: [a.lead.firstName, " ", a.lead.lastName] })), _jsx("span", { className: "text-[10px] text-slate-400", children: new Date(a.createdAt).toLocaleDateString("en-AE") })] })] })] }, a.id))), activities.length > 10 && (_jsxs("p", { className: "text-xs text-slate-400 text-center pt-1", children: ["+", activities.length - 10, " older activities"] }))] }))] }));
}
