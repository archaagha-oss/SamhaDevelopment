import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import axios from "axios";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const blank = (sortOrder, isPrimary) => ({
    leadId: null,
    name: "",
    ownershipPercentage: 0,
    address: "",
    phone: "",
    email: "",
    nationality: "",
    emiratesId: "",
    passportNumber: "",
    companyRegistrationNumber: "",
    authorizedSignatory: "",
    sourceOfFunds: "",
    isPrimary,
    sortOrder,
});
// Editor for the SPA "Purchaser 1 / 2 / 3" block. Each row is jointly and
// severally liable; the sum of ownership percentages must equal 100% and
// exactly one row must be marked primary.
export default function DealPurchasersModal({ dealId, onClose, onSaved }) {
    const [purchasers, setPurchasers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        Promise.all([
            axios.get(`/api/deals/${dealId}/purchasers`),
            axios.get(`/api/deals/${dealId}`),
        ])
            .then(([pRes, dRes]) => {
            const existing = (pRes.data ?? []);
            if (existing.length > 0) {
                setPurchasers(existing.map((p, i) => ({
                    id: p.id,
                    leadId: p.leadId ?? null,
                    name: p.name ?? "",
                    ownershipPercentage: p.ownershipPercentage ?? 0,
                    address: p.address ?? "",
                    phone: p.phone ?? "",
                    email: p.email ?? "",
                    nationality: p.nationality ?? "",
                    emiratesId: p.emiratesId ?? "",
                    passportNumber: p.passportNumber ?? "",
                    companyRegistrationNumber: p.companyRegistrationNumber ?? "",
                    authorizedSignatory: p.authorizedSignatory ?? "",
                    sourceOfFunds: p.sourceOfFunds ?? "",
                    isPrimary: !!p.isPrimary,
                    sortOrder: p.sortOrder ?? i,
                })));
            }
            else {
                // Seed from the deal's primary lead so the user has a starting point.
                const lead = dRes.data?.lead;
                if (lead) {
                    setPurchasers([
                        {
                            ...blank(0, true),
                            leadId: lead.id,
                            name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
                            ownershipPercentage: 100,
                            address: lead.address ?? "",
                            phone: lead.phone ?? "",
                            email: lead.email ?? "",
                            nationality: lead.nationality ?? "",
                            emiratesId: lead.emiratesId ?? "",
                            passportNumber: lead.passportNumber ?? "",
                            companyRegistrationNumber: lead.companyRegistrationNumber ?? "",
                            authorizedSignatory: lead.authorizedSignatory ?? "",
                            sourceOfFunds: lead.sourceOfFunds ?? "",
                        },
                    ]);
                }
            }
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [dealId]);
    const total = purchasers.reduce((s, p) => s + (p.ownershipPercentage || 0), 0);
    const primaryCount = purchasers.filter((p) => p.isPrimary).length;
    const update = (idx, patch) => setPurchasers((arr) => arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    const addPurchaser = () => setPurchasers((arr) => [
        ...arr,
        blank(arr.length, arr.length === 0),
    ]);
    const removePurchaser = (idx) => setPurchasers((arr) => arr.filter((_, i) => i !== idx));
    const setPrimary = (idx) => setPurchasers((arr) => arr.map((p, i) => ({ ...p, isPrimary: i === idx })));
    const handleSave = async () => {
        setError(null);
        setSaved(false);
        if (purchasers.length === 0) {
            setError("At least one purchaser is required");
            return;
        }
        if (Math.abs(total - 100) > 0.01) {
            setError(`Ownership must sum to 100% (currently ${total.toFixed(2)}%)`);
            return;
        }
        if (primaryCount !== 1) {
            setError("Exactly one purchaser must be marked primary");
            return;
        }
        setSubmitting(true);
        try {
            await axios.put(`/api/deals/${dealId}/purchasers`, {
                purchasers: purchasers.map((p, i) => ({
                    leadId: p.leadId ?? undefined,
                    name: p.name,
                    ownershipPercentage: p.ownershipPercentage,
                    address: p.address || null,
                    phone: p.phone || null,
                    email: p.email || null,
                    nationality: p.nationality || null,
                    emiratesId: p.emiratesId || null,
                    passportNumber: p.passportNumber || null,
                    companyRegistrationNumber: p.companyRegistrationNumber || null,
                    authorizedSignatory: p.authorizedSignatory || null,
                    sourceOfFunds: p.sourceOfFunds || null,
                    isPrimary: p.isPrimary,
                    sortOrder: i,
                })),
            });
            setSaved(true);
            onSaved?.();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save purchasers");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Joint Purchasers" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "All purchasers are jointly and severally liable under the SPA. Ownership must sum to 100%." })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "px-6 py-5 space-y-5", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : (_jsxs(_Fragment, { children: [purchasers.map((p, idx) => (_jsxs("div", { className: "border border-slate-200 rounded-xl p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "font-semibold text-slate-800 text-sm", children: ["Purchaser ", idx + 1] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-1.5 text-xs cursor-pointer", children: [_jsx("input", { type: "radio", name: "primary", checked: p.isPrimary, onChange: () => setPrimary(idx) }), _jsx("span", { className: "text-slate-600", children: "Primary" })] }), purchasers.length > 1 && (_jsx("button", { onClick: () => removePurchaser(idx), className: "text-xs text-red-600 hover:text-red-800", children: "Remove" }))] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Name *" }), _jsx("input", { required: true, value: p.name, onChange: (e) => update(idx, { name: e.target.value }), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Ownership % *" }), _jsx("input", { required: true, type: "number", min: "0", max: "100", step: "0.01", value: p.ownershipPercentage, onChange: (e) => update(idx, { ownershipPercentage: parseFloat(e.target.value) || 0 }), className: inp })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Address" }), _jsx("input", { value: p.address, onChange: (e) => update(idx, { address: e.target.value }), className: inp })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Phone" }), _jsx("input", { value: p.phone, onChange: (e) => update(idx, { phone: e.target.value }), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Email" }), _jsx("input", { type: "email", value: p.email, onChange: (e) => update(idx, { email: e.target.value }), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Nationality" }), _jsx("input", { value: p.nationality, onChange: (e) => update(idx, { nationality: e.target.value }), className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Emirates ID" }), _jsx("input", { value: p.emiratesId, onChange: (e) => update(idx, { emiratesId: e.target.value }), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Passport No" }), _jsx("input", { value: p.passportNumber, onChange: (e) => update(idx, { passportNumber: e.target.value }), className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Company Registration No" }), _jsx("input", { value: p.companyRegistrationNumber, onChange: (e) => update(idx, { companyRegistrationNumber: e.target.value }), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Authorized Signatory" }), _jsx("input", { value: p.authorizedSignatory, onChange: (e) => update(idx, { authorizedSignatory: e.target.value }), className: inp })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Source of Funds" }), _jsx("input", { value: p.sourceOfFunds, onChange: (e) => update(idx, { sourceOfFunds: e.target.value }), placeholder: "e.g. Salary, Husband Savings", className: inp })] })] }, idx))), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { onClick: addPurchaser, className: "px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200", children: "+ Add Purchaser" }), _jsx("div", { className: "text-xs", children: _jsxs("span", { className: Math.abs(total - 100) > 0.01 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold", children: ["Total: ", total.toFixed(2), "%"] }) })] }), error && _jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error }), saved && (_jsx("p", { className: "text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg", children: "Purchasers saved." })), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: saved ? "Close" : "Cancel" }), _jsx("button", { onClick: handleSave, disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Saving…" : "Save Purchasers" })] })] })) })] }) }));
}
