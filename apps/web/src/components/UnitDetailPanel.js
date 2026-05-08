import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from "react";
import { getStatusColor } from "../utils/statusColors";
import axios from "axios";
import { toast } from "sonner";
import CreateOfferModal from "./CreateOfferModal";
const STATUS_LABELS = {
    NOT_RELEASED: "Not Released",
    AVAILABLE: "Available",
    ON_HOLD: "On Hold",
    RESERVED: "Reserved",
    BOOKED: "Booked",
    SOLD: "Sold",
    BLOCKED: "Blocked",
    HANDED_OVER: "Handed Over",
};
const UNIT_TYPE_LABELS = {
    STUDIO: "Studio",
    ONE_BR: "1 Bedroom",
    TWO_BR: "2 Bedroom",
    THREE_BR: "3 Bedroom",
    FOUR_BR: "4 Bedroom",
    COMMERCIAL: "Commercial",
};
export default function UnitDetailPanel({ unit, isOpen, onClose, onCreateOffer, onViewDeal, }) {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const statusColor = getStatusColor(unit.status);
    React.useEffect(() => {
        if (isOpen && unit.id) {
            loadHistory();
        }
    }, [isOpen, unit.id]);
    const loadHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await axios.get(`/api/units/${unit.id}/history`);
            setHistory(response.data.data || []);
        }
        catch (error) {
            console.error("Failed to load unit history:", error);
        }
        finally {
            setLoadingHistory(false);
        }
    };
    const pricePerSqft = unit.area ? Math.round(unit.price / unit.area) : 0;
    const handleReleaseHold = async () => {
        try {
            await axios.patch(`/api/units/${unit.id}`, {
                status: "AVAILABLE",
                holdExpiresAt: null,
            });
            toast.success("Hold released");
            onClose();
        }
        catch (error) {
            toast.error("Failed to release hold");
        }
    };
    // Determine available actions based on status
    const actionButtons = [];
    if (unit.status === "AVAILABLE") {
        actionButtons.push(_jsx("button", { onClick: () => setShowOfferModal(true), className: "px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition", children: "Create Offer" }, "offer"));
    }
    if (["RESERVED", "SOLD", "BOOKED"].includes(unit.status)) {
        const deal = unit.deals?.[0];
        if (deal) {
            actionButtons.push(_jsx("button", { onClick: () => onViewDeal?.(deal.id), className: "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition", children: "View Deal" }, "deal"));
        }
    }
    if (unit.status === "ON_HOLD") {
        actionButtons.push(_jsx("button", { onClick: handleReleaseHold, className: "px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition", children: "Release Hold" }, "release"));
    }
    return (_jsxs(_Fragment, { children: [isOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity", onClick: onClose })), _jsxs("div", { className: `fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 overflow-y-auto ${isOpen ? "translate-x-0" : "translate-x-full"}`, children: [_jsxs("div", { className: "sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-bold text-slate-900", children: ["Unit ", unit.unitNumber] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "p-6 space-y-6", children: [_jsx("div", { className: `inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColor.badge}`, children: STATUS_LABELS[unit.status] || unit.status }), _jsxs("div", { className: "bg-slate-50 rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Type:" }), _jsx("span", { className: "text-sm font-medium text-slate-900", children: UNIT_TYPE_LABELS[unit.type] || unit.type })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Floor:" }), _jsx("span", { className: "text-sm font-medium text-slate-900", children: unit.floor })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Area:" }), _jsxs("span", { className: "text-sm font-medium text-slate-900", children: [unit.area.toFixed(2), " sqft"] })] }), _jsxs("div", { className: "flex justify-between border-t border-slate-200 pt-3", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Price:" }), _jsxs("span", { className: "text-sm font-bold text-slate-900", children: ["AED ", unit.price.toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Price/sqft:" }), _jsxs("span", { className: "text-sm font-medium text-slate-900", children: ["AED ", pricePerSqft.toLocaleString()] })] }), unit.parkingSpaces !== undefined && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Parking Spaces:" }), _jsx("span", { className: "text-sm font-medium text-slate-900", children: unit.parkingSpaces })] }))] }), history.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-3", children: "Status History" }), _jsx("div", { className: "space-y-2", children: history.map((entry) => (_jsxs("div", { className: "flex items-start gap-3 pb-3 border-b border-slate-200 last:border-b-0", children: [_jsx("div", { className: "flex-shrink-0 mt-1", children: _jsx("div", { className: "w-2 h-2 rounded-full bg-slate-400" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("p", { className: "text-xs text-slate-600", children: [STATUS_LABELS[entry.oldStatus] || entry.oldStatus, " \u2192", " ", STATUS_LABELS[entry.newStatus] || entry.newStatus] }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: new Date(entry.changedAt).toLocaleString() }), entry.reason && (_jsx("p", { className: "text-xs text-slate-600 mt-1", children: entry.reason }))] })] }, entry.id))) })] })), loadingHistory && (_jsx("div", { className: "text-center py-4", children: _jsx("p", { className: "text-xs text-slate-500", children: "Loading history..." }) })), history.length === 0 && !loadingHistory && (_jsx("p", { className: "text-xs text-slate-500", children: "No status history available." })), actionButtons.length > 0 && (_jsx("div", { className: "space-y-2 pt-4 border-t border-slate-200", children: actionButtons }))] })] }), _jsx(CreateOfferModal, { isOpen: showOfferModal, onClose: () => setShowOfferModal(false), unitId: unit.id, unitNumber: unit.unitNumber, unitPrice: unit.price, unitArea: unit.area, onOfferCreated: (offerId, dealId) => {
                    setShowOfferModal(false);
                    if (dealId) {
                        onViewDeal?.(dealId);
                    }
                } })] }));
}
