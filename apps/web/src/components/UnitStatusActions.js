import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { toast } from "sonner";
import { useChangeStatus } from "../hooks/useUpdateUnit";
import { ErrorType } from "../types/errors";
const DEAL_OWNED = ["ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];
const STATUS_DISPLAY = {
    NOT_RELEASED: { label: "Not Released", color: "bg-gray-100 text-gray-700 border-gray-200" },
    AVAILABLE: { label: "Available", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    ON_HOLD: { label: "On Hold", color: "bg-orange-100 text-orange-700 border-orange-200" },
    RESERVED: { label: "Reserved", color: "bg-amber-100 text-amber-700 border-amber-200" },
    BOOKED: { label: "Booked", color: "bg-violet-100 text-violet-700 border-violet-200" },
    SOLD: { label: "Sold", color: "bg-red-100 text-red-700 border-red-200" },
    BLOCKED: { label: "Blocked", color: "bg-slate-200 text-slate-600 border-slate-300" },
    HANDED_OVER: { label: "Handed Over", color: "bg-teal-100 text-teal-700 border-teal-200" },
};
const FORM_CONFIG = {
    RELEASE: {
        title: "Release to market",
        helper: "Adds this unit to the public inventory. Sales agents will be able to reserve and book it.",
        placeholder: "e.g. Phase 1 launch — released after final pricing review",
        newStatus: "AVAILABLE",
        confirmLabel: "Release unit",
        confirmTone: "bg-emerald-600 hover:bg-emerald-700",
    },
    UNBLOCK: {
        title: "Unblock unit",
        helper: "Returns the unit to available inventory.",
        placeholder: "e.g. Legal review cleared, unit may be sold",
        newStatus: "AVAILABLE",
        confirmLabel: "Unblock unit",
        confirmTone: "bg-emerald-600 hover:bg-emerald-700",
    },
    BLOCK: {
        title: "Block unit",
        helper: "Removes the unit from available inventory until unblocked.",
        placeholder: "e.g. Pending legal review, structural inspection requested",
        newStatus: "BLOCKED",
        confirmLabel: "Block unit",
        confirmTone: "bg-amber-600 hover:bg-amber-700",
        destructive: true,
    },
    UNLIST: {
        title: "Unlist (move to Not Released)",
        helper: "Pulls the unit out of the released pool. Useful for soft-launch reshuffles.",
        placeholder: "e.g. Holding back for next release wave",
        newStatus: "NOT_RELEASED",
        confirmLabel: "Unlist unit",
        confirmTone: "bg-slate-700 hover:bg-slate-800",
    },
};
export default function UnitStatusActions({ unit, onError }) {
    const changeStatus = useChangeStatus(unit.id);
    const [formMode, setFormMode] = useState(null);
    const [reason, setReason] = useState("");
    const display = STATUS_DISPLAY[unit.status] || STATUS_DISPLAY.AVAILABLE;
    const isDealOwned = DEAL_OWNED.includes(unit.status);
    const closeForm = () => { setFormMode(null); setReason(""); };
    // ─── Undo: revert the just-applied status change ───
    const undo = async (originalStatus, reasonHint) => {
        try {
            await changeStatus.mutateAsync({ newStatus: originalStatus, reason: `Undo: ${reasonHint}` });
            toast.success("Reverted");
        }
        catch (err) {
            toast.error(err?.message || "Could not undo — see audit log");
        }
    };
    const submitForm = async () => {
        if (!formMode)
            return;
        const cfg = FORM_CONFIG[formMode];
        const trimmedReason = reason.trim();
        if (!trimmedReason)
            return; // button is disabled but defend anyway
        const previousStatus = unit.status;
        try {
            await changeStatus.mutateAsync({ newStatus: cfg.newStatus, reason: trimmedReason });
            closeForm();
            // 30-second undo toast
            toast(`${cfg.confirmLabel.replace("unit", "").trim()} — ${unit.unitNumber}`, {
                description: `Status changed to ${STATUS_DISPLAY[cfg.newStatus]?.label ?? cfg.newStatus}.`,
                duration: 30000,
                action: {
                    label: "Undo",
                    onClick: () => undo(previousStatus, trimmedReason),
                },
            });
        }
        catch (err) {
            onError({
                type: ErrorType.CONFLICT,
                message: err?.message || "Status change failed",
                code: 409,
            });
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-5 shadow-sm", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Status" }), _jsx("div", { className: `inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-semibold mb-4 ${display.color}`, children: display.label }), isDealOwned ? (_jsxs("div", { className: `text-xs rounded-lg px-3 py-2 border ${unit.status === "ON_HOLD" ? "bg-orange-50 border-orange-100 text-orange-700" : "bg-slate-50 border-slate-100 text-slate-500"}`, children: [_jsx("span", { className: "font-medium", children: unit.status === "ON_HOLD" ? "On Hold — Offer Pending" : "Managed by deal system" }), unit.status === "ON_HOLD" && unit.holdExpiresAt ? (_jsxs("p", { className: "mt-0.5", children: ["Hold expires ", new Date(unit.holdExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), "."] })) : (_jsx("p", { className: "mt-0.5", children: "Status changes are controlled by the active deal." }))] })) : !formMode ? (_jsxs("div", { className: "space-y-2", children: [unit.status === "NOT_RELEASED" && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { setFormMode("RELEASE"); setReason(""); }, disabled: changeStatus.isPending, className: "w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50", children: "Release to market \u2192" }), _jsx("button", { onClick: () => { setFormMode("BLOCK"); setReason(""); }, disabled: changeStatus.isPending, className: "w-full px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50", children: "Block unit" })] })), unit.status === "AVAILABLE" && (_jsx("button", { onClick: () => { setFormMode("BLOCK"); setReason(""); }, disabled: changeStatus.isPending, className: "w-full px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-medium rounded-lg transition-colors disabled:opacity-50", children: "Block unit" })), unit.status === "BLOCKED" && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { setFormMode("UNBLOCK"); setReason(""); }, disabled: changeStatus.isPending, className: "w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50", children: "Unblock \u2014 make available" }), _jsx("button", { onClick: () => { setFormMode("UNLIST"); setReason(""); }, disabled: changeStatus.isPending, className: "w-full px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50", children: "Unlist (Not Released)" })] }))] })) : (
            // Confirmation + reason form (replaces the action buttons until cancelled)
            _jsxs("div", { className: "space-y-3 border-t border-slate-100 pt-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: FORM_CONFIG[formMode].title }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: FORM_CONFIG[formMode].helper })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-slate-600", children: "Reason (required for audit)" }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), placeholder: FORM_CONFIG[formMode].placeholder, rows: 2, autoFocus: true, className: "mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: submitForm, disabled: !reason.trim() || changeStatus.isPending, className: `flex-1 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${FORM_CONFIG[formMode].confirmTone}`, children: changeStatus.isPending ? "Working…" : FORM_CONFIG[formMode].confirmLabel }), _jsx("button", { onClick: closeForm, disabled: changeStatus.isPending, className: "px-3 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50", children: "Cancel" })] })] }))] }));
}
