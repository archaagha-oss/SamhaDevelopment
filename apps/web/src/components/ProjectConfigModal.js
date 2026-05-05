import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
const DEFAULTS = { dldPercent: 4, adminFee: 5000, reservationDays: 7, oqoodDays: 90, vatPercent: 0, agencyFeePercent: 2, unitsPerFloor: 8 };
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-0.5";
const hint = "text-xs text-slate-400 mt-0.5";
export default function ProjectConfigModal({ projectId, onClose }) {
    const [form, setForm] = useState({
        dldPercent: DEFAULTS.dldPercent.toString(),
        adminFee: DEFAULTS.adminFee.toString(),
        reservationDays: DEFAULTS.reservationDays.toString(),
        oqoodDays: DEFAULTS.oqoodDays.toString(),
        vatPercent: DEFAULTS.vatPercent.toString(),
        agencyFeePercent: DEFAULTS.agencyFeePercent.toString(),
        unitsPerFloor: DEFAULTS.unitsPerFloor.toString(),
    });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        axios.get(`/api/projects/${projectId}/config`)
            .then((r) => {
            const c = r.data;
            setForm({
                dldPercent: c.dldPercent?.toString() ?? DEFAULTS.dldPercent.toString(),
                adminFee: c.adminFee?.toString() ?? DEFAULTS.adminFee.toString(),
                reservationDays: c.reservationDays?.toString() ?? DEFAULTS.reservationDays.toString(),
                oqoodDays: c.oqoodDays?.toString() ?? DEFAULTS.oqoodDays.toString(),
                vatPercent: c.vatPercent?.toString() ?? DEFAULTS.vatPercent.toString(),
                agencyFeePercent: c.agencyFeePercent?.toString() ?? DEFAULTS.agencyFeePercent.toString(),
                unitsPerFloor: c.unitsPerFloor?.toString() ?? DEFAULTS.unitsPerFloor.toString(),
            });
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [projectId]);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        setSaved(false);
        try {
            await axios.patch(`/api/projects/${projectId}/config`, {
                dldPercent: parseFloat(form.dldPercent),
                adminFee: parseFloat(form.adminFee),
                reservationDays: parseInt(form.reservationDays),
                oqoodDays: parseInt(form.oqoodDays),
                vatPercent: parseFloat(form.vatPercent),
                agencyFeePercent: parseFloat(form.agencyFeePercent),
                unitsPerFloor: parseInt(form.unitsPerFloor),
            });
            setSaved(true);
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save configuration");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Project Configuration" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Affects future deals \u2014 does not retroactively change existing ones" })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), loading ? (_jsx("div", { className: "flex items-center justify-center h-40", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : (_jsxs("form", { onSubmit: handleSubmit, className: "px-6 py-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "DLD %" }), _jsx("input", { type: "number", min: "0", max: "100", step: "0.1", value: form.dldPercent, onChange: (e) => set("dldPercent", e.target.value), className: inp }), _jsx("p", { className: hint, children: "Dubai Land Dept fee on net price" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Admin Fee (AED)" }), _jsx("input", { type: "number", min: "0", value: form.adminFee, onChange: (e) => set("adminFee", e.target.value), className: inp }), _jsx("p", { className: hint, children: "Fixed fee per deal" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Reservation Days" }), _jsx("input", { type: "number", min: "1", value: form.reservationDays, onChange: (e) => set("reservationDays", e.target.value), className: inp }), _jsx("p", { className: hint, children: "Days a reservation holds the unit" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "OQOOD Days" }), _jsx("input", { type: "number", min: "1", value: form.oqoodDays, onChange: (e) => set("oqoodDays", e.target.value), className: inp }), _jsx("p", { className: hint, children: "Deadline for OQOOD registration" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "VAT %" }), _jsx("input", { type: "number", min: "0", max: "100", step: "0.1", value: form.vatPercent, onChange: (e) => set("vatPercent", e.target.value), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Agency Fee %" }), _jsx("input", { type: "number", min: "0", max: "100", step: "0.1", value: form.agencyFeePercent, onChange: (e) => set("agencyFeePercent", e.target.value), className: inp })] })] }), _jsx("div", { className: "border-t border-slate-100 pt-4", children: _jsxs("div", { className: "max-w-[160px]", children: [_jsx("label", { className: lbl, children: "Units Per Floor" }), _jsx("input", { type: "number", min: "1", max: "100", value: form.unitsPerFloor, onChange: (e) => set("unitsPerFloor", e.target.value), className: inp }), _jsx("p", { className: hint, children: "Default number of units when adding a full floor" })] }) }), error && _jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error }), saved && _jsx("p", { className: "text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg", children: "Configuration saved successfully." }), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: saved ? "Close" : "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Saving…" : "Save Config" })] })] }))] }) }));
}
