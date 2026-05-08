import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import axios from "axios";
const SPEC_AREAS = [
    { value: "FOYER", label: "Foyer" },
    { value: "LIVING_AREA", label: "Living Area" },
    { value: "DINING_AREA", label: "Dining Area" },
    { value: "BEDROOM", label: "Bedroom" },
    { value: "KITCHEN", label: "Kitchen" },
    { value: "MASTER_BATHROOM", label: "Master Bathroom" },
    { value: "SECONDARY_BATHROOM", label: "Secondary Bathroom" },
    { value: "BALCONY", label: "Balcony" },
    { value: "POWDER_ROOM", label: "Powder Room" },
    { value: "STUDY", label: "Study" },
    { value: "MAID_ROOM", label: "Maid Room" },
    { value: "LAUNDRY", label: "Laundry" },
];
const inp = "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-0.5";
// SPA Schedule 2 — finishes specification table (per area).
// Bulk PUT: the editor sends the full list and the API replaces in one tx.
export default function ProjectSpecificationsModal({ projectId, onClose }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        axios
            .get(`/api/projects/${projectId}/specifications`)
            .then((r) => {
            const data = (r.data ?? []);
            setRows(data.map((d) => ({
                area: d.area,
                floorFinish: d.floorFinish ?? "",
                wallFinish: d.wallFinish ?? "",
                ceilingFinish: d.ceilingFinish ?? "",
                additionalFinishes: d.additionalFinishes ?? "",
            })));
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [projectId]);
    const usedAreas = new Set(rows.map((r) => r.area));
    const availableAreas = SPEC_AREAS.filter((a) => !usedAreas.has(a.value));
    const addRow = (area) => setRows([
        ...rows,
        { area, floorFinish: "", wallFinish: "", ceilingFinish: "", additionalFinishes: "" },
    ]);
    const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));
    const setField = (idx, field, value) => setRows(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    const handleSave = async () => {
        setError(null);
        setSubmitting(true);
        setSaved(false);
        try {
            await axios.put(`/api/projects/${projectId}/specifications`, {
                specifications: rows.map((r, i) => ({
                    area: r.area,
                    floorFinish: r.floorFinish || null,
                    wallFinish: r.wallFinish || null,
                    ceilingFinish: r.ceilingFinish || null,
                    additionalFinishes: r.additionalFinishes || null,
                    sortOrder: i,
                })),
            });
            setSaved(true);
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save specifications");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900", children: "SPA Schedule 2 \u2014 Specifications" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Per-area finish breakdown printed on the SPA's draft property specification." })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "px-6 py-5 space-y-4", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : (_jsxs(_Fragment, { children: [rows.length === 0 && (_jsx("p", { className: "text-sm text-slate-400 italic", children: "No specifications yet. Add an area below to start." })), rows.length > 0 && (_jsx("div", { className: "border border-slate-200 rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-slate-50", children: _jsxs("tr", { className: "text-left", children: [_jsx("th", { className: "px-3 py-2 font-semibold text-slate-600 w-40", children: "Area" }), _jsx("th", { className: "px-3 py-2 font-semibold text-slate-600", children: "Floor" }), _jsx("th", { className: "px-3 py-2 font-semibold text-slate-600", children: "Wall" }), _jsx("th", { className: "px-3 py-2 font-semibold text-slate-600", children: "Ceiling" }), _jsx("th", { className: "px-3 py-2 font-semibold text-slate-600", children: "Additional" }), _jsx("th", { className: "px-3 py-2 w-10" })] }) }), _jsx("tbody", { children: rows.map((r, idx) => (_jsxs("tr", { className: "border-t border-slate-100 align-top", children: [_jsx("td", { className: "px-3 py-2 font-medium text-slate-700", children: SPEC_AREAS.find((a) => a.value === r.area)?.label ?? r.area }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: r.floorFinish, onChange: (e) => setField(idx, "floorFinish", e.target.value), placeholder: "e.g. Porcelain tiles 600x1200 mm", className: inp }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: r.wallFinish, onChange: (e) => setField(idx, "wallFinish", e.target.value), placeholder: "e.g. Emulsion paint", className: inp }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: r.ceilingFinish, onChange: (e) => setField(idx, "ceilingFinish", e.target.value), placeholder: "e.g. Gypsum + emulsion", className: inp }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: r.additionalFinishes, onChange: (e) => setField(idx, "additionalFinishes", e.target.value), placeholder: "Countertops, cabinets, etc.", className: inp }) }), _jsx("td", { className: "px-2 py-2 text-center", children: _jsx("button", { onClick: () => removeRow(idx), className: "text-slate-400 hover:text-red-600 text-lg leading-none", title: "Remove area", children: "\u00D7" }) })] }, `${r.area}-${idx}`))) })] }) })), availableAreas.length > 0 && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: lbl, children: "Add area:" }), _jsxs("select", { onChange: (e) => {
                                            if (e.target.value) {
                                                addRow(e.target.value);
                                                e.target.value = "";
                                            }
                                        }, className: "border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-slate-50", defaultValue: "", children: [_jsx("option", { value: "", disabled: true, children: "Select an area\u2026" }), availableAreas.map((a) => (_jsx("option", { value: a.value, children: a.label }, a.value)))] })] })), error && _jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error }), saved && (_jsx("p", { className: "text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg", children: "Specifications saved." })), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: saved ? "Close" : "Cancel" }), _jsx("button", { onClick: handleSave, disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Saving…" : "Save Specifications" })] })] })) })] }) }));
}
