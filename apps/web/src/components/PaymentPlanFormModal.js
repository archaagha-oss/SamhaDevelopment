import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
const TRIGGER_TYPES = [
    { value: "DAYS_FROM_RESERVATION", label: "Days from Reservation" },
    { value: "FIXED_DATE", label: "Fixed Calendar Date" },
    { value: "ON_SPA_SIGNING", label: "On SPA Signing" },
    { value: "ON_OQOOD", label: "On Oqood Registration" },
    { value: "ON_HANDOVER", label: "On Handover" },
];
const BLANK_MILESTONE = {
    label: "", percentage: "", triggerType: "DAYS_FROM_RESERVATION",
    isDLDFee: false, isAdminFee: false, daysFromReservation: "", fixedDate: "", sortOrder: 0,
    targetAccount: "ESCROW",
};
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
export default function PaymentPlanFormModal({ plan, onClose, onSaved }) {
    const isEdit = !!plan;
    const [name, setName] = useState(plan?.name ?? "");
    const [description, setDescription] = useState(plan?.description ?? "");
    const [milestones, setMilestones] = useState(() => plan?.milestones?.length
        ? plan.milestones.map((m) => ({
            id: m.id,
            label: m.label,
            percentage: String(m.percentage),
            triggerType: m.triggerType || "DAYS_FROM_RESERVATION",
            isDLDFee: m.isDLDFee,
            isAdminFee: m.isAdminFee,
            daysFromReservation: m.daysFromReservation != null ? String(m.daysFromReservation) : "",
            fixedDate: m.fixedDate ? m.fixedDate.split("T")[0] : "",
            sortOrder: m.sortOrder,
            targetAccount: m.targetAccount ?? "ESCROW",
        }))
        : [{ ...BLANK_MILESTONE, sortOrder: 1 }]);
    const [previewPrice, setPreviewPrice] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const totalPct = milestones.reduce((s, m) => s + (parseFloat(m.percentage) || 0), 0);
    const previewNum = parseFloat(previewPrice.replace(/,/g, "")) || 0;
    const addMilestone = () => {
        setMilestones((ms) => [...ms, { ...BLANK_MILESTONE, sortOrder: ms.length + 1 }]);
    };
    const removeMilestone = (i) => {
        setMilestones((ms) => ms.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sortOrder: idx + 1 })));
    };
    const updateMilestone = (i, key, val) => {
        setMilestones((ms) => ms.map((m, idx) => idx === i ? { ...m, [key]: val } : m));
    };
    const moveMilestone = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= milestones.length)
            return;
        setMilestones((ms) => {
            const next = [...ms];
            [next[i], next[j]] = [next[j], next[i]];
            return next.map((m, idx) => ({ ...m, sortOrder: idx + 1 }));
        });
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (Math.abs(totalPct - 100) > 0.01) {
            setError(`Milestone percentages must sum to 100% (currently ${totalPct.toFixed(2)}%)`);
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                milestones: milestones.map((m, i) => ({
                    label: m.label.trim(),
                    percentage: parseFloat(m.percentage),
                    triggerType: m.triggerType,
                    isDLDFee: m.isDLDFee,
                    isAdminFee: m.isAdminFee,
                    daysFromReservation: m.triggerType === "DAYS_FROM_RESERVATION" && m.daysFromReservation
                        ? parseInt(m.daysFromReservation) : undefined,
                    fixedDate: m.triggerType === "FIXED_DATE" && m.fixedDate ? m.fixedDate : undefined,
                    sortOrder: i + 1,
                    targetAccount: m.targetAccount,
                })),
            };
            if (isEdit) {
                await axios.patch(`/api/payment-plans/${plan.id}`, { name: payload.name, description: payload.description });
                toast.success("Payment plan updated");
            }
            else {
                await axios.post("/api/payment-plans", payload);
                toast.success("Payment plan created");
            }
            onSaved();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save plan");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsx("h2", { className: "font-bold text-slate-900 text-lg", children: isEdit ? "Edit Payment Plan" : "New Payment Plan" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { id: "plan-form", onSubmit: handleSubmit, className: "overflow-y-auto flex-1 px-6 py-4 space-y-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Plan Name *" }), _jsx("input", { required: true, value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. 60/40 Post-Handover", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Description" }), _jsx("input", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Optional description\u2026", className: inp })] })] }), _jsxs("div", { className: "flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500 whitespace-nowrap", children: "Preview at sale price AED" }), _jsx("input", { type: "number", step: "1000", min: "0", placeholder: "e.g. 1500000", value: previewPrice, onChange: (e) => setPreviewPrice(e.target.value), className: "flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400" }), _jsxs("span", { className: `text-xs font-bold px-2 py-1 rounded ${Math.abs(totalPct - 100) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`, children: ["Total: ", totalPct.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Milestones" }), isEdit && (_jsx("p", { className: "text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded", children: "Milestone structure cannot be changed on existing plans. Clone to create a new version." }))] }), _jsx("div", { className: "space-y-2", children: milestones.map((m, i) => {
                                        const estimatedAmt = previewNum > 0 ? (previewNum * (parseFloat(m.percentage) || 0) / 100) : null;
                                        return (_jsxs("div", { className: "border border-slate-200 rounded-lg overflow-hidden", children: [_jsxs("div", { className: "bg-slate-50 px-4 py-2.5 flex items-center gap-3", children: [_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("button", { type: "button", onClick: () => moveMilestone(i, -1), disabled: i === 0 || isEdit, className: "text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none", children: "\u25B2" }), _jsx("button", { type: "button", onClick: () => moveMilestone(i, 1), disabled: i === milestones.length - 1 || isEdit, className: "text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none", children: "\u25BC" })] }), _jsx("span", { className: "text-xs font-bold text-slate-400 w-4", children: i + 1 }), _jsx("input", { required: true, disabled: isEdit, value: m.label, onChange: (e) => updateMilestone(i, "label", e.target.value), placeholder: "Milestone label\u2026", className: "flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-slate-800 disabled:opacity-60" }), estimatedAmt !== null && (_jsxs("span", { className: "text-xs text-slate-500 font-medium whitespace-nowrap", children: ["\u2248 AED ", estimatedAmt.toLocaleString("en-AE", { maximumFractionDigits: 0 })] })), !isEdit && (_jsx("button", { type: "button", onClick: () => removeMilestone(i), className: "text-red-400 hover:text-red-600 text-sm px-1 transition-colors", children: "\u00D7" }))] }), _jsxs("div", { className: "px-4 py-3 grid grid-cols-4 gap-3 items-start", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Percentage *" }), _jsxs("div", { className: "relative", children: [_jsx("input", { required: true, type: "number", step: "0.01", min: "0", max: "100", disabled: isEdit, value: m.percentage, onChange: (e) => updateMilestone(i, "percentage", e.target.value), className: `${inp} pr-6 disabled:opacity-60` }), _jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm", children: "%" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Due Date Trigger" }), _jsx("select", { disabled: isEdit, value: m.triggerType, onChange: (e) => updateMilestone(i, "triggerType", e.target.value), className: `${inp} disabled:opacity-60`, children: TRIGGER_TYPES.map((t) => _jsx("option", { value: t.value, children: t.label }, t.value)) })] }), _jsxs("div", { children: [m.triggerType === "DAYS_FROM_RESERVATION" && (_jsxs(_Fragment, { children: [_jsx("label", { className: lbl, children: "Days from Reservation" }), _jsx("input", { required: true, type: "number", min: "0", disabled: isEdit, value: m.daysFromReservation, onChange: (e) => updateMilestone(i, "daysFromReservation", e.target.value), placeholder: "e.g. 30", className: `${inp} disabled:opacity-60` })] })), m.triggerType === "FIXED_DATE" && (_jsxs(_Fragment, { children: [_jsx("label", { className: lbl, children: "Calendar Date *" }), _jsx("input", { required: true, type: "date", disabled: isEdit, value: m.fixedDate, onChange: (e) => updateMilestone(i, "fixedDate", e.target.value), className: `${inp} disabled:opacity-60` })] })), ["ON_SPA_SIGNING", "ON_OQOOD", "ON_HANDOVER"].includes(m.triggerType) && (_jsx("div", { className: "mt-4 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed", children: "Due date set automatically when deal reaches this milestone" }))] }), _jsxs("div", { className: "flex flex-col justify-start gap-2 pt-5", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", disabled: isEdit, checked: m.isDLDFee, onChange: (e) => updateMilestone(i, "isDLDFee", e.target.checked), className: "w-3.5 h-3.5 rounded border-slate-300 disabled:opacity-60" }), _jsx("span", { className: "text-xs text-slate-600", children: "DLD Fee" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", disabled: isEdit, checked: m.isAdminFee, onChange: (e) => updateMilestone(i, "isAdminFee", e.target.checked), className: "w-3.5 h-3.5 rounded border-slate-300 disabled:opacity-60" }), _jsx("span", { className: "text-xs text-slate-600", children: "Admin Fee" })] }), _jsxs("div", { className: "pt-1", children: [_jsx("label", { className: "block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5", children: "Account" }), _jsxs("select", { disabled: isEdit, value: m.targetAccount, onChange: (e) => updateMilestone(i, "targetAccount", e.target.value), className: "text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 disabled:opacity-60", children: [_jsx("option", { value: "ESCROW", children: "Escrow" }), _jsx("option", { value: "CORPORATE", children: "Corporate" })] })] })] })] })] }, i));
                                    }) }), !isEdit && (_jsx("button", { type: "button", onClick: addMilestone, className: "mt-2 w-full py-2.5 border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-colors", children: "+ Add Milestone" }))] }), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg", children: error }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors", children: "Cancel" }), _jsx("button", { form: "plan-form", type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50", children: submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Plan" })] })] }) }));
}
