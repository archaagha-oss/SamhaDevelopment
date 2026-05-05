import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
function fmtAED(amount) {
    return new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency: "AED",
        maximumFractionDigits: 0,
    }).format(amount);
}
export default function ReservationModal({ open, onClose, leadId, leadName, onSuccess, }) {
    const [units, setUnits] = useState([]);
    const [selectedUnitId, setSelectedUnitId] = useState("");
    const [notes, setNotes] = useState("");
    const [fetchingUnits, setFetchingUnits] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    // Reset & fetch AVAILABLE units whenever the modal opens
    useEffect(() => {
        if (!open)
            return;
        setSelectedUnitId("");
        setNotes("");
        setError("");
        setFetchingUnits(true);
        axios
            .get("/api/units", { params: { status: "AVAILABLE", limit: 200 } })
            .then((res) => setUnits(res.data.data ?? res.data ?? []))
            .catch(() => setUnits([]))
            .finally(() => setFetchingUnits(false));
    }, [open]);
    if (!open)
        return null;
    const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;
    const handleSubmit = async () => {
        if (!selectedUnitId) {
            setError("Please select a unit.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await axios.post("/api/reservations", {
                unitId: selectedUnitId,
                leadId,
                notes: notes.trim() || undefined,
            });
            onSuccess?.();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error ?? "Failed to create reservation.");
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm", children: _jsxs("div", { className: "bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-700", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-white font-semibold text-base", children: "Reserve Unit" }), leadName && (_jsxs("p", { className: "text-slate-500 text-xs mt-0.5", children: ["for ", leadName] }))] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-200 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "px-6 py-5 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: ["Available Unit ", _jsx("span", { className: "text-red-400", children: "*" })] }), fetchingUnits ? (_jsx("p", { className: "text-slate-500 text-sm py-2", children: "Loading available units\u2026" })) : units.length === 0 ? (_jsx("p", { className: "text-amber-400 text-sm py-2", children: "No available units at this time." })) : (_jsxs("select", { value: selectedUnitId, onChange: (e) => setSelectedUnitId(e.target.value), className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors", children: [_jsx("option", { value: "", children: "Select a unit\u2026" }), units.map((u) => (_jsxs("option", { value: u.id, children: ["Unit ", u.unitNumber, u.floor != null ? ` — Floor ${u.floor}` : "", u.type ? ` — ${u.type}` : "", " — ", fmtAED(u.askingPrice)] }, u.id)))] }))] }), selectedUnit && (_jsxs("div", { className: "bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("p", { className: "text-white font-semibold text-sm", children: ["Unit ", selectedUnit.unitNumber] }), selectedUnit.project?.name && (_jsx("span", { className: "text-xs text-slate-500", children: selectedUnit.project.name }))] }), _jsxs("div", { className: "grid grid-cols-3 gap-3 text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-500 mb-0.5", children: "Type" }), _jsx("p", { className: "text-slate-200 font-medium", children: selectedUnit.type || "—" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-500 mb-0.5", children: "Floor" }), _jsx("p", { className: "text-slate-200 font-medium", children: selectedUnit.floor ?? "—" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-500 mb-0.5", children: "Asking Price" }), _jsx("p", { className: "text-emerald-400 font-semibold", children: fmtAED(selectedUnit.askingPrice) })] })] })] })), _jsxs("div", { children: [_jsxs("label", { className: "block text-slate-400 text-xs font-medium mb-1.5", children: ["Notes ", _jsx("span", { className: "text-slate-600", children: "(optional)" })] }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Reason for reservation, special requirements, client preferences\u2026", rows: 3, className: "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition-colors" })] }), _jsxs("div", { className: "flex items-start gap-2.5 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5", children: [_jsx("span", { className: "text-amber-400 mt-0.5 flex-shrink-0", children: "\u23F1" }), _jsxs("p", { children: ["The unit will be temporarily locked as", " ", _jsx("span", { className: "text-amber-300 font-medium", children: "RESERVED" }), ". Reservations expire automatically based on the project configuration (typically 7\u201314 days). You can convert this reservation into a deal at any time."] })] }), error && (_jsx("p", { className: "text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2", children: error }))] }), _jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-slate-300 hover:text-white text-sm transition-colors", children: "Cancel" }), _jsx("button", { onClick: handleSubmit, disabled: saving || !selectedUnitId || fetchingUnits || units.length === 0, className: "px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors", children: saving ? "Reserving…" : "Reserve Unit" })] })] }) }));
}
