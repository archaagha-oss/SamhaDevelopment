import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import UnitGallery from "./UnitGallery";
import { formatArea } from "../utils/formatArea";
const STATUS_COLORS = {
    NOT_RELEASED: "bg-gray-100 text-gray-500",
    AVAILABLE: "bg-emerald-100 text-emerald-700",
    RESERVED: "bg-amber-100 text-amber-700",
    BOOKED: "bg-violet-100 text-violet-700",
    SOLD: "bg-red-100 text-red-700",
    BLOCKED: "bg-slate-200 text-slate-600",
    HANDED_OVER: "bg-teal-100 text-teal-700",
};
export default function UnitModal({ unit, statusLabels, agents = [], onClose, onRefresh, onEditUnit, onDeleted }) {
    const navigate = useNavigate();
    const [acting, setActing] = useState(false);
    const [error, setError] = useState(null);
    const [fullUnit, setFullUnit] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [blockReason, setBlockReason] = useState("");
    const [showBlockInput, setShowBlockInput] = useState(false);
    const [assigningAgent, setAssigningAgent] = useState(false);
    useEffect(() => {
        axios.get(`/api/units/${unit.id}`)
            .then((r) => setFullUnit(r.data))
            .catch((err) => {
            console.error("Failed to fetch unit:", err.response?.data || err.message);
            setError(`Failed to load unit details: ${err.response?.data?.error || err.message}`);
        });
    }, [unit.id]);
    const history = fullUnit?.statusHistory || [];
    const priceHistory = fullUnit?.priceHistory || [];
    const activeDeal = fullUnit?.deals?.[0];
    const activeReservation = fullUnit?.reservations?.[0];
    const currentUnit = fullUnit || unit;
    const updateStatus = async (newStatus, reason) => {
        setActing(true);
        setError(null);
        try {
            await axios.patch(`/api/units/${unit.id}/status`, { newStatus, reason });
            onRefresh?.();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || `Failed to set status to ${newStatus}`);
        }
        finally {
            setActing(false);
        }
    };
    const handleBlock = async () => {
        if (!blockReason.trim()) {
            setError("A reason is required to block a unit.");
            return;
        }
        await updateStatus("BLOCKED", blockReason.trim());
    };
    const handleDelete = async () => {
        setDeleting(true);
        setError(null);
        try {
            await axios.delete(`/api/units/${unit.id}`);
            onDeleted?.();
            onRefresh?.();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to delete unit");
            setConfirmDelete(false);
        }
        finally {
            setDeleting(false);
        }
    };
    const handleAssignAgent = async (agentId) => {
        setAssigningAgent(true);
        setError(null);
        try {
            await axios.patch(`/api/units/${unit.id}`, { assignedAgentId: agentId || null });
            onRefresh?.();
            setAssigningAgent(false);
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to assign agent");
            setAssigningAgent(false);
        }
    };
    const canRelease = currentUnit.status === "NOT_RELEASED";
    const canBlock = ["AVAILABLE", "NOT_RELEASED"].includes(currentUnit.status) && !showBlockInput;
    const canUnblock = currentUnit.status === "BLOCKED";
    const canEdit = ["AVAILABLE", "BLOCKED", "NOT_RELEASED"].includes(currentUnit.status);
    const canDelete = ["AVAILABLE", "NOT_RELEASED"].includes(currentUnit.status) && !activeDeal;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-lg font-bold text-slate-900", children: ["Unit ", currentUnit.unitNumber] }), _jsx("span", { className: `inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[currentUnit.status] || "bg-slate-100 text-slate-600"}`, children: statusLabels[currentUnit.status] || currentUnit.status })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), activeDeal && (_jsxs("div", { className: "mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer hover:bg-amber-100 transition-colors", onClick: () => navigate(`/deals/${activeDeal.id}`), children: [_jsx("p", { className: "text-xs font-semibold text-amber-800 mb-1", children: "Active Deal" }), _jsx("p", { className: "text-sm font-bold text-amber-900", children: activeDeal.dealNumber }), _jsxs("div", { className: "flex items-center justify-between mt-1", children: [_jsxs("p", { className: "text-xs text-amber-700", children: [activeDeal.lead.firstName, " ", activeDeal.lead.lastName] }), _jsxs("p", { className: "text-xs text-amber-700 font-medium", children: ["AED ", activeDeal.salePrice.toLocaleString()] })] }), _jsxs("p", { className: "text-xs text-amber-600 mt-0.5", children: [activeDeal.stage.replace(/_/g, " "), " \u2192"] })] })), activeReservation && !activeDeal && (_jsxs("div", { className: "mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3", children: [_jsx("p", { className: "text-xs font-semibold text-blue-800 mb-1", children: "Active Reservation" }), _jsxs("p", { className: "text-sm text-blue-800", children: [activeReservation.lead.firstName, " ", activeReservation.lead.lastName] }), _jsxs("p", { className: "text-xs text-blue-600 mt-0.5", children: ["Expires ", new Date(activeReservation.expiresAt).toLocaleDateString("en-AE")] })] })), fullUnit?.images && fullUnit.images.length > 0 ? (_jsx(UnitGallery, { images: fullUnit.images })) : (_jsxs("div", { className: "mx-6 mt-4 bg-slate-50 border border-slate-200 rounded-lg p-8 text-center", children: [_jsx("p", { className: "text-sm text-slate-500", children: "\uD83D\uDCF8 No images added yet" }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Images will appear here" })] })), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsx("div", { className: "grid grid-cols-2 gap-3", children: [
                                ["Type", currentUnit.type.replace(/_/g, " ")],
                                ["Floor", `Floor ${currentUnit.floor}`],
                                ["Area", formatArea(currentUnit.area)],
                                ["View", currentUnit.view],
                            ].map(([label, value]) => (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 mb-0.5", children: label }), _jsx("p", { className: "font-semibold text-slate-800 text-sm", children: value })] }, label))) }), _jsx("div", { className: "bg-slate-50 rounded-xl p-3 mt-1", children: _jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 mb-0.5", children: "Current Price" }), _jsxs("p", { className: "text-xl font-bold text-slate-900", children: ["AED ", currentUnit.price.toLocaleString("en-AE")] })] }), currentUnit.basePrice && currentUnit.basePrice !== currentUnit.price && (_jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-slate-400", children: "Base price" }), _jsxs("p", { className: "text-sm text-slate-500 line-through", children: ["AED ", currentUnit.basePrice.toLocaleString("en-AE")] })] }))] }) }), (currentUnit.pricePerSqft || (currentUnit.inquiryCount ?? 0) > 0 || (currentUnit.visitCount ?? 0) > 0) && (_jsxs("div", { className: "grid grid-cols-3 gap-3 mt-3", children: [currentUnit.pricePerSqft && (_jsxs("div", { className: "bg-blue-50 rounded-lg p-2.5 text-center", children: [_jsx("p", { className: "text-xs text-blue-600 mb-0.5", children: "Price / sqft" }), _jsxs("p", { className: "font-semibold text-blue-900", children: ["AED ", currentUnit.pricePerSqft.toLocaleString()] })] })), (currentUnit.inquiryCount ?? 0) > 0 && (_jsxs("div", { className: "bg-amber-50 rounded-lg p-2.5 text-center", children: [_jsx("p", { className: "text-xs text-amber-600 mb-0.5", children: "Inquiries" }), _jsx("p", { className: "font-semibold text-amber-900", children: currentUnit.inquiryCount })] })), (currentUnit.visitCount ?? 0) > 0 && (_jsxs("div", { className: "bg-emerald-50 rounded-lg p-2.5 text-center", children: [_jsx("p", { className: "text-xs text-emerald-600 mb-0.5", children: "Site Visits" }), _jsx("p", { className: "font-semibold text-emerald-900", children: currentUnit.visitCount })] }))] })), (currentUnit.bathrooms || currentUnit.parkingSpaces || currentUnit.internalArea || currentUnit.externalArea) && (_jsxs("div", { className: "bg-slate-50 rounded-lg p-3", children: [_jsx("p", { className: "text-xs font-semibold text-slate-600 mb-2", children: "Physical Details" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [currentUnit.bathrooms && _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Bathrooms:" }), " ", _jsx("span", { className: "font-semibold", children: currentUnit.bathrooms })] }), currentUnit.parkingSpaces && _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Parking:" }), " ", _jsx("span", { className: "font-semibold", children: currentUnit.parkingSpaces })] }), currentUnit.internalArea && _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Suite:" }), " ", _jsx("span", { className: "font-semibold", children: formatArea(currentUnit.internalArea) })] }), currentUnit.externalArea && _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Balcony:" }), " ", _jsx("span", { className: "font-semibold", children: formatArea(currentUnit.externalArea) })] })] })] })), currentUnit.tags && currentUnit.tags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: currentUnit.tags.map((tag) => (_jsx("span", { className: "text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full", children: tag }, tag))) })), currentUnit.blockReason && (_jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-lg p-3", children: [_jsx("p", { className: "text-xs font-semibold text-amber-800", children: "Block Reason" }), _jsx("p", { className: "text-sm text-amber-700 mt-1", children: currentUnit.blockReason }), currentUnit.blockExpiresAt && (_jsxs("p", { className: "text-xs text-amber-600 mt-1", children: ["Expires ", new Date(currentUnit.blockExpiresAt).toLocaleDateString("en-AE")] }))] })), currentUnit.internalNotes && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3", children: [_jsx("p", { className: "text-xs font-semibold text-blue-800", children: "Notes" }), _jsx("p", { className: "text-sm text-blue-700 mt-1", children: currentUnit.internalNotes })] })), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error }))] }), _jsxs("div", { className: "px-6 pb-4 space-y-2", children: [canEdit && onEditUnit && (_jsx("button", { onClick: () => { onEditUnit(currentUnit); onClose(); }, className: "w-full py-2 text-sm font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors", children: "Edit Unit" })), agents.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1.5", children: "Assign Agent" }), _jsxs("select", { value: currentUnit.assignedAgentId ?? "", onChange: (e) => handleAssignAgent(e.target.value), disabled: assigningAgent, className: "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-400 disabled:opacity-50", children: [_jsx("option", { value: "", children: "\u2014 Unassigned \u2014" }), agents.map((agent) => (_jsx("option", { value: agent.id, children: agent.name }, agent.id)))] })] })), canRelease && (_jsx("button", { onClick: () => updateStatus("AVAILABLE", "Released to market"), disabled: acting, className: "w-full py-2 text-sm font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50", children: acting ? "…" : "Release to Market" })), canBlock && !showBlockInput && (_jsx("button", { onClick: () => setShowBlockInput(true), className: "w-full py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors", children: "Block Unit" })), showBlockInput && (_jsxs("div", { className: "border border-red-200 rounded-lg p-3 bg-red-50 space-y-2", children: [_jsx("p", { className: "text-xs font-semibold text-red-800", children: "Reason for blocking *" }), _jsx("input", { autoFocus: true, value: blockReason, onChange: (e) => setBlockReason(e.target.value), placeholder: "e.g. Maintenance, Management hold\u2026", className: "w-full border border-red-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-red-400" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => { setShowBlockInput(false); setBlockReason(""); }, className: "flex-1 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50", children: "Cancel" }), _jsx("button", { onClick: handleBlock, disabled: acting || !blockReason.trim(), className: "flex-1 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50", children: acting ? "Blocking…" : "Confirm Block" })] })] })), canUnblock && (_jsx("button", { onClick: () => updateStatus("AVAILABLE", "Manually unblocked"), disabled: acting, className: "w-full py-2 text-sm font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50", children: acting ? "…" : "Make Available" })), canDelete && !confirmDelete && (_jsx("button", { onClick: () => setConfirmDelete(true), className: "w-full py-2 text-xs font-medium text-slate-400 hover:text-red-500 rounded-lg transition-colors", children: "Delete Unit" })), confirmDelete && (_jsxs("div", { className: "border border-red-200 rounded-lg p-3 bg-red-50", children: [_jsxs("p", { className: "text-xs text-red-700 mb-2", children: ["Delete unit ", currentUnit.unitNumber, "? This cannot be undone."] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setConfirmDelete(false), className: "flex-1 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50", children: "Cancel" }), _jsx("button", { onClick: handleDelete, disabled: deleting, className: "flex-1 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50", children: deleting ? "Deleting…" : "Confirm Delete" })] })] })), _jsx("button", { onClick: onClose, className: "w-full py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors", children: "Close" })] }), history.length > 0 && (_jsxs("div", { className: "px-6 pb-4", children: [_jsxs("button", { onClick: () => setHistoryOpen((o) => !o), className: "flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors", children: [_jsx("span", { className: `transition-transform ${historyOpen ? "rotate-90" : ""}`, children: "\u25B6" }), "Status History (", history.length, ")"] }), historyOpen && (_jsx("div", { className: "mt-2 space-y-1.5", children: history.map((h) => (_jsxs("div", { className: "text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[h.oldStatus] || "bg-slate-100 text-slate-500"}`, children: h.oldStatus.replace(/_/g, " ") }), _jsx("span", { className: "text-slate-400", children: "\u2192" }), _jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[h.newStatus] || "bg-slate-100 text-slate-500"}`, children: h.newStatus.replace(/_/g, " ") }), _jsx("span", { className: "text-slate-400 ml-auto shrink-0", children: new Date(h.changedAt).toLocaleDateString("en-AE") })] }), h.reason && _jsx("p", { className: "text-slate-400 mt-0.5 ml-0.5", children: h.reason })] }, h.id))) }))] })), priceHistory.length > 0 && (_jsxs("div", { className: "px-6 pb-5", children: [_jsxs("button", { onClick: () => setPriceHistoryOpen((o) => !o), className: "flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors", children: [_jsx("span", { className: `transition-transform ${priceHistoryOpen ? "rotate-90" : ""}`, children: "\u25B6" }), "Price History (", priceHistory.length, ")"] }), priceHistoryOpen && (_jsx("div", { className: "mt-2 space-y-1.5", children: priceHistory.map((p) => (_jsxs("div", { className: "text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { children: ["AED ", p.oldPrice.toLocaleString(), " \u2192 ", _jsxs("strong", { children: ["AED ", p.newPrice.toLocaleString()] })] }), _jsx("span", { className: "text-slate-400", children: new Date(p.changedAt).toLocaleDateString("en-AE") })] }), p.reason && _jsx("p", { className: "text-slate-400 mt-0.5", children: p.reason })] }, p.id))) }))] }))] }) }));
}
