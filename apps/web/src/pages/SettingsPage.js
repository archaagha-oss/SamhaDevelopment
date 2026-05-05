import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const sel = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const TIMEZONES = [
    "Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain",
    "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
];
const CURRENCIES = ["AED", "SAR", "USD", "EUR", "GBP", "QAR", "KWD", "BHD", "OMR"];
const DATE_FORMATS = [
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY (e.g. 30/04/2026)" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY (e.g. 04/30/2026)" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD (e.g. 2026-04-30)" },
];
export default function SettingsPage() {
    const [tab, setTab] = useState("company");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({
        timezone: "Asia/Dubai",
        currency: "AED",
        dateFormat: "DD/MM/YYYY",
    });
    useEffect(() => {
        axios.get("/api/settings")
            .then((r) => setForm(r.data))
            .catch(() => setError("Failed to load settings"))
            .finally(() => setLoading(false));
    }, []);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const handleSave = async () => {
        setSaving(true);
        setSaved(null);
        setError(null);
        try {
            const updated = await axios.patch("/api/settings", form);
            setForm(updated.data);
            setSaved("Settings saved successfully.");
            setTimeout(() => setSaved(null), 3000);
        }
        catch (e) {
            setError(e.response?.data?.error || "Failed to save settings");
        }
        finally {
            setSaving(false);
        }
    };
    const tabs = [
        { key: "company", label: "Company Profile" },
        { key: "localization", label: "Localization" },
        { key: "communication", label: "Communication" },
    ];
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-slate-50", children: [_jsxs("div", { className: "bg-white border-b border-slate-200 sticky top-0 z-10", children: [_jsxs("div", { className: "max-w-3xl mx-auto px-6 py-4", children: [_jsx("h1", { className: "text-xl font-bold text-slate-900", children: "App Settings" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Organization-level configuration and communication setup" })] }), _jsx("div", { className: "max-w-3xl mx-auto px-6 flex gap-1", children: tabs.map((t) => (_jsx("button", { onClick: () => { setTab(t.key); setSaved(null); setError(null); }, className: `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-slate-500 hover:text-slate-800"}`, children: t.label }, t.key))) })] }), _jsxs("div", { className: "max-w-3xl mx-auto px-6 py-6 space-y-5", children: [error && (_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex justify-between items-center", children: [_jsx("p", { className: "text-sm text-red-700", children: error }), _jsx("button", { onClick: () => setError(null), className: "text-red-400 hover:text-red-600 ml-4", children: "\u00D7" })] })), saved && (_jsx("div", { className: "bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3", children: _jsx("p", { className: "text-sm text-emerald-700", children: saved }) })), tab === "company" && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Company Profile" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Company Name" }), _jsx("input", { className: inp, value: form.companyName ?? "", onChange: (e) => set("companyName", e.target.value), placeholder: "e.g. Samha Development" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Logo URL" }), _jsx("input", { className: inp, value: form.logoUrl ?? "", onChange: (e) => set("logoUrl", e.target.value), placeholder: "https://..." })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Brand Color (hex)" }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: form.primaryColor ?? "#2563eb", onChange: (e) => set("primaryColor", e.target.value), className: "h-10 w-12 rounded border border-slate-200 cursor-pointer" }), _jsx("input", { className: inp, value: form.primaryColor ?? "", onChange: (e) => set("primaryColor", e.target.value), placeholder: "#2563eb" })] })] })] })] })), tab === "localization" && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Localization" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Timezone" }), _jsx("select", { className: sel, value: form.timezone, onChange: (e) => set("timezone", e.target.value), children: TIMEZONES.map((tz) => _jsx("option", { value: tz, children: tz }, tz)) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Currency" }), _jsx("select", { className: sel, value: form.currency, onChange: (e) => set("currency", e.target.value), children: CURRENCIES.map((c) => _jsx("option", { value: c, children: c }, c)) })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Date Format" }), _jsx("select", { className: sel, value: form.dateFormat, onChange: (e) => set("dateFormat", e.target.value), children: DATE_FORMATS.map((f) => _jsx("option", { value: f.value, children: f.label }, f.value)) })] })] })] })), tab === "communication" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Email" }), _jsx("p", { className: "text-xs text-slate-400", children: "Used as the sender for automated emails (future integration)." }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "From Name" }), _jsx("input", { className: inp, value: form.defaultFromName ?? "", onChange: (e) => set("defaultFromName", e.target.value), placeholder: "e.g. Samha Sales Team" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "From Email" }), _jsx("input", { type: "email", className: inp, value: form.defaultFromEmail ?? "", onChange: (e) => set("defaultFromEmail", e.target.value), placeholder: "sales@samha.ae" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Email Provider" }), _jsxs("select", { className: sel, value: form.emailProvider ?? "", onChange: (e) => set("emailProvider", e.target.value), children: [_jsx("option", { value: "", children: "Not configured" }), _jsx("option", { value: "sendgrid", children: "SendGrid" }), _jsx("option", { value: "smtp", children: "SMTP" }), _jsx("option", { value: "mailgun", children: "Mailgun" }), _jsx("option", { value: "ses", children: "Amazon SES" })] })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "WhatsApp & SMS" }), _jsx("p", { className: "text-xs text-slate-400", children: "Used for direct messaging to leads and contacts (future integration)." }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "WhatsApp Number" }), _jsx("input", { className: inp, value: form.whatsappNumber ?? "", onChange: (e) => set("whatsappNumber", e.target.value), placeholder: "+971501234567" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "SMS Provider" }), _jsxs("select", { className: sel, value: form.smsProvider ?? "", onChange: (e) => set("smsProvider", e.target.value), children: [_jsx("option", { value: "", children: "Not configured" }), _jsx("option", { value: "twilio", children: "Twilio" }), _jsx("option", { value: "unifonic", children: "Unifonic" }), _jsx("option", { value: "stc", children: "STC Pay" })] })] })] })] })] })), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: handleSave, disabled: saving, className: "px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors", children: saving ? "Saving…" : "Save Settings" }) })] })] }));
}
