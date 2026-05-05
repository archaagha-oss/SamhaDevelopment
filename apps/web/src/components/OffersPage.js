import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
const STATUS_COLORS = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    ACCEPTED: "bg-blue-100 text-blue-700",
    REJECTED: "bg-red-100 text-red-700",
    EXPIRED: "bg-slate-100 text-slate-500",
    WITHDRAWN: "bg-amber-100 text-amber-700",
};
function fmtAED(n) {
    return `AED ${n.toLocaleString("en-AE", { maximumFractionDigits: 0 })}`;
}
export default function OffersPage() {
    const navigate = useNavigate();
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState(null);
    const [confirmReject, setConfirmReject] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const load = useCallback(() => {
        setLoading(true);
        axios.get("/api/offers")
            .then((r) => setOffers(r.data ?? []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);
    const updateStatus = async (id, status, extra) => {
        setUpdating(id);
        try {
            await axios.patch(`/api/offers/${id}/status`, { status, ...extra });
            const labels = { ACCEPTED: "Offer accepted", REJECTED: "Offer rejected", WITHDRAWN: "Offer withdrawn" };
            toast.success(labels[status] ?? "Offer updated");
            load();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update offer");
        }
        finally {
            setUpdating(null);
        }
    };
    const handleReject = async () => {
        if (!confirmReject)
            return;
        await updateStatus(confirmReject.id, "REJECTED", { rejectedReason: rejectReason || undefined });
        setConfirmReject(null);
        setRejectReason("");
    };
    const filtered = offers.filter((o) => {
        const matchStatus = filter === "ALL" || o.status === filter;
        const matchSearch = !search || (`${o.lead.firstName} ${o.lead.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            o.unit.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
            o.unit.project.name.toLowerCase().includes(search.toLowerCase()));
        return matchStatus && matchSearch;
    });
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsx("div", { className: "flex items-center justify-between mb-3", children: _jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Offers" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [offers.filter((o) => o.status === "ACTIVE").length, " active"] })] }) }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("input", { type: "text", placeholder: "Search by lead, unit or project\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-60 focus:outline-none focus:border-blue-400 bg-slate-50" }), _jsx("div", { className: "flex gap-1", children: ["ALL", "ACTIVE", "ACCEPTED", "REJECTED", "EXPIRED"].map((s) => (_jsx("button", { onClick: () => setFilter(s), className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: s.toLowerCase() }, s))) })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-6", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-48 text-slate-400 gap-2", children: [_jsx("p", { className: "text-3xl", children: "\uD83D\uDCC4" }), _jsx("p", { className: "text-sm", children: "No offers found" })] })) : (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 text-left border-b border-slate-200", children: [_jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Lead" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Unit" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Price" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Discount" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Status" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Expires" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: filtered.map((o) => (_jsxs("tr", { className: "hover:bg-slate-50/60", children: [_jsxs("td", { className: "px-5 py-3", children: [_jsxs("button", { onClick: () => navigate(`/leads/${o.lead.id}`), className: "font-medium text-blue-600 hover:underline text-left", children: [o.lead.firstName, " ", o.lead.lastName] }), _jsx("p", { className: "text-xs text-slate-400", children: o.lead.email })] }), _jsxs("td", { className: "px-5 py-3", children: [_jsx("p", { className: "font-semibold text-slate-900", children: o.unit.unitNumber }), _jsx("p", { className: "text-xs text-slate-400", children: o.unit.project.name })] }), _jsxs("td", { className: "px-5 py-3", children: [_jsx("p", { className: "font-semibold text-slate-900", children: fmtAED(o.offeredPrice) }), o.originalPrice !== o.offeredPrice && (_jsx("p", { className: "text-xs text-slate-400 line-through", children: fmtAED(o.originalPrice) }))] }), _jsx("td", { className: "px-5 py-3", children: o.discountAmount > 0 ? (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-amber-600", children: fmtAED(o.discountAmount) }), _jsxs("p", { className: "text-xs text-slate-400", children: [o.discountPct.toFixed(1), "%"] })] })) : (_jsx("span", { className: "text-xs text-slate-400", children: "\u2014" })) }), _jsxs("td", { className: "px-5 py-3", children: [_jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-600"}`, children: o.status }), o.rejectedReason && (_jsx("p", { className: "text-xs text-slate-400 mt-0.5 max-w-[140px] truncate", title: o.rejectedReason, children: o.rejectedReason }))] }), _jsx("td", { className: "px-5 py-3 text-xs text-slate-500", children: o.expiresAt
                                                ? new Date(o.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })
                                                : "—" }), _jsx("td", { className: "px-5 py-3", children: o.status === "ACTIVE" && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => updateStatus(o.id, "ACCEPTED"), disabled: updating === o.id, className: "text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-40", children: "Accept" }), _jsx("button", { onClick: () => { setConfirmReject(o); setRejectReason(""); }, disabled: updating === o.id, className: "text-xs px-2 py-1 bg-slate-100 text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-40", children: "Reject" }), _jsx("a", { href: `/offers/${o.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors", children: "Print" })] })) })] }, o.id))) })] }) })) }), confirmReject && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6", children: [_jsx("h2", { className: "font-bold text-slate-900 text-base mb-1", children: "Reject Offer" }), _jsxs("p", { className: "text-sm text-slate-500 mb-4", children: ["Reject offer for ", _jsxs("strong", { children: [confirmReject.lead.firstName, " ", confirmReject.lead.lastName] }), " on", " ", _jsx("strong", { children: confirmReject.unit.unitNumber }), "?"] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reason (optional)" }), _jsx("input", { type: "text", value: rejectReason, onChange: (e) => setRejectReason(e.target.value), placeholder: "e.g. Price too low", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setConfirmReject(null), className: "flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Back" }), _jsx("button", { onClick: handleReject, disabled: updating === confirmReject.id, className: "flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50", children: updating === confirmReject.id ? "Rejecting…" : "Confirm Reject" })] })] }) }))] }));
}
