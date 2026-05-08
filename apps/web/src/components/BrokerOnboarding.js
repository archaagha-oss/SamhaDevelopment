import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
const emptyCompanyForm = () => ({
    name: "", email: "", phone: "", website: "", commissionRate: "4",
    reraLicenseNumber: "", reraLicenseExpiry: "",
    tradeLicenseNumber: "", tradeLicenseCopyUrl: "",
    vatCertificateNo: "", vatCertificateUrl: "",
    corporateTaxCertUrl: "", ornCertificateUrl: "",
    bankName: "", bankAccountName: "", bankAccountNo: "", bankIban: "", bankCurrency: "AED",
});
const emptyAgentForm = () => ({
    firstName: "", lastName: "", email: "", phone: "",
    reraCardNumber: "", reraCardExpiry: "",
    eidNo: "", eidExpiry: "", acceptedConsent: false,
});
const INPUT_CLS = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400";
const LABEL_CLS = "text-xs text-slate-600 mb-1 block font-medium";
function FileUploadField({ label, value, onChange, accept = "image/jpeg,image/png,application/pdf", }) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef(null);
    const handleFile = async (file) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const { data } = await axios.post("/api/brokers/upload", fd);
            onChange(data.url);
            toast.success("File uploaded");
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Upload failed");
        }
        finally {
            setUploading(false);
        }
    };
    return (_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: label }), _jsx("input", { ref: inputRef, type: "file", accept: accept, onChange: (e) => e.target.files && handleFile(e.target.files[0]), className: "hidden" }), _jsx("button", { onClick: () => inputRef.current?.click(), disabled: uploading, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:bg-slate-50 transition-colors disabled:opacity-50", children: value ? "✓ Uploaded" : uploading ? "Uploading…" : "Choose File" })] }));
}
export default function BrokerOnboarding() {
    const [step, setStep] = useState(1);
    const [company, setCompany] = useState(emptyCompanyForm());
    const [agent, setAgent] = useState(emptyAgentForm());
    const [agents, setAgents] = useState([]);
    const [saving, setSaving] = useState(false);
    const [companyId, setCompanyId] = useState(null);
    const handleCompanyChange = (field, value) => {
        setCompany((prev) => ({ ...prev, [field]: value }));
    };
    const handleAgentChange = (field, value) => {
        setAgent((prev) => ({ ...prev, [field]: value }));
    };
    const handleAddAgent = () => {
        if (!agent.firstName || !agent.lastName || !agent.email || !agent.phone) {
            toast.error("Please fill in all required agent fields");
            return;
        }
        setAgents((prev) => [...prev, agent]);
        setAgent(emptyAgentForm());
    };
    const handleRemoveAgent = (idx) => {
        setAgents((prev) => prev.filter((_, i) => i !== idx));
    };
    const handleSubmitCompany = async () => {
        if (!company.name || !company.email || !company.phone || !company.reraLicenseNumber) {
            toast.error("Please fill in all required company fields");
            return;
        }
        setSaving(true);
        try {
            const { data } = await axios.post("/api/brokers/companies", company);
            setCompanyId(data.id);
            toast.success("Company registered successfully");
            setStep(2);
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to register company");
        }
        finally {
            setSaving(false);
        }
    };
    const handleSubmitAgents = async () => {
        if (agents.length === 0) {
            toast.error("Please add at least one agent");
            return;
        }
        setSaving(true);
        try {
            for (const a of agents) {
                await axios.post("/api/brokers/agents", {
                    ...a,
                    companyId,
                    name: `${a.firstName} ${a.lastName}`,
                });
            }
            toast.success("All agents registered successfully");
            setStep(3);
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to register agents");
        }
        finally {
            setSaving(false);
        }
    };
    const handleComplete = () => {
        toast.success("Broker onboarding completed!");
        window.location.href = "/brokers";
    };
    return (_jsx("div", { className: "min-h-screen bg-slate-50 py-12", children: _jsxs("div", { className: "max-w-2xl mx-auto px-4", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-4xl font-bold text-slate-900", children: "Broker Onboarding" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Complete registration in 3 steps" })] }), _jsx("div", { className: "mb-8 flex gap-4", children: [1, 2, 3].map((s) => (_jsxs("div", { className: "flex-1 flex items-center gap-2", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= s
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-200 text-slate-600"}`, children: step > s ? "✓" : s }), _jsxs("span", { className: `text-sm font-medium ${step >= s ? "text-slate-900" : "text-slate-500"}`, children: [s === 1 && "Company", s === 2 && "Agents", s === 3 && "Complete"] })] }, s))) }), step === 1 && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-8 shadow-sm", children: [_jsx("h2", { className: "text-2xl font-bold text-slate-900 mb-6", children: "Company Details" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Company Name *" }), _jsx("input", { type: "text", value: company.name, onChange: (e) => handleCompanyChange("name", e.target.value), className: INPUT_CLS, placeholder: "e.g., Elite Real Estate" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Email *" }), _jsx("input", { type: "email", value: company.email, onChange: (e) => handleCompanyChange("email", e.target.value), className: INPUT_CLS, placeholder: "company@email.com" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Phone *" }), _jsx("input", { type: "tel", value: company.phone, onChange: (e) => handleCompanyChange("phone", e.target.value), className: INPUT_CLS, placeholder: "+971 50 123 4567" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Website" }), _jsx("input", { type: "url", value: company.website || "", onChange: (e) => handleCompanyChange("website", e.target.value), className: INPUT_CLS, placeholder: "https://company.com" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Commission Rate (%) *" }), _jsx("input", { type: "number", value: company.commissionRate, onChange: (e) => handleCompanyChange("commissionRate", e.target.value), className: INPUT_CLS, placeholder: "4", min: "0", max: "10" })] })] }), _jsx("h3", { className: "text-lg font-semibold text-slate-900 mb-4 mt-8", children: "Compliance Documents" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "RERA License Number *" }), _jsx("input", { type: "text", value: company.reraLicenseNumber, onChange: (e) => handleCompanyChange("reraLicenseNumber", e.target.value), className: INPUT_CLS, placeholder: "RERA-2024-123456" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "RERA License Expiry *" }), _jsx("input", { type: "date", value: company.reraLicenseExpiry, onChange: (e) => handleCompanyChange("reraLicenseExpiry", e.target.value), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Trade License Number" }), _jsx("input", { type: "text", value: company.tradeLicenseNumber, onChange: (e) => handleCompanyChange("tradeLicenseNumber", e.target.value), className: INPUT_CLS, placeholder: "Trade-2024-789" })] }), _jsx(FileUploadField, { label: "Trade License Copy", value: company.tradeLicenseCopyUrl, onChange: (url) => handleCompanyChange("tradeLicenseCopyUrl", url) }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "VAT Certificate Number" }), _jsx("input", { type: "text", value: company.vatCertificateNo, onChange: (e) => handleCompanyChange("vatCertificateNo", e.target.value), className: INPUT_CLS, placeholder: "VAT-123456" })] }), _jsx(FileUploadField, { label: "VAT Certificate", value: company.vatCertificateUrl, onChange: (url) => handleCompanyChange("vatCertificateUrl", url) }), _jsx(FileUploadField, { label: "Corporate Tax Certificate", value: company.corporateTaxCertUrl, onChange: (url) => handleCompanyChange("corporateTaxCertUrl", url) }), _jsx(FileUploadField, { label: "ORN Certificate", value: company.ornCertificateUrl, onChange: (url) => handleCompanyChange("ornCertificateUrl", url) })] }), _jsx("h3", { className: "text-lg font-semibold text-slate-900 mb-4 mt-8", children: "Bank Details" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Bank Name" }), _jsx("input", { type: "text", value: company.bankName, onChange: (e) => handleCompanyChange("bankName", e.target.value), className: INPUT_CLS, placeholder: "e.g., Emirates NBD" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Account Name" }), _jsx("input", { type: "text", value: company.bankAccountName, onChange: (e) => handleCompanyChange("bankAccountName", e.target.value), className: INPUT_CLS, placeholder: "Company Name" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Account Number" }), _jsx("input", { type: "text", value: company.bankAccountNo, onChange: (e) => handleCompanyChange("bankAccountNo", e.target.value), className: INPUT_CLS, placeholder: "1234567890" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "IBAN" }), _jsx("input", { type: "text", value: company.bankIban, onChange: (e) => handleCompanyChange("bankIban", e.target.value), className: INPUT_CLS, placeholder: "AE070331234567890123456" })] })] }), _jsx("div", { className: "flex gap-3 mt-8", children: _jsx("button", { onClick: handleSubmitCompany, disabled: saving, className: "flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors", children: saving ? "Saving…" : "Continue to Agents" }) })] })), step === 2 && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-8 shadow-sm", children: [_jsx("h2", { className: "text-2xl font-bold text-slate-900 mb-6", children: "Register Agents" }), _jsxs("div", { className: "mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4", children: "Add Agent" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "First Name *" }), _jsx("input", { type: "text", value: agent.firstName, onChange: (e) => handleAgentChange("firstName", e.target.value), className: INPUT_CLS, placeholder: "Ahmed" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Last Name *" }), _jsx("input", { type: "text", value: agent.lastName, onChange: (e) => handleAgentChange("lastName", e.target.value), className: INPUT_CLS, placeholder: "Al Mansouri" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Email *" }), _jsx("input", { type: "email", value: agent.email, onChange: (e) => handleAgentChange("email", e.target.value), className: INPUT_CLS, placeholder: "agent@company.com" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Phone *" }), _jsx("input", { type: "tel", value: agent.phone, onChange: (e) => handleAgentChange("phone", e.target.value), className: INPUT_CLS, placeholder: "+971 50 123 4567" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "RERA Card Number" }), _jsx("input", { type: "text", value: agent.reraCardNumber, onChange: (e) => handleAgentChange("reraCardNumber", e.target.value), className: INPUT_CLS, placeholder: "RERA-AGENT-2024-123" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "RERA Card Expiry" }), _jsx("input", { type: "date", value: agent.reraCardExpiry, onChange: (e) => handleAgentChange("reraCardExpiry", e.target.value), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "EID Number" }), _jsx("input", { type: "text", value: agent.eidNo, onChange: (e) => handleAgentChange("eidNo", e.target.value), className: INPUT_CLS, placeholder: "784-1994-1234567-8" })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "EID Expiry" }), _jsx("input", { type: "date", value: agent.eidExpiry, onChange: (e) => handleAgentChange("eidExpiry", e.target.value), className: INPUT_CLS })] })] }), _jsxs("label", { className: "flex items-center gap-2 mb-4", children: [_jsx("input", { type: "checkbox", checked: agent.acceptedConsent, onChange: (e) => handleAgentChange("acceptedConsent", e.target.checked), className: "w-4 h-4" }), _jsx("span", { className: "text-xs text-slate-600", children: "I accept the terms and conditions" })] }), _jsx("button", { onClick: handleAddAgent, className: "w-full px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors", children: "+ Add Agent" })] }), agents.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsxs("h3", { className: "text-sm font-semibold text-slate-900 mb-3", children: ["Registered Agents (", agents.length, ")"] }), _jsx("div", { className: "space-y-2", children: agents.map((a, idx) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200", children: [_jsxs("div", { children: [_jsxs("p", { className: "font-medium text-slate-900", children: [a.firstName, " ", a.lastName] }), _jsx("p", { className: "text-xs text-slate-600", children: a.email })] }), _jsx("button", { onClick: () => handleRemoveAgent(idx), className: "px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm font-medium", children: "Remove" })] }, idx))) })] })), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => setStep(1), className: "flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors", children: "Back" }), _jsx("button", { onClick: handleSubmitAgents, disabled: saving, className: "flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors", children: saving ? "Saving…" : "Continue" })] })] })), step === 3 && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center", children: [_jsx("div", { className: "w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4", children: "\u2713" }), _jsx("h2", { className: "text-2xl font-bold text-slate-900 mb-2", children: "Onboarding Complete!" }), _jsx("p", { className: "text-slate-600 mb-8", children: "Your broker company and agents have been successfully registered." }), _jsxs("div", { className: "bg-slate-50 rounded-lg p-4 mb-8 text-left", children: [_jsx("h3", { className: "font-semibold text-slate-900 mb-2", children: "What's Next?" }), _jsxs("ul", { className: "text-sm text-slate-700 space-y-1", children: [_jsxs("li", { children: ["\u2713 Company and ", agents.length, " agent(s) registered"] }), _jsx("li", { children: "\u2713 RERA and compliance documents stored" }), _jsx("li", { children: "\u2713 Bank details configured for commission payouts" }), _jsx("li", { children: "\u2192 Start assigning agents to leads" }), _jsx("li", { children: "\u2192 Monitor commission approvals in dashboard" })] })] }), _jsx("button", { onClick: handleComplete, className: "w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors", children: "Go to Broker Management" })] }))] }) }));
}
