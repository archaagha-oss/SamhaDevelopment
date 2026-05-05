import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import axios from "axios";
const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "PDC", "CREDIT_CARD"];
const ACTION_TITLES = {
    MARK_PAID: "Mark as Paid",
    MARK_PDC: "Register PDC (Post-Dated Cheque)",
    PDC_CLEARED: "Confirm PDC Cleared",
    PDC_BOUNCED: "Mark PDC as Bounced",
    PARTIAL: "Record Partial Payment",
    ADJUST_DATE: "Adjust Due Date",
    ADJUST_AMOUNT: "Adjust Amount",
    WAIVE: "Waive Payment",
};
export default function PaymentActionModal({ payment, action, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Form state
    const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
    const [paidBy, setPaidBy] = useState("");
    const [notes, setNotes] = useState("");
    const [pdcNumber, setPdcNumber] = useState("");
    const [pdcBank, setPdcBank] = useState("");
    const [pdcDate, setPdcDate] = useState("");
    const [partialAmount, setPartialAmount] = useState("");
    const [newDueDate, setNewDueDate] = useState(payment.dueDate.slice(0, 10));
    const [reason, setReason] = useState("");
    const [newAmount, setNewAmount] = useState(String(payment.amount));
    async function submit() {
        setError("");
        setLoading(true);
        try {
            const base = `/api/payments/${payment.id}`;
            if (action === "MARK_PAID") {
                if (!paidBy.trim())
                    throw new Error("Paid By is required");
                await axios.patch(`${base}/paid`, { paidDate, paymentMethod, paidBy, notes: notes || undefined });
            }
            else if (action === "MARK_PDC") {
                await axios.patch(`${base}/pdc`, {
                    pdcNumber: pdcNumber || undefined,
                    pdcBank: pdcBank || undefined,
                    pdcDate: pdcDate || undefined,
                });
            }
            else if (action === "PDC_CLEARED") {
                await axios.patch(`${base}/pdc-cleared`);
            }
            else if (action === "PDC_BOUNCED") {
                await axios.patch(`${base}/pdc-bounced`);
            }
            else if (action === "PARTIAL") {
                const amt = parseFloat(partialAmount);
                if (!amt || amt <= 0)
                    throw new Error("Enter a valid amount");
                if (amt > payment.amount)
                    throw new Error(`Amount cannot exceed AED ${payment.amount.toLocaleString()}`);
                await axios.post(`${base}/partial`, { amount: amt, paymentMethod, notes: notes || undefined });
            }
            else if (action === "ADJUST_DATE") {
                if (!reason.trim())
                    throw new Error("Reason is required");
                await axios.patch(`${base}/adjust-date`, { newDueDate, reason });
            }
            else if (action === "ADJUST_AMOUNT") {
                if (!reason.trim())
                    throw new Error("Reason is required");
                const amt = parseFloat(newAmount);
                if (!amt || amt <= 0)
                    throw new Error("Enter a valid amount");
                await axios.patch(`${base}/adjust-amount`, { newAmount: amt, reason });
            }
            else if (action === "WAIVE") {
                if (!reason.trim())
                    throw new Error("Reason is required");
                await axios.patch(`${base}/waive`, { reason });
            }
            onSuccess();
        }
        catch (err) {
            setError(err.response?.data?.error || err.message || "An error occurred");
        }
        finally {
            setLoading(false);
        }
    }
    const isConfirmOnly = action === "PDC_CLEARED" || action === "PDC_BOUNCED";
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl w-full max-w-md", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-slate-900 text-sm", children: ACTION_TITLES[action] }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [payment.deal.dealNumber, " \u00B7 ", payment.deal.lead.firstName, " ", payment.deal.lead.lastName, " \u00B7 ", payment.deal.unit.unitNumber] })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-lg leading-none", children: "\u2715" })] }), _jsxs("div", { className: "px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-slate-500", children: payment.milestoneLabel }), _jsxs("span", { className: "text-sm font-bold text-slate-800", children: ["AED ", payment.amount.toLocaleString()] })] }), _jsxs("div", { className: "px-6 py-5 space-y-4", children: [isConfirmOnly && (_jsx("p", { className: "text-sm text-slate-600", children: action === "PDC_CLEARED"
                                ? "Confirm that the post-dated cheque has been cleared by the bank."
                                : "Mark this PDC as bounced. The payment will return to an actionable state." })), action === "MARK_PAID" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Paid Date *" }), _jsx("input", { type: "date", value: paidDate, onChange: (e) => setPaidDate(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Payment Method *" }), _jsx("select", { value: paymentMethod, onChange: (e) => setPaymentMethod(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: PAYMENT_METHODS.map((m) => _jsx("option", { children: m.replace(/_/g, " ") }, m)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Paid By *" }), _jsx("input", { type: "text", value: paidBy, onChange: (e) => setPaidBy(e.target.value), placeholder: "Name or reference", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), rows: 2, placeholder: "Optional", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] })), action === "MARK_PDC" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Cheque Number" }), _jsx("input", { type: "text", value: pdcNumber, onChange: (e) => setPdcNumber(e.target.value), placeholder: "e.g. 001234", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Bank" }), _jsx("input", { type: "text", value: pdcBank, onChange: (e) => setPdcBank(e.target.value), placeholder: "e.g. Emirates NBD", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Cheque Date" }), _jsx("input", { type: "date", value: pdcDate, onChange: (e) => setPdcDate(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] })), action === "PARTIAL" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Amount (AED) *" }), _jsx("input", { type: "number", value: partialAmount, onChange: (e) => setPartialAmount(e.target.value), placeholder: `Max: ${payment.amount.toLocaleString()}`, min: 1, max: payment.amount, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Payment Method" }), _jsx("select", { value: paymentMethod, onChange: (e) => setPaymentMethod(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: PAYMENT_METHODS.map((m) => _jsx("option", { children: m.replace(/_/g, " ") }, m)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), rows: 2, placeholder: "Optional", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] })), action === "ADJUST_DATE" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "New Due Date *" }), _jsx("input", { type: "date", value: newDueDate, onChange: (e) => setNewDueDate(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Reason *" }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), rows: 2, placeholder: "Why is the date being adjusted?", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] })), action === "ADJUST_AMOUNT" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "New Amount (AED) *" }), _jsx("input", { type: "number", value: newAmount, onChange: (e) => setNewAmount(e.target.value), min: 1, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Reason *" }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), rows: 2, placeholder: "Why is the amount being adjusted?", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] })), action === "WAIVE" && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Reason for waiving *" }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), rows: 3, placeholder: "Provide a clear reason for waiving this payment", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" })] })), error && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700", children: error }))] }), _jsxs("div", { className: "flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors", children: "Cancel" }), _jsx("button", { onClick: submit, disabled: loading, className: `px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${action === "WAIVE" || action === "PDC_BOUNCED"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"}`, children: loading ? "Processing..." : isConfirmOnly ? "Confirm" : "Submit" })] })] }) }));
}
