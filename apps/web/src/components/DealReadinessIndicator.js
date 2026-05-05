import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
const TYPE_LABELS = {
    SPA: "SPA",
    OQOOD_CERTIFICATE: "Oqood",
    RESERVATION_FORM: "Reservation Form",
    PAYMENT_RECEIPT: "Payment Receipt",
    PASSPORT: "Passport",
    EMIRATES_ID: "Emirates ID",
    VISA: "Visa",
    OTHER: "Other",
};
export default function DealReadinessIndicator({ dealId, targetStage, compact = false }) {
    const [requirements, setRequirements] = useState([]);
    const [allMet, setAllMet] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!dealId || !targetStage)
            return;
        setLoading(true);
        axios.get(`/api/deals/${dealId}/stage-requirements?targetStage=${targetStage}`)
            .then((r) => {
            setRequirements(r.data.requirements || []);
            setAllMet(r.data.allMet ?? true);
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [dealId, targetStage]);
    if (loading)
        return null;
    if (requirements.length === 0)
        return null;
    const missing = requirements.filter((r) => r.required && !r.uploaded);
    if (compact) {
        return (_jsxs("div", { className: `inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${allMet ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`, children: [_jsx("span", { children: allMet ? "✓" : "!" }), _jsx("span", { children: allMet ? "Docs complete" : `${missing.length} doc${missing.length !== 1 ? "s" : ""} missing` })] }));
    }
    return (_jsxs("div", { className: `rounded-xl border p-4 ${allMet ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800", children: ["Document Requirements for ", _jsx("span", { className: "font-bold", children: targetStage.replace(/_/g, " ") })] }), _jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full ${allMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`, children: allMet ? "All Complete" : `${missing.length} Missing` })] }), _jsx("div", { className: "space-y-1.5", children: requirements.map((req) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-sm ${req.uploaded ? "text-emerald-600" : "text-amber-600"}`, children: req.uploaded ? "✓" : "○" }), _jsx("span", { className: `text-sm ${req.uploaded ? "text-slate-600" : "text-slate-800 font-medium"}`, children: req.label || TYPE_LABELS[req.documentType] || req.documentType }), !req.uploaded && req.required && (_jsx("span", { className: "text-xs text-amber-600 font-medium", children: "Required" }))] }, req.documentType))) }), !allMet && (_jsx("p", { className: "text-xs text-amber-600 mt-3", children: "Upload the missing documents before moving to this stage." }))] }));
}
