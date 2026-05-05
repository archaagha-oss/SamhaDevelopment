import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
const STATUS_COLORS = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    EXPIRED: "bg-red-100 text-red-700",
    CANCELLED: "bg-slate-100 text-slate-500",
    CONVERTED: "bg-blue-100 text-blue-700",
};
function expiryCountdown(expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0)
        return { label: "Expired", color: "text-red-600 font-semibold" };
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (d > 0)
        return { label: `${d}d ${h % 24}h left`, color: d < 2 ? "text-amber-600 font-semibold" : "text-emerald-600" };
    return { label: `${h}h left`, color: "text-red-600 font-semibold" };
}
export default function ReservationsPage() {
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ACTIVE");
    const [search, setSearch] = useState("");
    const [cancelling, setCancelling] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [confirmCancel, setConfirmCancel] = useState(null);
    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (filter !== "ALL")
            params.status = filter;
        axios.get("/api/reservations", { params })
            .then((r) => setReservations(r.data.data ?? []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [filter]);
    useEffect(() => { load(); }, [load]);
    const handleCancel = async () => {
        if (!confirmCancel)
            return;
        setCancelling(confirmCancel.id);
        try {
            await axios.patch(`/api/reservations/${confirmCancel.id}/cancel`, { reason: cancelReason || undefined });
            toast.success("Reservation cancelled");
            setConfirmCancel(null);
            setCancelReason("");
            load();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to cancel reservation");
        }
        finally {
            setCancelling(null);
        }
    };
    const filtered = reservations.filter((r) => {
        if (!search)
            return true;
        const q = search.toLowerCase();
        return (`${r.lead.firstName} ${r.lead.lastName}`.toLowerCase().includes(q) ||
            r.unit.unitNumber.toLowerCase().includes(q) ||
            r.lead.email.toLowerCase().includes(q));
    });
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsx("div", { className: "flex items-center justify-between mb-3", children: _jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Reservations" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [reservations.filter((r) => r.status === "ACTIVE").length, " active"] })] }) }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("input", { type: "text", placeholder: "Search by lead or unit\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-blue-400 bg-slate-50" }), _jsx("div", { className: "flex gap-1", children: ["ALL", "ACTIVE", "EXPIRED", "CANCELLED", "CONVERTED"].map((s) => (_jsx("button", { onClick: () => setFilter(s), className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: s.toLowerCase() }, s))) })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-6", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-48 text-slate-400 gap-2", children: [_jsx("p", { className: "text-3xl", children: "\uD83D\uDCCB" }), _jsx("p", { className: "text-sm", children: "No reservations found" })] })) : (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 text-left border-b border-slate-200", children: [_jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Lead" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Unit" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Status" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Expires" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Created" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Notes" }), _jsx("th", { className: "px-5 py-3" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: filtered.map((r) => {
                                    const countdown = r.status === "ACTIVE" ? expiryCountdown(r.expiresAt) : null;
                                    return (_jsxs("tr", { className: "hover:bg-slate-50/60", children: [_jsxs("td", { className: "px-5 py-3", children: [_jsxs("p", { className: "font-medium text-slate-800", children: [r.lead.firstName, " ", r.lead.lastName] }), _jsx("p", { className: "text-xs text-slate-400", children: r.lead.email })] }), _jsxs("td", { className: "px-5 py-3", children: [_jsx("p", { className: "font-semibold text-slate-900", children: r.unit.unitNumber }), _jsxs("p", { className: "text-xs text-slate-400", children: ["AED ", r.unit.askingPrice?.toLocaleString("en-AE") ?? "—"] })] }), _jsx("td", { className: "px-5 py-3", children: _jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`, children: r.status }) }), _jsx("td", { className: "px-5 py-3", children: countdown ? (_jsx("span", { className: `text-xs ${countdown.color}`, children: countdown.label })) : (_jsx("span", { className: "text-xs text-slate-400", children: new Date(r.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) })) }), _jsx("td", { className: "px-5 py-3 text-xs text-slate-500", children: new Date(r.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) }), _jsx("td", { className: "px-5 py-3 max-w-[180px]", children: r.cancelReason ? (_jsx("p", { className: "text-xs text-slate-400 truncate", title: r.cancelReason, children: r.cancelReason })) : r.notes ? (_jsx("p", { className: "text-xs text-slate-400 truncate", title: r.notes, children: r.notes })) : null }), _jsx("td", { className: "px-5 py-3", children: r.status === "ACTIVE" && (_jsx("button", { onClick: () => { setConfirmCancel(r); setCancelReason(""); }, className: "text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors", children: "Cancel" })) })] }, r.id));
                                }) })] }) })) }), confirmCancel && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6", children: [_jsx("h2", { className: "font-bold text-slate-900 text-base mb-1", children: "Cancel Reservation" }), _jsxs("p", { className: "text-sm text-slate-500 mb-4", children: ["Cancel reservation for ", _jsxs("strong", { children: [confirmCancel.lead.firstName, " ", confirmCancel.lead.lastName] }), " on unit", " ", _jsx("strong", { children: confirmCancel.unit.unitNumber }), "?"] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reason (optional)" }), _jsx("input", { type: "text", value: cancelReason, onChange: (e) => setCancelReason(e.target.value), placeholder: "e.g. Client changed mind", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setConfirmCancel(null), className: "flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Back" }), _jsx("button", { onClick: handleCancel, disabled: cancelling === confirmCancel.id, className: "flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50", children: cancelling === confirmCancel.id ? "Cancelling…" : "Confirm Cancel" })] })] }) }))] }));
}
