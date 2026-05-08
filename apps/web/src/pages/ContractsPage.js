import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import ContractStatusModal from "../components/ContractStatusModal";
import DocumentUploadModal from "../components/DocumentUploadModal";
import EmptyState from "../components/EmptyState";
import { Skeleton, SkeletonTableRows } from "../components/Skeleton";
const CONTRACT_STATUS_CONFIG = {
    DRAFT: { label: "Draft", badge: "bg-slate-100 text-slate-600" },
    SENT: { label: "Sent", badge: "bg-blue-100 text-blue-700" },
    SIGNED: { label: "Signed", badge: "bg-emerald-100 text-emerald-700" },
    ARCHIVED: { label: "Archived", badge: "bg-slate-200 text-slate-500" },
};
const DOC_TYPE_CONFIG = {
    SPA: { label: "SPA", badge: "bg-blue-100 text-blue-700" },
    OQOOD_CERTIFICATE: { label: "Oqood", badge: "bg-purple-100 text-purple-700" },
    RESERVATION_FORM: { label: "Reservation Form", badge: "bg-orange-100 text-orange-700" },
    PAYMENT_RECEIPT: { label: "Payment Receipt", badge: "bg-green-100 text-green-700" },
    PASSPORT: { label: "Passport", badge: "bg-pink-100 text-pink-700" },
    EMIRATES_ID: { label: "Emirates ID", badge: "bg-indigo-100 text-indigo-700" },
    VISA: { label: "Visa", badge: "bg-teal-100 text-teal-700" },
    OTHER: { label: "Other", badge: "bg-slate-100 text-slate-600" },
};
const CONTRACT_STATUS_ORDER = ["DRAFT", "SENT", "SIGNED", "ARCHIVED"];
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
export default function ContractsPage() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [filterType, setFilterType] = useState("ALL");
    const [search, setSearch] = useState("");
    const [statusModal, setStatusModal] = useState(null);
    const [uploadDealId, setUploadDealId] = useState(null);
    const load = useCallback(() => {
        setLoading(true);
        axios.get("/api/documents", { params: { contractStatus: filterStatus === "ALL" ? undefined : filterStatus } })
            .then((r) => setDocuments(r.data.data || []))
            .catch((err) => {
            console.error(err);
            toast.error(err?.response?.data?.error || "Failed to load documents");
        })
            .finally(() => setLoading(false));
    }, [filterStatus]);
    useEffect(() => { load(); }, [load]);
    const docTypes = Array.from(new Set(documents.map((d) => d.type))).filter(Boolean);
    const filtered = documents.filter((d) => {
        if (filterType !== "ALL" && d.type !== filterType)
            return false;
        if (search) {
            const q = search.toLowerCase();
            const matches = d.name.toLowerCase().includes(q) ||
                d.deal.dealNumber.toLowerCase().includes(q) ||
                `${d.deal.lead.firstName} ${d.deal.lead.lastName}`.toLowerCase().includes(q) ||
                d.deal.unit.unitNumber.toLowerCase().includes(q);
            if (!matches)
                return false;
        }
        return true;
    });
    // KPI counts
    const counts = CONTRACT_STATUS_ORDER.reduce((acc, s) => {
        acc[s] = documents.filter((d) => d.contractStatus === s).length;
        return acc;
    }, {});
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Contracts & Documents" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Manage contract lifecycle across all deals" })] }), _jsx("button", { onClick: load, className: "text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors", children: "Refresh" })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: CONTRACT_STATUS_ORDER.map((status) => {
                    const cfg = CONTRACT_STATUS_CONFIG[status];
                    const isActive = filterStatus === status;
                    return (_jsxs("button", { onClick: () => setFilterStatus(isActive ? "ALL" : status), className: `rounded-xl p-4 text-left border-2 transition-all bg-white ${isActive ? "border-slate-800 shadow-sm" : "border-transparent hover:border-slate-300"}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: cfg.label }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`, children: counts[status] ?? 0 })] }), _jsx("p", { className: "text-2xl font-bold text-slate-800", children: counts[status] ?? 0 })] }, status));
                }) }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("input", { type: "text", placeholder: "Search by name, deal #, buyer, unit...", value: search, onChange: (e) => setSearch(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72" }), _jsxs("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "ALL", children: "All Types" }), docTypes.map((t) => (_jsx("option", { value: t, children: DOC_TYPE_CONFIG[t]?.label || t }, t)))] }), (filterStatus !== "ALL" || filterType !== "ALL" || search) && (_jsx("button", { onClick: () => { setFilterStatus("ALL"); setFilterType("ALL"); setSearch(""); }, className: "text-xs text-slate-500 hover:text-slate-800 underline", children: "Clear filters" })), _jsxs("span", { className: "text-xs text-slate-400 ml-auto", children: [filtered.length, " document", filtered.length !== 1 ? "s" : ""] })] }), loading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsx("table", { className: "w-full text-sm", children: _jsx("tbody", { children: _jsx(SkeletonTableRows, { rows: 5, cols: 8 }) }) }) }), _jsx("div", { className: "md:hidden space-y-3", children: Array.from({ length: 4 }).map((_, i) => (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-2/3" }), _jsx(Skeleton, { className: "h-3 w-1/2" }), _jsx(Skeleton, { className: "h-3 w-1/3" })] }, i))) })] })) : filtered.length === 0 ? (_jsx(EmptyState, { icon: "\u25EB", title: search || filterStatus !== "ALL" || filterType !== "ALL" ? "No documents match your filters" : "No documents yet", description: search || filterStatus !== "ALL" || filterType !== "ALL" ? "Try clearing your filters or search." : "Upload SPA, Oqood, or other contract documents from a deal." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsx("div", { className: "overflow-x-auto scrollbar-thin", children: _jsxs("table", { className: "w-full text-sm min-w-[900px]", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Document", "Type", "Deal", "Buyer", "Unit", "Contract Status", "Uploaded", "Actions"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: filtered.map((doc) => {
                                            const typeCfg = DOC_TYPE_CONFIG[doc.type] || { label: doc.type, badge: "bg-slate-100 text-slate-600" };
                                            const statusCfg = CONTRACT_STATUS_CONFIG[doc.contractStatus] || { label: doc.contractStatus, badge: "bg-slate-100 text-slate-600" };
                                            return (_jsxs("tr", { className: "hover:bg-slate-50/80 transition-colors", children: [_jsxs("td", { className: "px-4 py-3 max-w-[200px]", children: [_jsx("p", { className: "font-medium text-slate-800 truncate", title: doc.name, children: doc.name }), _jsx("p", { className: "text-xs text-slate-400", children: doc.mimeType.split("/")[1]?.toUpperCase() })] }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.badge}`, children: typeCfg.label }) }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-500", children: doc.deal.dealNumber }), _jsx("td", { className: "px-4 py-3", children: _jsxs("p", { className: "font-medium text-slate-800", children: [doc.deal.lead.firstName, " ", doc.deal.lead.lastName] }) }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: doc.deal.unit.unitNumber }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.badge}`, children: statusCfg.label }) }), _jsx("td", { className: "px-4 py-3 text-slate-500 text-xs whitespace-nowrap", children: fmtDate(doc.createdAt) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("button", { onClick: () => setStatusModal(doc), className: "text-xs font-medium px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap", children: "Update Status" }), _jsx("button", { onClick: () => setUploadDealId(doc.dealId), className: "text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors", children: "+ Upload" })] }) })] }, doc.id));
                                        }) })] }) }) }), _jsx("ul", { className: "md:hidden space-y-3", "aria-label": "Documents list", children: filtered.map((doc) => {
                            const typeCfg = DOC_TYPE_CONFIG[doc.type] || { label: doc.type, badge: "bg-slate-100 text-slate-600" };
                            const statusCfg = CONTRACT_STATUS_CONFIG[doc.contractStatus] || { label: doc.contractStatus, badge: "bg-slate-100 text-slate-600" };
                            return (_jsxs("li", { className: "bg-white rounded-xl border border-slate-200 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium text-slate-800 truncate", title: doc.name, children: doc.name }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [doc.mimeType.split("/")[1]?.toUpperCase(), " \u00B7 uploaded ", fmtDate(doc.createdAt)] })] }), _jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeCfg.badge}`, children: typeCfg.label })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-400", children: "Deal" }), _jsx("p", { className: "font-mono text-slate-700", children: doc.deal.dealNumber })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400", children: "Unit" }), _jsx("p", { className: "text-slate-700", children: doc.deal.unit.unitNumber })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("p", { className: "text-slate-400", children: "Buyer" }), _jsxs("p", { className: "text-slate-800 font-medium truncate", children: [doc.deal.lead.firstName, " ", doc.deal.lead.lastName] })] })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 pt-1", children: [_jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.badge}`, children: statusCfg.label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setStatusModal(doc), className: "text-xs font-medium px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors", children: "Update" }), _jsx("button", { onClick: () => setUploadDealId(doc.dealId), className: "text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors", children: "+ Upload" })] })] })] }, doc.id));
                        }) })] })), !loading && documents.length > 0 && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800 mb-3", children: "Document Type Summary" }), _jsx("div", { className: "flex flex-wrap gap-2", children: Object.entries(documents.reduce((acc, d) => {
                            const t = d.type;
                            if (!acc[t])
                                acc[t] = { total: 0, signed: 0 };
                            acc[t].total++;
                            if (d.contractStatus === "SIGNED")
                                acc[t].signed++;
                            return acc;
                        }, {})).map(([type, stats]) => {
                            const cfg = DOC_TYPE_CONFIG[type] || { label: type, badge: "bg-slate-100 text-slate-600" };
                            return (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50", children: [_jsx("span", { className: `text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge}`, children: cfg.label }), _jsxs("span", { className: "text-xs text-slate-500", children: [stats.total, " total"] }), _jsxs("span", { className: "text-xs text-emerald-600 font-medium", children: [stats.signed, " signed"] })] }, type));
                        }) })] })), statusModal && (_jsx(ContractStatusModal, { document: statusModal, onClose: () => setStatusModal(null), onSuccess: () => { setStatusModal(null); load(); } })), uploadDealId && (_jsx(DocumentUploadModal, { dealId: uploadDealId, onClose: () => setUploadDealId(null), onSaved: () => { setUploadDealId(null); load(); } }))] }));
}
