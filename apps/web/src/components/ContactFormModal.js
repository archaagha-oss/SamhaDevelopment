import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import axios from "axios";
const SOURCES = ["MANUAL", "LEAD", "BROKER", "REFERRAL", "IMPORT"];
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
export default function ContactFormModal({ contact, onClose, onSaved }) {
    const isEdit = !!contact?.id;
    const [form, setForm] = useState({
        firstName: contact?.firstName ?? "",
        lastName: contact?.lastName ?? "",
        email: contact?.email ?? "",
        phone: contact?.phone ?? "",
        whatsapp: contact?.whatsapp ?? "",
        company: contact?.company ?? "",
        jobTitle: contact?.jobTitle ?? "",
        nationality: contact?.nationality ?? "",
        source: contact?.source ?? "MANUAL",
        notes: contact?.notes ?? "",
        tags: contact?.tags ?? "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.firstName.trim()) {
            setError("First name is required");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            if (isEdit) {
                await axios.patch(`/api/contacts/${contact.id}`, form);
            }
            else {
                await axios.post("/api/contacts", form);
            }
            onSaved();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save contact");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10", children: [_jsx("h2", { className: "font-bold text-slate-900", children: isEdit ? "Edit Contact" : "New Contact" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "px-6 py-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "First Name *" }), _jsx("input", { required: true, value: form.firstName, onChange: (e) => set("firstName", e.target.value), className: inp, placeholder: "e.g. Ahmed" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Last Name" }), _jsx("input", { value: form.lastName, onChange: (e) => set("lastName", e.target.value), className: inp, placeholder: "e.g. Al Rashidi" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => set("email", e.target.value), className: inp, placeholder: "email@example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Phone" }), _jsx("input", { value: form.phone, onChange: (e) => set("phone", e.target.value), className: inp, placeholder: "+971501234567" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "WhatsApp" }), _jsx("input", { value: form.whatsapp, onChange: (e) => set("whatsapp", e.target.value), className: inp, placeholder: "+971501234567" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Nationality" }), _jsx("input", { value: form.nationality, onChange: (e) => set("nationality", e.target.value), className: inp, placeholder: "e.g. UAE" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Company" }), _jsx("input", { value: form.company, onChange: (e) => set("company", e.target.value), className: inp, placeholder: "Company name" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Job Title" }), _jsx("input", { value: form.jobTitle, onChange: (e) => set("jobTitle", e.target.value), className: inp, placeholder: "CEO, Investor..." })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Source" }), _jsx("select", { value: form.source, onChange: (e) => set("source", e.target.value), className: inp, children: SOURCES.map((s) => _jsx("option", { value: s, children: s.replace(/_/g, " ") }, s)) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Tags (comma-separated)" }), _jsx("input", { value: form.tags, onChange: (e) => set("tags", e.target.value), className: inp, placeholder: "VIP, investor, returning-client" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Notes" }), _jsx("textarea", { value: form.notes, onChange: (e) => set("notes", e.target.value), rows: 3, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white resize-none", placeholder: "Any additional notes..." })] }), error && _jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error }), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Contact" })] })] })] }) }));
}
