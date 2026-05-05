import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
const ACTIVITY_TYPES = [
    { value: "CALL", label: "Call", icon: "📞" },
    { value: "WHATSAPP", label: "WhatsApp", icon: "💬" },
    { value: "EMAIL", label: "Email", icon: "📧" },
    { value: "MEETING", label: "Meeting", icon: "📅" },
    { value: "SITE_VISIT", label: "Site Visit", icon: "🏗️" },
    { value: "NOTE", label: "Note", icon: "📝" },
];
function nowLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}
export default function ActivityModal({ open, onClose, entityType, entityId, onSuccess, }) {
    const [type, setType] = useState("NOTE");
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
    if (!open)
        return null;
    const endpoint = entityType === "lead"
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
                callDuration: type === "CALL" && callDuration ? parseInt(callDuration, 10) : undefined,
            });
            onSuccess?.();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save activity.");
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm", children: _jsxs("div", { className: "bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-700", children: [_jsx("h2", { className: "text-white font-semibold text-base", children: "Log Activity" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-200 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "px-6 py-5 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-slate-400 text-xs font-medium mb-2", children: "Activity Type" }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: ACTIVITY_TYPES.map(({ value, label, icon }) => (_jsxs("button", { onClick: () => setType(value), className: `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${type === value
                                            ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                                            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100"}`, children: [_jsx("span", { children: icon }), _jsx("span", { children: label })] }, value))) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: ["Notes ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Describe what happened\u2026", rows: 3, className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition-colors" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: "Activity Date" }), _jsx("input", { type: "datetime-local", value: activityDate, onChange: (e) => setActivityDate(e.target.value), className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: ["Follow-up Date", " ", _jsx("span", { className: "text-slate-600", children: "(optional)" })] }), _jsx("input", { type: "datetime-local", value: followUpDate, onChange: (e) => setFollowUpDate(e.target.value), className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" })] })] }), type === "CALL" && (_jsxs("div", { children: [_jsx("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: "Call Duration (minutes)" }), _jsx("input", { type: "number", value: callDuration, onChange: (e) => setCallDuration(e.target.value), placeholder: "e.g. 5", min: 0, className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" })] })), _jsxs("div", { children: [_jsxs("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: ["Outcome", " ", _jsx("span", { className: "text-slate-600", children: "(optional)" })] }), _jsx("input", { type: "text", value: outcome, onChange: (e) => setOutcome(e.target.value), placeholder: "e.g. Interested, Callback requested, Closed\u2026", className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" })] }), followUpDate && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5", children: [_jsx("span", { className: "mt-0.5 flex-shrink-0", children: "\uD83D\uDCCC" }), _jsxs("p", { children: ["A follow-up task will be created for", " ", new Date(followUpDate).toLocaleDateString("en-AE", {
                                            weekday: "short",
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        }), "."] })] })), error && (_jsx("p", { className: "text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2", children: error }))] }), _jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-slate-300 hover:text-white text-sm transition-colors", children: "Cancel" }), _jsx("button", { onClick: handleSubmit, disabled: saving, className: "px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors", children: saving ? "Saving…" : "Save Activity" })] })] }) }));
}
