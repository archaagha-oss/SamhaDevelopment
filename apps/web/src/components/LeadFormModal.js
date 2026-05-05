import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAgents } from "../hooks/useAgents";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const BLANK = {
    firstName: "", lastName: "", phone: "", email: "", nationality: "",
    source: "DIRECT", budget: "", assignedAgentId: "", notes: "",
    brokerCompanyId: "", brokerAgentId: "",
};
export default function LeadFormModal({ onClose, onCreated }) {
    const firstNameRef = useRef(null);
    const { data: agents = [] } = useAgents();
    const [form, setForm] = useState(BLANK);
    const [brokerCompanies, setBCs] = useState([]);
    const [brokerAgents, setBAs] = useState([]);
    const [availableUnits, setUnits] = useState([]);
    const [selectedUnitIds, setSelected] = useState(new Set());
    const [primaryUnitId, setPrimary] = useState("");
    const [unitSearch, setUnitSearch] = useState("");
    const [showUnits, setShowUnits] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [dirty, setDirty] = useState(false);
    useEffect(() => { firstNameRef.current?.focus(); }, []);
    useEffect(() => {
        axios.get("/api/brokers/companies").then((r) => setBCs(r.data || [])).catch(() => { });
        axios.get("/api/units", { params: { status: "AVAILABLE", limit: 200 } })
            .then((r) => setUnits(r.data?.data ?? r.data ?? []))
            .catch(() => { });
    }, []);
    useEffect(() => {
        if (!form.brokerCompanyId) {
            setBAs([]);
            return;
        }
        axios.get(`/api/brokers/companies/${form.brokerCompanyId}/agents`)
            .then((r) => setBAs(r.data || [])).catch(() => setBAs([]));
    }, [form.brokerCompanyId]);
    const set = (patch) => {
        setForm((f) => ({ ...f, ...patch }));
        setDirty(true);
    };
    const toggleUnit = (unitId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(unitId)) {
                next.delete(unitId);
                if (primaryUnitId === unitId)
                    setPrimary("");
            }
            else {
                next.add(unitId);
                if (next.size === 1)
                    setPrimary(unitId);
            }
            return next;
        });
        setDirty(true);
    };
    const handleClose = () => {
        if (dirty && !window.confirm("Discard this new lead?"))
            return;
        onClose();
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await axios.post("/api/leads", {
                firstName: form.firstName,
                lastName: form.lastName,
                phone: form.phone,
                email: form.email || undefined,
                nationality: form.nationality || undefined,
                source: form.source,
                budget: form.budget ? parseFloat(form.budget) : null,
                assignedAgentId: form.assignedAgentId || undefined,
                notes: form.notes || undefined,
                brokerCompanyId: form.source === "BROKER" && form.brokerCompanyId ? form.brokerCompanyId : undefined,
                brokerAgentId: form.source === "BROKER" && form.brokerAgentId ? form.brokerAgentId : undefined,
            });
            const leadId = res.data.id;
            // Register interested units (and auto-create offers server-side)
            if (selectedUnitIds.size > 0) {
                await Promise.all([...selectedUnitIds].map((unitId) => axios.post(`/api/leads/${leadId}/interests`, {
                    unitId,
                    isPrimary: unitId === primaryUnitId,
                })));
            }
            onCreated();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to create lead");
        }
        finally {
            setSubmitting(false);
        }
    };
    const isBroker = form.source === "BROKER";
    const filteredUnits = availableUnits.filter((u) => unitSearch === "" ||
        u.unitNumber.toLowerCase().includes(unitSearch.toLowerCase()) ||
        u.type.toLowerCase().includes(unitSearch.toLowerCase()));
    const selectedUnits = availableUnits.filter((u) => selectedUnitIds.has(u.id));
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900 text-lg", children: "New Lead" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Fields marked * are required" })] }), _jsx("button", { onClick: handleClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { id: "lead-form", onSubmit: handleSubmit, className: "overflow-y-auto flex-1 px-6 py-5 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "First Name *" }), _jsx("input", { ref: firstNameRef, required: true, value: form.firstName, onChange: (e) => set({ firstName: e.target.value }), className: inp, placeholder: "Ahmed" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Last Name *" }), _jsx("input", { required: true, value: form.lastName, onChange: (e) => set({ lastName: e.target.value }), className: inp, placeholder: "Al Mansouri" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Phone *" }), _jsxs("div", { className: "relative", children: [_jsx("input", { required: true, type: "tel", value: form.phone, onChange: (e) => set({ phone: e.target.value }), className: inp + " pr-24", placeholder: "+971 50 000 0000" }), _jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none", children: "UAE format" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => set({ email: e.target.value }), className: inp, placeholder: "optional" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Nationality" }), _jsx("input", { value: form.nationality, onChange: (e) => set({ nationality: e.target.value }), className: inp, placeholder: "optional" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Lead Source *" }), _jsxs("select", { required: true, value: form.source, onChange: (e) => set({ source: e.target.value, brokerCompanyId: "", brokerAgentId: "" }), className: inp, children: [_jsx("option", { value: "DIRECT", children: "Direct" }), _jsx("option", { value: "BROKER", children: "Broker" }), _jsx("option", { value: "WEBSITE", children: "Website" }), _jsx("option", { value: "REFERRAL", children: "Referral" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Budget (AED)" }), _jsx("input", { type: "number", min: "0", step: "1000", value: form.budget, onChange: (e) => set({ budget: e.target.value }), className: inp, placeholder: "optional" })] })] }), isBroker && (_jsxs("div", { className: "space-y-3 border border-purple-100 bg-purple-50/40 rounded-xl p-4", children: [_jsx("p", { className: "text-xs font-semibold text-purple-600 uppercase tracking-wide", children: "Broker Details" }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Broker Company" }), _jsxs("select", { value: form.brokerCompanyId, onChange: (e) => set({ brokerCompanyId: e.target.value, brokerAgentId: "" }), className: inp, children: [_jsx("option", { value: "", children: "Select company\u2026" }), brokerCompanies.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), form.brokerCompanyId && (_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Broker Agent (optional)" }), _jsxs("select", { value: form.brokerAgentId, onChange: (e) => set({ brokerAgentId: e.target.value }), className: inp, children: [_jsx("option", { value: "", children: "Select agent\u2026" }), brokerAgents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }))] })), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Assigned Sales Agent *" }), _jsxs("select", { required: true, value: form.assignedAgentId, onChange: (e) => set({ assignedAgentId: e.target.value }), className: inp, children: [_jsx("option", { value: "", children: "Select agent\u2026" }), agents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Notes" }), _jsx("textarea", { rows: 2, value: form.notes, onChange: (e) => set({ notes: e.target.value }), placeholder: "Any additional context\u2026", className: inp + " resize-none" })] }), _jsxs("div", { className: "border border-emerald-100 bg-emerald-50/30 rounded-xl p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("p", { className: "text-xs font-semibold text-emerald-700 uppercase tracking-wide", children: ["Interested Units", selectedUnitIds.size > 0 && (_jsx("span", { className: "ml-2 bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px]", children: selectedUnitIds.size }))] }), _jsx("button", { type: "button", onClick: () => setShowUnits((v) => !v), className: "text-xs text-emerald-700 font-semibold hover:text-emerald-900", children: showUnits ? "− Hide" : "+ Add Units" })] }), selectedUnits.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: selectedUnits.map((u) => (_jsxs("div", { className: `flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${primaryUnitId === u.id
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-white text-slate-700 border-slate-200"}`, children: [_jsxs("button", { type: "button", onClick: () => setPrimary(u.id), title: "Set as primary interest", className: "flex items-center gap-1", children: [primaryUnitId === u.id && _jsx("span", { className: "text-[10px]", children: "\u2605" }), u.unitNumber, " \u00B7 ", u.type.replace(/_/g, " ")] }), _jsx("button", { type: "button", onClick: () => toggleUnit(u.id), className: "opacity-60 hover:opacity-100 ml-0.5", children: "\u00D7" })] }, u.id))) })), showUnits && (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "text", placeholder: "Search by unit number or type\u2026", value: unitSearch, onChange: (e) => setUnitSearch(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-emerald-400" }), _jsx("div", { className: "max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-50", children: filteredUnits.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 text-center py-4", children: "No available units found" })) : (filteredUnits.map((u) => {
                                                const checked = selectedUnitIds.has(u.id);
                                                return (_jsxs("label", { className: "flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: () => toggleUnit(u.id), className: "rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "text-xs font-semibold text-slate-800", children: u.unitNumber }), _jsxs("span", { className: "text-xs text-slate-400 ml-2", children: [u.type.replace(/_/g, " "), " \u00B7 Floor ", u.floor] })] }), _jsxs("span", { className: "text-xs font-bold text-blue-600 flex-shrink-0", children: ["AED ", u.price.toLocaleString()] })] }, u.id));
                                            })) }), selectedUnitIds.size > 0 && (_jsx("p", { className: "text-[10px] text-slate-400", children: "Click a selected unit above to set it as the primary interest (\u2605)" }))] }))] }), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg", children: error }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0", children: [_jsx("button", { type: "button", onClick: handleClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors", children: "Cancel" }), _jsx("button", { form: "lead-form", type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50", children: submitting ? "Creating…" : "Create Lead" })] })] }) }));
}
