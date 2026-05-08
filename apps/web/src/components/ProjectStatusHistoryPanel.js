import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useProjectStatusHistory } from "../hooks/useProjectStatusHistory";
function describe(field, oldValue, newValue) {
    if (field === "projectStatus") {
        return `Project status: ${oldValue ?? "—"} → ${newValue}`;
    }
    if (field === "completionStatus") {
        return `Completion stage: ${oldValue?.replace(/_/g, " ") ?? "—"} → ${newValue.replace(/_/g, " ")}`;
    }
    if (field === "handoverDate") {
        const fmt = (v) => (v ? new Date(v).toLocaleDateString() : "—");
        return `Handover date: ${fmt(oldValue)} → ${fmt(newValue || null)}`;
    }
    return `${field}: ${oldValue ?? "—"} → ${newValue}`;
}
export default function ProjectStatusHistoryPanel({ projectId, limit = 20 }) {
    const query = useProjectStatusHistory(projectId, limit);
    return (_jsxs("section", { style: { marginTop: 24 }, children: [_jsx("h3", { style: { margin: 0, fontSize: 16 }, children: "Status history" }), query.isLoading ? (_jsx("p", { style: { color: "#888", marginTop: 8 }, children: "Loading\u2026" })) : (query.data ?? []).length === 0 ? (_jsx("p", { style: { color: "#888", marginTop: 8, fontSize: 14 }, children: "No status changes yet." })) : (_jsx("ul", { style: { listStyle: "none", padding: 0, margin: "12px 0 0 0" }, children: (query.data ?? []).map((entry) => (_jsxs("li", { style: {
                        padding: 10,
                        border: "1px solid #ececef",
                        borderRadius: 6,
                        marginBottom: 6,
                        fontSize: 14,
                    }, children: [_jsx("p", { style: { margin: 0 }, children: describe(entry.field, entry.oldValue, entry.newValue) }), _jsxs("p", { style: { margin: "4px 0 0 0", color: "#888", fontSize: 12 }, children: [new Date(entry.changedAt).toLocaleString(), " \u00B7 ", entry.changedBy, entry.reason ? ` · ${entry.reason}` : ""] })] }, entry.id))) }))] }));
}
