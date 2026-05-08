import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAgents } from "../hooks/useAgents";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
export default function QuickLeadModal({ onClose, onCreated }) {
    const firstNameRef = useRef(null);
    const { data: agents = [] } = useAgents();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [assignedAgentId, setAssignedAgentId] = useState("");
    const [consent, setConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [dirty, setDirty] = useState(false);
    useEffect(() => { firstNameRef.current?.focus(); }, []);
    const handleClose = () => {
        if (dirty && !window.confirm("Discard this new lead?"))
            return;
        onClose();
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!consent) {
            setError("Consent is required before creating a lead.");
            return;
        }
        setSubmitting(true);
        try {
            await axios.post("/api/leads", {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                assignedAgentId: assignedAgentId || undefined,
                source: "DIRECT",
                consent,
            });
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
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900 text-lg", children: "Quick Add Lead" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Capture basic info in seconds" })] }), _jsx("button", { onClick: handleClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { id: "quick-lead-form", onSubmit: handleSubmit, className: "px-6 py-5 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "First Name *" }), _jsx("input", { ref: firstNameRef, required: true, value: firstName, onChange: (e) => {
                                                setFirstName(e.target.value);
                                                setDirty(true);
                                            }, className: inp, placeholder: "Ahmed" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Last Name *" }), _jsx("input", { required: true, value: lastName, onChange: (e) => {
                                                setLastName(e.target.value);
                                                setDirty(true);
                                            }, className: inp, placeholder: "Al Mansouri" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Phone *" }), _jsxs("div", { className: "relative", children: [_jsx("input", { required: true, type: "tel", value: phone, onChange: (e) => {
                                                setPhone(e.target.value);
                                                setDirty(true);
                                            }, className: inp + " pr-24", placeholder: "+971 50 000 0000" }), _jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none", children: "UAE format" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Assigned Sales Agent *" }), _jsxs("select", { required: true, value: assignedAgentId, onChange: (e) => {
                                        setAssignedAgentId(e.target.value);
                                        setDirty(true);
                                    }, className: inp, children: [_jsx("option", { value: "", children: "Select agent\u2026" }), agents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }), _jsxs("label", { className: "flex items-start gap-2.5 cursor-pointer border border-slate-200 rounded-xl p-3 bg-slate-50", children: [_jsx("input", { type: "checkbox", required: true, checked: consent, onChange: (e) => { setConsent(e.target.checked); setDirty(true); }, className: "mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" }), _jsxs("span", { className: "text-xs text-slate-600 leading-relaxed", children: ["The lead has consented to being contacted about properties. ", _jsx("span", { className: "text-red-500", children: "*" })] })] }), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg", children: error }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3", children: [_jsx("button", { type: "button", onClick: handleClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors", children: "Cancel" }), _jsx("button", { form: "quick-lead-form", type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50", children: submitting ? "Creating…" : "Create Lead" })] })] }) }));
}
