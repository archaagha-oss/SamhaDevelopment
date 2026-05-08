import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import axios from "axios";
const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];
const LOCKED_STATUSES = ["RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
export default function UnitFormModal({ projectId, unit, onClose, onSaved }) {
    const isEdit = !!unit;
    const isLocked = isEdit && LOCKED_STATUSES.includes(unit.status);
    const [form, setForm] = useState({
        unitNumber: unit?.unitNumber ?? "",
        floor: unit?.floor?.toString() ?? "",
        type: unit?.type ?? "STUDIO",
        area: unit?.area?.toString() ?? "",
        price: unit?.price?.toString() ?? "",
        view: unit?.view ?? "SEA",
        parkingSpaces: unit?.parkingSpaces?.toString() ?? "",
        internalArea: unit?.internalArea?.toString() ?? "",
        externalArea: unit?.externalArea?.toString() ?? "",
        areaSqft: unit?.areaSqft?.toString() ?? "",
        ratePerSqft: unit?.ratePerSqft?.toString() ?? "",
        smartHome: unit?.smartHome ? "yes" : unit?.smartHome === false ? "no" : "",
        anticipatedCompletionDate: unit?.anticipatedCompletionDate
            ? unit.anticipatedCompletionDate.slice(0, 10)
            : "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const payload = {
                floor: parseInt(form.floor),
                type: form.type,
                area: parseFloat(form.area),
                price: parseFloat(form.price),
                view: form.view,
            };
            if (form.parkingSpaces)
                payload.parkingSpaces = parseInt(form.parkingSpaces);
            if (form.internalArea)
                payload.internalArea = parseFloat(form.internalArea);
            if (form.externalArea)
                payload.externalArea = parseFloat(form.externalArea);
            if (form.areaSqft)
                payload.areaSqft = parseFloat(form.areaSqft);
            if (form.ratePerSqft)
                payload.ratePerSqft = parseFloat(form.ratePerSqft);
            if (form.smartHome === "yes")
                payload.smartHome = true;
            if (form.smartHome === "no")
                payload.smartHome = false;
            if (form.anticipatedCompletionDate)
                payload.anticipatedCompletionDate = form.anticipatedCompletionDate;
            if (!isEdit) {
                payload.projectId = projectId;
                payload.unitNumber = form.unitNumber;
                await axios.post("/api/units", payload);
            }
            else {
                await axios.patch(`/api/units/${unit.id}`, payload);
            }
            onSaved();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save unit");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsx("h2", { className: "font-bold text-slate-900", children: isEdit ? `Edit Unit ${unit.unitNumber}` : "Add New Unit" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), isLocked && (_jsx("div", { className: "mx-6 mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700", children: "This unit has an active deal \u2014 price, type, and area are locked. Only floor and view can be edited." })), _jsxs("form", { onSubmit: handleSubmit, className: "px-6 py-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Unit Number *" }), _jsx("input", { required: !isEdit, value: form.unitNumber, onChange: (e) => set("unitNumber", e.target.value), placeholder: "e.g. 3-02", disabled: isEdit, className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Floor *" }), _jsx("input", { required: true, type: "number", min: "0", value: form.floor, onChange: (e) => set("floor", e.target.value), className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Type *" }), _jsx("select", { required: true, value: form.type, onChange: (e) => set("type", e.target.value), disabled: isLocked, className: inp, children: UNIT_TYPES.map((t) => (_jsx("option", { value: t, children: t.replace(/_/g, " ") }, t))) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "View *" }), _jsx("select", { required: true, value: form.view, onChange: (e) => set("view", e.target.value), className: inp, children: UNIT_VIEWS.map((v) => (_jsx("option", { value: v, children: v }, v))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Area (sqm) *" }), _jsx("input", { required: true, type: "number", min: "1", step: "0.1", value: form.area, onChange: (e) => set("area", e.target.value), placeholder: "e.g. 85", disabled: isLocked, className: inp }), _jsxs("p", { className: "text-xs text-blue-600 font-medium mt-1", children: ["= ", Math.round(parseFloat(form.area || "0") * 10.764).toLocaleString(), " sqft"] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Price (AED) *" }), _jsx("input", { required: true, type: "number", min: "1", value: form.price, onChange: (e) => set("price", e.target.value), placeholder: "e.g. 1200000", disabled: isLocked, className: inp })] })] }), _jsxs("div", { className: "border-t border-slate-100 pt-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 mb-3", children: "Physical Details" }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Parking Spaces" }), _jsx("input", { type: "number", min: "0", value: form.parkingSpaces, onChange: (e) => set("parkingSpaces", e.target.value), className: inp })] }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3 mt-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Suite Area (sqm)" }), _jsx("input", { type: "number", min: "0", step: "0.1", value: form.internalArea, onChange: (e) => set("internalArea", e.target.value), disabled: isLocked, className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Balcony Area (sqm)" }), _jsx("input", { type: "number", min: "0", step: "0.1", value: form.externalArea, onChange: (e) => set("externalArea", e.target.value), disabled: isLocked, className: inp })] })] })] }), _jsxs("details", { className: "border border-slate-200 rounded-lg", open: isEdit, children: [_jsx("summary", { className: "px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer select-none", children: "SPA particulars" }), _jsxs("div", { className: "px-4 pb-4 pt-2 space-y-3 border-t border-slate-100", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Total Area (sqft)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: form.areaSqft, onChange: (e) => set("areaSqft", e.target.value), disabled: isLocked, placeholder: "e.g. 424.96", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Rate per sqft (AED)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: form.ratePerSqft, onChange: (e) => set("ratePerSqft", e.target.value), disabled: isLocked, placeholder: "e.g. 1548.38", className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Smart Home" }), _jsxs("select", { value: form.smartHome, onChange: (e) => set("smartHome", e.target.value), className: inp, children: [_jsx("option", { value: "", children: "\u2014" }), _jsx("option", { value: "yes", children: "Yes" }), _jsx("option", { value: "no", children: "No" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Anticipated Completion" }), _jsx("input", { type: "date", value: form.anticipatedCompletionDate, onChange: (e) => set("anticipatedCompletionDate", e.target.value), className: inp }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Overrides project handover date for this unit's SPA" })] })] })] })] }), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error })), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Unit" })] })] })] }) }));
}
