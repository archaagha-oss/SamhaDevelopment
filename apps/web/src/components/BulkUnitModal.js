import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];
const inp = "border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:outline-none focus:border-blue-400 w-full";
function buildRows(count, defaultType, defaultView, defaultArea, defaultPrice) {
    return Array.from({ length: count }, (_, i) => ({
        suffix: i + 1,
        type: defaultType,
        view: defaultView,
        area: defaultArea,
        price: defaultPrice,
        include: true,
    }));
}
export default function BulkUnitModal({ projectId, onClose, onCreated }) {
    const [floor, setFloor] = useState("");
    const [defaultType, setDefaultType] = useState("TWO_BR");
    const [defaultView, setDefaultView] = useState("SEA");
    const [defaultArea, setDefaultArea] = useState("");
    const [defaultPrice, setDefaultPrice] = useState("");
    const [configCount, setConfigCount] = useState(8);
    const [rows, setRows] = useState([]);
    const [step, setStep] = useState("config");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    // Load defaults from project config
    useEffect(() => {
        axios.get(`/api/projects/${projectId}/config`)
            .then((r) => {
            setConfigCount(r.data.unitsPerFloor ?? 8);
            setDefaultType(r.data.defaultUnitType ?? "STUDIO");
            setDefaultView(r.data.defaultView ?? "GARDEN");
            setDefaultArea((r.data.defaultArea ?? "").toString());
            if (r.data.defaultPrice)
                setDefaultPrice(r.data.defaultPrice.toString());
        })
            .catch(() => { });
    }, [projectId]);
    const goToLayout = (e) => {
        e.preventDefault();
        setRows(buildRows(configCount, defaultType, defaultView, defaultArea, defaultPrice));
        setStep("layout");
        setError(null);
    };
    const updateRow = (idx, field, value) => setRows((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    // Apply a column value to all included rows
    const applyToAll = (field, value) => setRows((r) => r.map((row) => row.include ? { ...row, [field]: value } : row));
    const handleSubmit = async () => {
        const toCreate = rows.filter((r) => r.include);
        if (toCreate.length === 0)
            return;
        const floorNum = parseInt(floor);
        if (!floorNum) {
            setError("Invalid floor number");
            return;
        }
        // Validate all rows have valid area and price
        for (const row of toCreate) {
            if (!row.area || parseFloat(row.area) <= 0) {
                setError(`Unit ${floorNum}-${String(row.suffix).padStart(2, "0")}: area must be > 0`);
                return;
            }
            if (!row.price || parseFloat(row.price) <= 0) {
                setError(`Unit ${floorNum}-${String(row.suffix).padStart(2, "0")}: price must be > 0`);
                return;
            }
        }
        setSubmitting(true);
        setError(null);
        try {
            // Single transactional bulk request — all or none
            const r = await axios.post("/api/units/bulk", {
                projectId,
                units: toCreate.map((row) => ({
                    unitNumber: `${floorNum}-${String(row.suffix).padStart(2, "0")}`,
                    floor: floorNum,
                    type: row.type,
                    view: row.view,
                    area: parseFloat(row.area),
                    price: parseFloat(row.price),
                })),
            });
            setResult({ created: r.data.created, skipped: r.data.skipped, units: r.data.units });
            setStep("result");
            onCreated();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to create units. Check values and try again.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const activeRows = rows.filter((r) => r.include).length;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Add Floor" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [step === "config" && "Set floor number and shared defaults", step === "layout" && `Customize each unit — ${activeRows} of ${rows.length} selected`, step === "result" && "Units created"] })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), step === "config" && (_jsxs("form", { onSubmit: goToLayout, className: "px-6 py-5 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Floor Number *" }), _jsx("input", { required: true, type: "number", min: "0", value: floor, onChange: (e) => setFloor(e.target.value), placeholder: "e.g. 5", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Units on this floor" }), _jsx("input", { type: "number", min: "1", max: "100", value: configCount, onChange: (e) => setConfigCount(parseInt(e.target.value) || 8), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Default from Project Config \u2014 adjust per floor" })] })] }), _jsxs("div", { className: "border-t border-slate-100 pt-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 mb-3", children: "Shared defaults \u2014 you can override per unit in the next step" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Default Type" }), _jsx("select", { value: defaultType, onChange: (e) => setDefaultType(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: UNIT_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Default View" }), _jsx("select", { value: defaultView, onChange: (e) => setDefaultView(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: UNIT_VIEWS.map((v) => _jsx("option", { value: v, children: v }, v)) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: ["Default Area (sqm) *  ", _jsx("span", { className: "text-blue-500 font-normal", children: "shown as sqft" })] }), _jsx("input", { required: true, type: "number", min: "1", step: "0.1", value: defaultArea, onChange: (e) => setDefaultArea(e.target.value), placeholder: "e.g. 85", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Default Price (AED) *" }), _jsx("input", { required: true, type: "number", min: "1", value: defaultPrice, onChange: (e) => setDefaultPrice(e.target.value), placeholder: "e.g. 1200000", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] })] })] }), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { type: "submit", className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm", children: "Configure Units \u2192" })] })] })), step === "layout" && (_jsxs(_Fragment, { children: [_jsx("div", { className: "px-6 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0", children: _jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-500", children: [_jsx("span", { className: "font-semibold w-16 shrink-0", children: "Apply all:" }), _jsxs("select", { onChange: (e) => applyToAll("type", e.target.value), defaultValue: "", className: "border border-slate-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none", children: [_jsx("option", { value: "", disabled: true, children: "Set type\u2026" }), UNIT_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t))] }), _jsxs("select", { onChange: (e) => applyToAll("view", e.target.value), defaultValue: "", className: "border border-slate-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none", children: [_jsx("option", { value: "", disabled: true, children: "Set view\u2026" }), UNIT_VIEWS.map((v) => _jsx("option", { value: v, children: v }, v))] }), _jsxs("span", { className: "ml-auto text-slate-400", children: [activeRows, " units will be created"] })] }) }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "sticky top-0 bg-white border-b border-slate-100", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left text-slate-500 w-8" }), _jsx("th", { className: "px-3 py-2 text-left text-slate-500 w-20", children: "Unit No." }), _jsx("th", { className: "px-3 py-2 text-left text-slate-500", children: "Type" }), _jsx("th", { className: "px-3 py-2 text-left text-slate-500", children: "View" }), _jsx("th", { className: "px-3 py-2 text-left text-slate-500 w-24", children: "Area (sqm)" }), _jsx("th", { className: "px-3 py-2 text-left text-slate-500 w-28", children: "Price (AED)" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: rows.map((row, idx) => (_jsxs("tr", { className: row.include ? "" : "opacity-40", children: [_jsx("td", { className: "px-3 py-1.5", children: _jsx("input", { type: "checkbox", checked: row.include, onChange: (e) => updateRow(idx, "include", e.target.checked), className: "rounded" }) }), _jsxs("td", { className: "px-3 py-1.5 font-mono font-semibold text-slate-700", children: [floor, "-", String(row.suffix).padStart(2, "0")] }), _jsx("td", { className: "px-3 py-1.5", children: _jsx("select", { value: row.type, disabled: !row.include, onChange: (e) => updateRow(idx, "type", e.target.value), className: inp, children: UNIT_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)) }) }), _jsx("td", { className: "px-3 py-1.5", children: _jsx("select", { value: row.view, disabled: !row.include, onChange: (e) => updateRow(idx, "view", e.target.value), className: inp, children: UNIT_VIEWS.map((v) => _jsx("option", { value: v, children: v }, v)) }) }), _jsx("td", { className: "px-3 py-1.5", children: _jsx("input", { type: "number", min: "1", step: "0.1", value: row.area, disabled: !row.include, onChange: (e) => updateRow(idx, "area", e.target.value), className: inp }) }), _jsx("td", { className: "px-3 py-1.5", children: _jsx("input", { type: "number", min: "1", value: row.price, disabled: !row.include, onChange: (e) => updateRow(idx, "price", e.target.value), className: inp }) })] }, idx))) })] }) }), error && _jsx("p", { className: "mx-6 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0", children: [_jsx("button", { onClick: () => setStep("config"), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "\u2190 Back" }), _jsx("button", { onClick: handleSubmit, disabled: submitting || activeRows === 0, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Creating…" : `Create ${activeRows} Unit${activeRows !== 1 ? "s" : ""} on Floor ${floor}` })] })] })), step === "result" && result && (_jsxs("div", { className: "px-6 py-6 space-y-4", children: [_jsxs("div", { className: "flex gap-4", children: [_jsxs("div", { className: "bg-emerald-50 rounded-xl p-4 flex-1 text-center", children: [_jsx("p", { className: "text-3xl font-bold text-emerald-700", children: result.created }), _jsx("p", { className: "text-xs text-emerald-600 font-medium mt-1", children: "Units Created" })] }), result.skipped > 0 && (_jsxs("div", { className: "bg-amber-50 rounded-xl p-4 flex-1 text-center", children: [_jsx("p", { className: "text-3xl font-bold text-amber-700", children: result.skipped }), _jsx("p", { className: "text-xs text-amber-600 font-medium mt-1", children: "Skipped (already existed)" })] }))] }), _jsx("button", { onClick: onClose, className: "w-full py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-700 text-sm", children: "Done" })] }))] }) }));
}
