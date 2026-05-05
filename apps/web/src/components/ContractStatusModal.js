import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import axios from "axios";
const STATUS_OPTIONS = [
    { value: "DRAFT", label: "Draft", description: "Document is being prepared, not yet sent to client", color: "text-slate-600" },
    { value: "SENT", label: "Sent", description: "Document has been sent to the client for signing", color: "text-blue-600" },
    { value: "SIGNED", label: "Signed", description: "Document has been signed by all parties", color: "text-emerald-600" },
    { value: "ARCHIVED", label: "Archived", description: "Document is archived (no longer active)", color: "text-slate-400" },
];
const TYPE_LABELS = {
    SPA: "Sales Purchase Agreement",
    OQOOD_CERTIFICATE: "RERA Registration (Oqood)",
    RESERVATION_FORM: "Reservation Form",
    PAYMENT_RECEIPT: "Payment Receipt",
    PASSPORT: "Passport",
    EMIRATES_ID: "Emirates ID",
    VISA: "Visa",
    MORTGAGE: "Mortgage Document",
    OTHER: "Other",
};
export default function ContractStatusModal({ document, onClose, onSuccess }) {
    const [selected, setSelected] = useState(document.contractStatus);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function submit() {
        if (selected === document.contractStatus) {
            onClose();
            return;
        }
        setError("");
        setLoading(true);
        try {
            await axios.patch(`/api/documents/${document.id}/status`, { contractStatus: selected });
            onSuccess();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to update status");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl w-full max-w-md", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-slate-900 text-sm", children: "Update Contract Status" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [document.deal.dealNumber, " \u00B7 ", document.deal.lead.firstName, " ", document.deal.lead.lastName, " \u00B7 ", document.deal.unit.unitNumber] })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-lg leading-none", children: "\u2715" })] }), _jsxs("div", { className: "px-6 py-3 bg-slate-50 border-b border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500", children: TYPE_LABELS[document.type] || document.type }), _jsx("p", { className: "text-sm font-medium text-slate-800 truncate", children: document.name })] }), _jsxs("div", { className: "px-6 py-5 space-y-2", children: [STATUS_OPTIONS.map((opt) => (_jsxs("label", { className: `flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selected === opt.value
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-100 hover:border-slate-300"}`, children: [_jsx("input", { type: "radio", name: "contractStatus", value: opt.value, checked: selected === opt.value, onChange: () => setSelected(opt.value), className: "mt-0.5 accent-blue-600" }), _jsxs("div", { children: [_jsx("p", { className: `text-sm font-semibold ${opt.color}`, children: opt.label }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: opt.description })] })] }, opt.value))), error && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700", children: error }))] }), _jsxs("div", { className: "flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-600 hover:text-slate-900", children: "Cancel" }), _jsx("button", { onClick: submit, disabled: loading, className: "px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors", children: loading ? "Saving..." : "Update Status" })] })] }) }));
}
