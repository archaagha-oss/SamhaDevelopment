import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useDeals } from "../hooks/useDeals";
import DealFormModal from "./DealFormModal";
import DealEditModal from "./DealEditModal";
import EmptyState from "./EmptyState";
import Breadcrumbs from "./Breadcrumbs";
import { SkeletonTableRows } from "./Skeleton";
import { IconChevronUp, IconChevronDown, IconChevronsUpDown, IconChevronLeft, IconChevronRight } from "./Icons";
const STAGES = ["RESERVATION_PENDING", "RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT", "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED", "CANCELLED"];
const STAGE_BADGE = {
    RESERVATION_PENDING: "bg-slate-100 text-slate-600",
    RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
    SPA_PENDING: "bg-yellow-100 text-yellow-700",
    SPA_SENT: "bg-yellow-100 text-yellow-700",
    SPA_SIGNED: "bg-violet-100 text-violet-700",
    OQOOD_PENDING: "bg-orange-100 text-orange-700",
    OQOOD_REGISTERED: "bg-teal-100 text-teal-700",
    INSTALLMENTS_ACTIVE: "bg-indigo-100 text-indigo-700",
    HANDOVER_PENDING: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
};
const COM_BADGE = {
    NOT_DUE: "text-slate-400", PENDING_APPROVAL: "text-amber-600 font-semibold",
    APPROVED: "text-blue-600 font-semibold", PAID: "text-emerald-600 font-semibold",
    CANCELLED: "text-red-500",
};
function paymentProgress(deal) {
    if (!deal.payments?.length)
        return 0;
    return Math.round(deal.payments.filter((p) => p.status === "PAID").length / deal.payments.length * 100);
}
export default function DealsPage({ onViewDeal } = {}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showNewDeal, setShowNewDeal] = useState(false);
    const [selectedStage, setSelectedStage] = useState(searchParams.get("stage"));
    const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");
    const debounceRef = useRef();
    const [sortCol, setSortCol] = useState(searchParams.get("sort") || "reservationDate");
    const [sortDir, setSortDir] = useState(searchParams.get("dir") || "desc");
    const [editDeal, setEditDeal] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [cancelingId, setCancelingId] = useState(null);
    const [cancelDeal, setCancelDeal] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    // Debounce search input 350ms before firing API call
    const handleSearch = (val) => {
        setSearch(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setCurrentPage(1);
        }, 350);
    };
    const { data: dealsResponse, isLoading } = useDeals(currentPage, 50, selectedStage, debouncedSearch || undefined);
    const deals = (dealsResponse?.data || []);
    const totalPages = dealsResponse?.pagination.pages || 1;
    const total = dealsResponse?.pagination.total || 0;
    useEffect(() => { setCurrentPage(1); }, [selectedStage]);
    // Sync filters → URL
    useEffect(() => {
        const p = {};
        if (debouncedSearch)
            p.q = debouncedSearch;
        if (selectedStage)
            p.stage = selectedStage;
        if (currentPage > 1)
            p.page = String(currentPage);
        if (sortCol !== "reservationDate")
            p.sort = sortCol;
        if (sortDir !== "desc")
            p.dir = sortDir;
        setSearchParams(p, { replace: true });
    }, [debouncedSearch, selectedStage, currentPage, sortCol, sortDir]);
    const handleSort = (col) => {
        if (sortCol === col)
            setSortDir((d) => d === "asc" ? "desc" : "asc");
        else {
            setSortCol(col);
            setSortDir("asc");
        }
    };
    const colAccessor = {
        dealNumber: (d) => d.dealNumber,
        buyer: (d) => `${d.lead.firstName} ${d.lead.lastName}`,
        unit: (d) => d.unit.unitNumber,
        stage: (d) => d.stage,
        salePrice: (d) => d.salePrice,
        reservationDate: (d) => d.reservationDate,
    };
    const sorted = [...deals].sort((a, b) => {
        const av = colAccessor[sortCol]?.(a) ?? "";
        const bv = colAccessor[sortCol]?.(b) ?? "";
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
    });
    const SortIcon = ({ col }) => (_jsx("span", { className: `ml-1 inline-flex items-center align-middle ${sortCol === col ? "text-slate-700" : "text-slate-300"}`, "aria-hidden": "true", children: sortCol === col
            ? (sortDir === "asc" ? _jsx(IconChevronUp, { size: 12 }) : _jsx(IconChevronDown, { size: 12 }))
            : _jsx(IconChevronsUpDown, { size: 12 }) }));
    const performCancel = async () => {
        if (!cancelDeal)
            return;
        const reason = cancelReason.trim();
        if (!reason) {
            toast.error("A cancel reason is required");
            return;
        }
        setCancelingId(cancelDeal.id);
        try {
            await axios.patch(`/api/deals/${cancelDeal.id}/stage`, { newStage: "CANCELLED", reason });
            toast.success("Deal cancelled");
            queryClient.invalidateQueries({ queryKey: ["deals"] });
            setCancelDeal(null);
            setCancelReason("");
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to cancel deal");
        }
        finally {
            setCancelingId(null);
        }
    };
    const filtered = sorted;
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-4 sm:px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsx(Breadcrumbs, { variant: "light", className: "mb-2", crumbs: [{ label: "Home", path: "/" }, { label: "Deals" }] }), _jsxs("div", { className: "flex items-center justify-between mb-3 gap-3 flex-wrap", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Deals" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [total, " deals ", selectedStage ? `· ${selectedStage.replace(/_/g, " ")}` : "· all stages"] })] }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial sm:justify-end min-w-0", children: [_jsx("input", { type: "text", placeholder: "Search deal, buyer, unit\u2026", value: search, onChange: (e) => handleSearch(e.target.value), "aria-label": "Search deals", className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 flex-1 sm:flex-initial sm:w-56 focus:outline-none focus:border-blue-400 bg-slate-50 min-w-0" }), _jsxs("button", { onClick: () => setShowNewDeal(true), className: "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0", children: [_jsx("span", { className: "text-base leading-none", "aria-hidden": "true", children: "+" }), _jsx("span", { className: "hidden sm:inline", children: "New Deal" }), _jsx("span", { className: "sm:hidden", children: "New" })] })] })] }), _jsxs("div", { className: "flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 scrollbar-thin pb-1", role: "tablist", "aria-label": "Filter by stage", children: [_jsx("button", { onClick: () => setSelectedStage(null), role: "tab", "aria-selected": !selectedStage, className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${!selectedStage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: "All" }), STAGES.map((s) => (_jsx("button", { onClick: () => setSelectedStage(s === selectedStage ? null : s), role: "tab", "aria-selected": selectedStage === s, className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${selectedStage === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: s.replace(/_/g, " ") }, s)))] })] }), _jsx("div", { className: "flex-1 overflow-auto scrollbar-thin", children: _jsxs("table", { className: "w-full text-sm min-w-[800px]", children: [_jsx("thead", { className: "sticky top-0 bg-slate-50 border-b border-slate-200 z-10", children: _jsx("tr", { children: [
                                    { label: "Deal #", col: "dealNumber" },
                                    { label: "Buyer", col: "buyer" },
                                    { label: "Unit", col: "unit" },
                                    { label: "Stage", col: "stage" },
                                    { label: "Sale Price", col: "salePrice" },
                                    { label: "Payments", col: null },
                                    { label: "Commission", col: null },
                                    { label: "", col: null },
                                ].map(({ label, col }) => (_jsxs("th", { onClick: col ? () => handleSort(col) : undefined, className: `text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${col ? "cursor-pointer hover:text-slate-800 select-none" : ""}`, "aria-sort": col && sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : undefined, children: [label, col && _jsx(SortIcon, { col: col })] }, label || "actions"))) }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: isLoading ? (_jsx(SkeletonTableRows, { rows: 6, cols: 8 })) : (filtered.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, children: _jsx(EmptyState, { icon: "\u25C8", title: debouncedSearch || selectedStage ? "No deals match your filters" : "No deals yet", description: debouncedSearch || selectedStage ? "Try adjusting your search or stage filter." : "Create your first deal to get started.", action: !debouncedSearch && !selectedStage ? { label: "New Deal", onClick: () => setShowNewDeal(true) } : undefined }) }) })) : (filtered.map((deal) => {
                                const pct = paymentProgress(deal);
                                const isMenuOpen = openMenuId === deal.id;
                                return (_jsxs("tr", { onClick: () => onViewDeal ? onViewDeal(deal.id) : navigate(`/deals/${deal.id}`), className: "hover:bg-blue-50/50 cursor-pointer transition-colors group", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-500", children: deal.dealNumber }), _jsx("td", { className: "px-4 py-3", children: _jsxs("p", { className: "font-semibold text-slate-800 group-hover:text-blue-600 transition-colors", children: [deal.lead.firstName, " ", deal.lead.lastName] }) }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium text-slate-700", children: deal.unit.unitNumber }), _jsx("p", { className: "text-xs text-slate-400", children: deal.unit.type })] }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`, children: deal.stage.replace(/_/g, " ") }) }), _jsxs("td", { className: "px-4 py-3", children: [_jsxs("p", { className: "font-semibold text-slate-800", children: ["AED ", deal.salePrice.toLocaleString()] }), deal.discount > 0 && _jsxs("p", { className: "text-xs text-emerald-600", children: ["-", deal.discount.toLocaleString()] })] }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-blue-500 rounded-full", style: { width: `${pct}%` } }) }), _jsxs("span", { className: "text-xs text-slate-500", children: [pct, "%"] })] }) }), _jsx("td", { className: "px-4 py-3", children: deal.commission ? (_jsx("span", { className: `text-xs ${COM_BADGE[deal.commission.status] || "text-slate-500"}`, children: deal.commission.status.replace(/_/g, " ") })) : _jsx("span", { className: "text-xs text-slate-300", children: "\u2014" }) }), _jsxs("td", { className: "px-2 py-3 relative", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { onClick: () => setOpenMenuId(isMenuOpen ? null : deal.id), "aria-label": `Actions for deal ${deal.dealNumber}`, "aria-haspopup": "menu", "aria-expanded": isMenuOpen, className: "p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400", children: "\u22EE" }), isMenuOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setOpenMenuId(null) }), _jsxs("div", { className: "absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1", children: [_jsx("button", { onClick: () => { setOpenMenuId(null); navigate(`/deals/${deal.id}`); }, className: "w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50", children: "View Details" }), _jsx("button", { onClick: () => { setOpenMenuId(null); setEditDeal(deal); }, className: "w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50", children: "Edit Deal" }), deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (_jsx("button", { onClick: () => { setOpenMenuId(null); setCancelDeal(deal); setCancelReason(""); }, disabled: cancelingId === deal.id, className: "w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50", children: "Cancel Deal" }))] })] }))] })] }, deal.id));
                            }))) })] }) }), _jsxs("nav", { className: "flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex-shrink-0", "aria-label": "Deals pagination", children: [_jsxs("p", { className: "text-xs text-slate-500", children: ["Page ", _jsx("span", { className: "font-medium text-slate-700", children: currentPage }), " of ", _jsx("span", { className: "font-medium text-slate-700", children: totalPages }), " \u00B7 ", total, " deals"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => setCurrentPage((p) => Math.max(1, p - 1)), disabled: currentPage === 1, "aria-label": "Previous page", className: "px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1", children: [_jsx(IconChevronLeft, { size: 12, "aria-hidden": "true" }), _jsx("span", { children: "Prev" })] }), _jsxs("label", { className: "text-xs text-slate-500 flex items-center gap-1.5", children: [_jsx("span", { className: "hidden sm:inline", children: "Go to" }), _jsx("input", { type: "number", min: 1, max: totalPages, value: currentPage, onChange: (e) => {
                                            const v = Number(e.target.value);
                                            if (!Number.isNaN(v) && v >= 1 && v <= totalPages)
                                                setCurrentPage(v);
                                        }, className: "w-14 px-2 py-1 text-xs border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-blue-400", "aria-label": "Jump to page" })] }), _jsxs("button", { onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, "aria-label": "Next page", className: "px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1", children: [_jsx("span", { children: "Next" }), _jsx(IconChevronRight, { size: 12, "aria-hidden": "true" })] })] })] }), showNewDeal && (_jsx(DealFormModal, { onClose: () => setShowNewDeal(false), onCreated: () => {
                    queryClient.invalidateQueries({ queryKey: ["deals"] });
                    setShowNewDeal(false);
                } })), editDeal && (_jsx(DealEditModal, { deal: editDeal, onClose: () => setEditDeal(null), onSaved: () => { setEditDeal(null); queryClient.invalidateQueries({ queryKey: ["deals"] }); } })), cancelDeal && (_jsx("div", { className: "fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4", onClick: () => { if (cancelingId)
                    return; setCancelDeal(null); setCancelReason(""); }, onKeyDown: (e) => { if (e.key === "Escape" && !cancelingId) {
                    setCancelDeal(null);
                    setCancelReason("");
                } }, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "cancel-deal-title", className: "bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "px-6 py-5", children: [_jsxs("h3", { id: "cancel-deal-title", className: "text-base font-semibold text-slate-900", children: ["Cancel deal ", cancelDeal.dealNumber, "?"] }), _jsx("p", { className: "mt-1.5 text-sm text-slate-600 leading-relaxed", children: "This will set the deal to CANCELLED. Provide a reason \u2014 it will be recorded on the deal's history." }), _jsx("textarea", { value: cancelReason, onChange: (e) => setCancelReason(e.target.value), placeholder: "e.g. Buyer changed mind, financing fell through, etc.", rows: 3, autoFocus: true, className: "mt-3 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" })] }), _jsxs("div", { className: "flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100", children: [_jsx("button", { onClick: () => { setCancelDeal(null); setCancelReason(""); }, disabled: !!cancelingId, className: "px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50", children: "Keep deal" }), _jsx("button", { onClick: performCancel, disabled: !cancelReason.trim() || !!cancelingId, className: "px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50", children: cancelingId ? "Cancelling…" : "Cancel deal" })] })] }) }))] }));
}
