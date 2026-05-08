import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const sel = inp;
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
function fromSettings(s) {
    return {
        companyName: s.companyName ?? "",
        logoUrl: s.logoUrl ?? "",
        primaryColor: s.primaryColor ?? "#2563eb",
        timezone: s.timezone,
        currency: s.currency,
        dateFormat: s.dateFormat,
        defaultFromName: s.defaultFromName ?? "",
        defaultFromEmail: s.defaultFromEmail ?? "",
        whatsappNumber: s.whatsappNumber ?? "",
        smsProvider: s.smsProvider ?? "",
        emailProvider: s.emailProvider ?? "",
        smtpHost: s.smtpHost ?? "",
        smtpPort: s.smtpPort != null ? String(s.smtpPort) : "",
        smtpUsername: s.smtpUsername ?? "",
        smtpPassword: "",
        smtpPasswordSet: s.smtpPasswordSet,
        paymentInstructions: s.paymentInstructions ?? "",
        emailTemplates: s.emailTemplates ?? {},
    };
}
export default function SettingsPage() {
    const { settings, isLoading, refresh } = useSettings();
    const [tab, setTab] = useState("company");
    const [form, setForm] = useState(() => fromSettings(settings));
    const [saving, setSaving] = useState(null); // section being saved
    useEffect(() => { setForm(fromSettings(settings)); }, [settings]);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    async function save(section, body) {
        if (section === "audit")
            return;
        setSaving(section);
        const reason = window.prompt("Optional: reason for this change (recorded in audit log). Leave blank to skip.") ?? "";
        try {
            await axios.patch(`/api/settings/${apiSection[section]}`, { ...body, ...(reason.trim() ? { _reason: reason.trim() } : {}) });
            await refresh();
            toast.success(`${labels[section]} saved`);
        }
        catch (e) {
            const details = e.response?.data?.details;
            toast.error(details?.[0] ?? e.response?.data?.error ?? "Save failed");
        }
        finally {
            setSaving(null);
        }
    }
    const tabs = [
        { key: "company", label: "Company Profile" },
        { key: "localization", label: "Localization" },
        { key: "communication", label: "Communication" },
        { key: "finance", label: "Finance" },
        { key: "templates", label: "Email Templates" },
        { key: "audit", label: "Audit Log" },
    ];
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-slate-50", children: [_jsxs("div", { className: "bg-white border-b border-slate-200 sticky top-0 z-10", children: [_jsxs("div", { className: "max-w-3xl mx-auto px-6 py-4", children: [_jsx("h1", { className: "text-xl font-bold text-slate-900", children: "App Settings" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Organization-level configuration and communication setup" })] }), _jsx("div", { className: "max-w-3xl mx-auto px-6 flex gap-1", children: tabs.map((t) => (_jsx("button", { onClick: () => setTab(t.key), className: `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-slate-500 hover:text-slate-800"}`, children: t.label }, t.key))) })] }), _jsxs("div", { className: "max-w-3xl mx-auto px-6 py-6 space-y-5", children: [tab === "company" && _jsx(CompanySection, { form: form, set: set, saving: saving === "company", onSave: () => save("company", { companyName: form.companyName, logoUrl: form.logoUrl, primaryColor: form.primaryColor }) }), tab === "localization" && _jsx(LocalizationSection, { form: form, set: set, saving: saving === "localization", onSave: () => save("localization", { timezone: form.timezone, currency: form.currency, dateFormat: form.dateFormat }) }), tab === "communication" && _jsx(CommunicationSection, { form: form, set: set, saving: saving === "communication", onSave: () => save("communication", communicationBody(form)) }), tab === "finance" && _jsx(FinanceSection, { form: form, set: set, saving: saving === "finance", onSave: () => save("finance", { paymentInstructions: form.paymentInstructions }) }), tab === "templates" && _jsx(TemplatesSection, { form: form, set: set, saving: saving === "templates", onSave: () => save("templates", { emailTemplates: form.emailTemplates }) }), tab === "audit" && _jsx(AuditLogSection, {})] })] }));
}
const apiSection = {
    company: "branding",
    localization: "localization",
    communication: "communication",
    finance: "finance",
    templates: "templates",
    audit: "",
};
const labels = {
    company: "Company profile",
    localization: "Localization",
    communication: "Communication",
    finance: "Finance",
    templates: "Email templates",
    audit: "Audit log",
};
function communicationBody(f) {
    const body = {
        defaultFromName: f.defaultFromName,
        defaultFromEmail: f.defaultFromEmail,
        emailProvider: f.emailProvider,
        whatsappNumber: f.whatsappNumber,
        smsProvider: f.smsProvider,
        smtpHost: f.smtpHost,
        smtpUsername: f.smtpUsername,
    };
    body.smtpPort = f.smtpPort === "" ? "" : Number(f.smtpPort);
    // Only send smtpPassword if user typed something. Empty = no edit.
    if (f.smtpPassword.length > 0)
        body.smtpPassword = f.smtpPassword;
    return body;
}
function SaveBar({ saving, onSave, label = "Save section" }) {
    return (_jsx("div", { className: "flex justify-end pt-2", children: _jsx("button", { onClick: onSave, disabled: saving, className: "px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors", children: saving ? "Saving…" : label }) }));
}
function CompanySection({ form, set, saving, onSave }) {
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Company Profile" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Company Name" }), _jsx("input", { className: inp, value: form.companyName, onChange: (e) => set("companyName", e.target.value), placeholder: "e.g. Samha Development" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Logo URL" }), _jsx("input", { className: inp, value: form.logoUrl, onChange: (e) => set("logoUrl", e.target.value), placeholder: "https://..." })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Brand Color (hex)" }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : "#2563eb", onChange: (e) => set("primaryColor", e.target.value), className: "h-10 w-12 rounded border border-slate-200 cursor-pointer" }), _jsx("input", { className: inp, value: form.primaryColor, onChange: (e) => set("primaryColor", e.target.value), placeholder: "#2563eb" })] }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "Drives sidebar accents and the app theme variable." })] })] })] }), _jsx(SaveBar, { saving: saving, onSave: onSave })] }));
}
function LocalizationSection({ form, set, saving, onSave }) {
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Localization" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Timezone" }), _jsx("select", { className: sel, value: form.timezone, onChange: (e) => set("timezone", e.target.value), children: TIMEZONES.map((tz) => _jsx("option", { value: tz, children: tz }, tz)) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Currency" }), _jsx("select", { className: sel, value: form.currency, onChange: (e) => set("currency", e.target.value), children: CURRENCIES.map((c) => _jsx("option", { value: c, children: c }, c)) })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Date Format" }), _jsx("select", { className: sel, value: form.dateFormat, onChange: (e) => set("dateFormat", e.target.value), children: DATE_FORMATS.map((f) => _jsx("option", { value: f.value, children: f.label }, f.value)) })] })] }), _jsx("p", { className: "text-[11px] text-slate-400", children: "Applied app-wide to amounts and dates after saving." })] }), _jsx(SaveBar, { saving: saving, onSave: onSave })] }));
}
function CommunicationSection({ form, set, saving, onSave }) {
    const [testTo, setTestTo] = useState("");
    const [testing, setTesting] = useState(false);
    async function testSmtp() {
        if (!testTo) {
            toast.error("Enter a destination email");
            return;
        }
        setTesting(true);
        try {
            await axios.post("/api/settings/test-smtp", { to: testTo });
            toast.success(`Test email queued to ${testTo}`);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? "Test failed");
        }
        finally {
            setTesting(false);
        }
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Email Sender" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "From Name" }), _jsx("input", { className: inp, value: form.defaultFromName, onChange: (e) => set("defaultFromName", e.target.value), placeholder: "e.g. Samha Sales Team" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "From Email" }), _jsx("input", { type: "email", className: inp, value: form.defaultFromEmail, onChange: (e) => set("defaultFromEmail", e.target.value), placeholder: "sales@samha.ae" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Email Provider" }), _jsxs("select", { className: sel, value: form.emailProvider, onChange: (e) => set("emailProvider", e.target.value), children: [_jsx("option", { value: "", children: "Not configured" }), _jsx("option", { value: "sendgrid", children: "SendGrid" }), _jsx("option", { value: "smtp", children: "SMTP" }), _jsx("option", { value: "mailgun", children: "Mailgun" }), _jsx("option", { value: "ses", children: "Amazon SES" })] })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "SMTP Delivery" }), _jsx("p", { className: "text-xs text-slate-400", children: "Used when Email Provider is set to SMTP." }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "SMTP Host" }), _jsx("input", { className: inp, value: form.smtpHost, onChange: (e) => set("smtpHost", e.target.value), placeholder: "smtp.gmail.com" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "SMTP Port" }), _jsx("input", { type: "number", className: inp, value: form.smtpPort, onChange: (e) => set("smtpPort", e.target.value), placeholder: "587" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Username" }), _jsx("input", { className: inp, value: form.smtpUsername, onChange: (e) => set("smtpUsername", e.target.value), placeholder: "your@email.com" })] }), _jsxs("div", { children: [_jsxs("label", { className: lbl, children: ["Password", _jsx("span", { className: `ml-2 text-[10px] font-normal ${form.smtpPasswordSet ? "text-emerald-600" : "text-slate-400"}`, children: form.smtpPasswordSet ? "● set" : "not set" })] }), _jsx("input", { type: "password", className: inp, value: form.smtpPassword, onChange: (e) => set("smtpPassword", e.target.value), placeholder: form.smtpPasswordSet ? "•••••••• (leave blank to keep)" : "Enter password", autoComplete: "new-password" })] })] }), _jsxs("div", { className: "flex gap-2 items-center pt-1", children: [_jsx("input", { type: "email", className: inp + " flex-1", value: testTo, onChange: (e) => setTestTo(e.target.value), placeholder: "Send test email to\u2026" }), _jsx("button", { onClick: testSmtp, disabled: testing, className: "px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50", children: testing ? "Sending…" : "Test SMTP" })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "WhatsApp & SMS" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "WhatsApp Number" }), _jsx("input", { className: inp, value: form.whatsappNumber, onChange: (e) => set("whatsappNumber", e.target.value), placeholder: "+971501234567" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "SMS Provider" }), _jsxs("select", { className: sel, value: form.smsProvider, onChange: (e) => set("smsProvider", e.target.value), children: [_jsx("option", { value: "", children: "Not configured" }), _jsx("option", { value: "twilio", children: "Twilio" }), _jsx("option", { value: "unifonic", children: "Unifonic" }), _jsx("option", { value: "stc", children: "STC Pay" })] })] })] })] }), _jsx(SaveBar, { saving: saving, onSave: onSave })] }));
}
function FinanceSection({ form, set, saving, onSave }) {
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1", children: "Payment Instructions" }), _jsx("p", { className: "text-xs text-slate-400 mb-3", children: "Auto-injected into invoices and reminder emails. Include bank name, account name, IBAN, and Swift code." }), _jsx("textarea", { className: inp + " resize-y min-h-[140px]", value: form.paymentInstructions, onChange: (e) => set("paymentInstructions", e.target.value), placeholder: `Bank Name: Emirates NBD\nAccount Name: Samha Development LLC\nIBAN: AE123456789012345678\nSwift Code: EBILAEAD` })] }) }), _jsx(PermissionsMatrix, {}), _jsx(SaveBar, { saving: saving, onSave: onSave })] }));
}
function PermissionsMatrix() {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4", children: "Role Permissions Reference" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("th", { className: "text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Action" }), ["Admin", "Manager", "Agent", "Finance"].map((r) => (_jsx("th", { className: "text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: r }, r)))] }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: [
                                ["Create Deal", true, true, true, false],
                                ["Reserve Unit", true, true, true, false],
                                ["Record Payment", true, false, false, true],
                                ["Generate Receipt", true, false, false, true],
                                ["Manage Settings", true, false, false, false],
                                ["View Reports", true, true, false, true],
                            ].map(([action, ...perms]) => (_jsxs("tr", { children: [_jsx("td", { className: "py-2.5 pr-4 text-sm text-slate-700", children: action }), perms.map((allowed, i) => (_jsx("td", { className: "py-2.5 px-3 text-center", children: _jsx("span", { className: allowed ? "text-emerald-600 font-bold" : "text-slate-300", children: allowed ? "✓" : "–" }) }, i)))] }, String(action)))) })] }) }), _jsx("p", { className: "text-xs text-slate-400 mt-3", children: "Roles are managed per user in the Team section. Settings PATCH endpoints enforce ADMIN role server-side." })] }));
}
function TemplatesSection({ form, set, saving, onSave }) {
    const [previewKey, setPreviewKey] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    async function loadPreview(key) {
        setPreviewing(true);
        setPreviewKey(key);
        try {
            // Persist current edits before previewing so the preview reflects them.
            await axios.patch("/api/settings/templates", { emailTemplates: form.emailTemplates });
            const r = await axios.post("/api/settings/templates/preview", { key });
            setPreview(r.data);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? "Preview failed");
        }
        finally {
            setPreviewing(false);
        }
    }
    const templates = useMemo(() => ([
        { key: "beforeDue", label: "7 Days Before Due", desc: "Friendly reminder — sent 7 days before the due date" },
        { key: "onDue", label: "Payment Due Today", desc: "Urgent reminder — sent on the due date" },
        { key: "overdue7", label: "7 Days Overdue", desc: "Overdue notice — sent 7 days after the due date" },
        { key: "overdue30", label: "30 Days Overdue (Final)", desc: "Final notice — sent 30 days after the due date" },
    ]), []);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700", children: [_jsx("p", { className: "font-semibold mb-1", children: "Template Variables" }), _jsxs("p", { children: ["Use: ", _jsx("code", { className: "bg-amber-100 px-1 rounded", children: "{{BuyerName}}" }), " ", _jsx("code", { className: "bg-amber-100 px-1 rounded", children: "{{UnitNumber}}" }), " ", _jsx("code", { className: "bg-amber-100 px-1 rounded", children: "{{Amount}}" }), " ", _jsx("code", { className: "bg-amber-100 px-1 rounded", children: "{{DueDate}}" }), " ", _jsx("code", { className: "bg-amber-100 px-1 rounded", children: "{{ProjectName}}" }), " ", _jsx("code", { className: "bg-amber-100 px-1 rounded", children: "{{Milestone}}" })] })] }), templates.map(({ key, label, desc }) => (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-2", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-700", children: label }), _jsx("p", { className: "text-xs text-slate-400", children: desc })] }), _jsx("button", { onClick: () => loadPreview(key), className: "text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold", disabled: previewing && previewKey === key, children: previewing && previewKey === key ? "Loading…" : "Preview" })] }), _jsx("textarea", { className: inp + " resize-y min-h-[100px] font-mono text-xs", value: form.emailTemplates[key] ?? "", onChange: (e) => set("emailTemplates", { ...form.emailTemplates, [key]: e.target.value }), placeholder: `Dear {{BuyerName}},\n\nYour payment of {{Amount}} for {{Milestone}} is due on {{DueDate}}.\n\nThank you.` }), previewKey === key && preview && (_jsxs("div", { className: "mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50", children: [_jsx("p", { className: "text-[10px] font-semibold text-slate-500 uppercase", children: "Preview" }), _jsx("p", { className: "text-xs font-bold text-slate-800 mb-2", children: preview.subject }), _jsx("pre", { className: "whitespace-pre-wrap text-xs text-slate-600 font-sans", children: preview.text })] }))] }, key))), _jsx(SaveBar, { saving: saving, onSave: onSave })] }));
}
function AuditLogSection() {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [warning, setWarning] = useState(null);
    const [section, setSection] = useState("");
    const [expanded, setExpanded] = useState(null);
    async function load() {
        setLoading(true);
        try {
            const r = await axios.get("/api/settings/audit-log", {
                params: { limit: 50, section: section || undefined },
            });
            setItems(r.data.data || []);
            setTotal(r.data.total ?? 0);
            setWarning(r.data.warning ?? null);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? "Failed to load audit log");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section]);
    const sections = ["", "branding", "localization", "communication", "finance", "templates", "notifications"];
    return (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Audit Log" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [total, " entries \u2014 admin-only, last 50 shown"] })] }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("select", { className: sel + " w-44", value: section, onChange: (e) => setSection(e.target.value), children: sections.map((s) => (_jsx("option", { value: s, children: s ? s : "All sections" }, s))) }), _jsx("button", { onClick: load, disabled: loading, className: "px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50", children: loading ? "Refreshing…" : "Refresh" })] })] }), warning && (_jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700", children: warning })), items.length === 0 && !loading && !warning && (_jsx("p", { className: "text-sm text-slate-400 py-8 text-center", children: "No settings changes recorded yet." })), _jsx("div", { className: "divide-y divide-slate-100", children: items.map((it) => (_jsxs("div", { className: "py-3", children: [_jsxs("button", { onClick: () => setExpanded((id) => (id === it.id ? null : it.id)), className: "w-full flex items-start justify-between gap-3 text-left hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-slate-100 text-slate-700", children: it.section }), _jsx("span", { className: "text-xs text-slate-700 font-medium", children: it.changedFields.join(", ") })] }), _jsxs("p", { className: "text-xs text-slate-400 mt-1", children: [it.user ? `${it.user.name} (${it.user.role})` : "Unknown user", " · ", new Date(it.createdAt).toLocaleString(), it.ip ? ` · ${it.ip}` : ""] }), it.reason && (_jsxs("p", { className: "text-xs text-slate-600 mt-1 italic", children: ["\"", it.reason, "\""] }))] }), _jsx("span", { className: "text-slate-400 text-xs flex-shrink-0", children: expanded === it.id ? "▾" : "▸" })] }), expanded === it.id && (_jsxs("div", { className: "grid grid-cols-2 gap-3 mt-2 px-2", children: [_jsxs("div", { className: "bg-rose-50 border border-rose-100 rounded-lg p-3", children: [_jsx("p", { className: "text-[10px] font-bold text-rose-600 uppercase mb-1", children: "Before" }), _jsx("pre", { className: "text-[11px] text-slate-700 whitespace-pre-wrap font-mono break-all", children: JSON.stringify(it.before ?? {}, null, 2) })] }), _jsxs("div", { className: "bg-emerald-50 border border-emerald-100 rounded-lg p-3", children: [_jsx("p", { className: "text-[10px] font-bold text-emerald-600 uppercase mb-1", children: "After" }), _jsx("pre", { className: "text-[11px] text-slate-700 whitespace-pre-wrap font-mono break-all", children: JSON.stringify(it.after ?? {}, null, 2) })] })] }))] }, it.id))) })] }) }));
}
