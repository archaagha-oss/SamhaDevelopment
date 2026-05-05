import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const INPUT_CLS = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400";
const LABEL_CLS = "text-xs text-slate-500 mb-1 block font-medium";
const SECTION_CLS = "border-t border-slate-100 pt-4 mt-4";
const SECTION_TITLE_CLS = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3";
const emptyCompanyForm = () => ({
    name: "", email: "", phone: "", commissionRate: "4",
    reraLicenseNumber: "", reraLicenseExpiry: "", tradeLicenseNumber: "",
    tradeLicenseCopyUrl: "", vatCertificateNo: "", vatCertificateUrl: "",
    corporateTaxCertUrl: "", officeRegistrationNo: "", ornCertificateUrl: "",
    officeManagerBrokerId: "", website: "",
    officeNo: "", buildingName: "", neighborhood: "", emirate: "", postalCode: "",
    bankName: "", bankAccountName: "", bankAccountNo: "", bankIban: "", bankCurrency: "AED",
});
const emptyAgentForm = () => ({
    firstName: "", lastName: "", email: "", phone: "",
    reraCardNumber: "", reraCardExpiry: "",
    eidNo: "", eidExpiry: "", eidFrontUrl: "", eidBackUrl: "",
    acceptedConsent: false,
});
// Inline file upload field
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
    const filename = value ? value.split("/").pop()?.split("?")[0] || "Uploaded" : "";
    return (_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => inputRef.current?.click(), disabled: uploading, className: "px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-50 whitespace-nowrap", children: uploading ? "Uploading…" : value ? "Replace" : "Choose File" }), value ? (_jsx("a", { href: value, target: "_blank", rel: "noreferrer", className: "text-xs text-blue-500 hover:underline truncate max-w-[180px]", children: filename })) : (_jsx("span", { className: "text-xs text-slate-400", children: "No file selected" })), _jsx("input", { ref: inputRef, type: "file", accept: accept, className: "hidden", onChange: (e) => { const f = e.target.files?.[0]; if (f)
                            handleFile(f); e.target.value = ""; } })] })] }));
}
export default function BrokerPage() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyCompanyForm());
    const [search, setSearch] = useState("");
    const [showAgentForm, setShowAgentForm] = useState(false);
    const [agentForm, setAgentForm] = useState(emptyAgentForm());
    const [showEditForm, setShowEditForm] = useState(false);
    const [editForm, setEditForm] = useState(emptyCompanyForm());
    const [deletingAgent, setDeletingAgent] = useState(null);
    const [confirmDeleteCompany, setConfirmDeleteCompany] = useState(false);
    const [confirmDeleteAgentId, setConfirmDeleteAgentId] = useState(null);
    const fetchCompanies = () => {
        setLoading(true);
        axios.get("/api/brokers/companies")
            .then((r) => setCompanies(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };
    useEffect(fetchCompanies, []);
    const refreshAndReselect = async () => {
        const r = await axios.get("/api/brokers/companies");
        setCompanies(r.data);
        if (selected) {
            const updated = r.data.find((c) => c.id === selected.id);
            if (updated)
                setSelected(updated);
        }
    };
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await axios.post("/api/brokers/companies", {
                ...form,
                commissionRate: parseFloat(form.commissionRate) || 4,
                reraLicenseExpiry: form.reraLicenseExpiry ? new Date(form.reraLicenseExpiry).toISOString() : undefined,
            });
            setForm(emptyCompanyForm());
            setShowForm(false);
            fetchCompanies();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to create company");
        }
    };
    const reraWarning = (expiry) => {
        if (!expiry)
            return null;
        const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
        if (days < 0)
            return { label: "Expired", cls: "bg-red-100 text-red-700" };
        if (days <= 60)
            return { label: `Expires in ${days}d`, cls: "bg-amber-100 text-amber-700" };
        return null;
    };
    const openEditForm = () => {
        if (!selected)
            return;
        setEditForm({
            name: selected.name,
            email: selected.email ?? "",
            phone: selected.phone ?? "",
            commissionRate: String(selected.commissionRate ?? 4),
            reraLicenseNumber: selected.reraLicenseNumber ?? "",
            reraLicenseExpiry: selected.reraLicenseExpiry ? selected.reraLicenseExpiry.slice(0, 10) : "",
            tradeLicenseNumber: selected.tradeLicenseNumber ?? "",
            tradeLicenseCopyUrl: selected.tradeLicenseCopyUrl ?? "",
            vatCertificateNo: selected.vatCertificateNo ?? "",
            vatCertificateUrl: selected.vatCertificateUrl ?? "",
            corporateTaxCertUrl: selected.corporateTaxCertUrl ?? "",
            officeRegistrationNo: selected.officeRegistrationNo ?? "",
            ornCertificateUrl: selected.ornCertificateUrl ?? "",
            officeManagerBrokerId: selected.officeManagerBrokerId ?? "",
            website: selected.website ?? "",
            officeNo: selected.officeNo ?? "",
            buildingName: selected.buildingName ?? "",
            neighborhood: selected.neighborhood ?? "",
            emirate: selected.emirate ?? "",
            postalCode: selected.postalCode ?? "",
            bankName: selected.bankName ?? "",
            bankAccountName: selected.bankAccountName ?? "",
            bankAccountNo: selected.bankAccountNo ?? "",
            bankIban: selected.bankIban ?? "",
            bankCurrency: selected.bankCurrency ?? "AED",
        });
        setShowEditForm(true);
    };
    const handleEdit = async (e) => {
        e.preventDefault();
        if (!selected)
            return;
        try {
            await axios.patch(`/api/brokers/companies/${selected.id}`, {
                ...editForm,
                commissionRate: parseFloat(editForm.commissionRate) || 4,
                reraLicenseExpiry: editForm.reraLicenseExpiry ? new Date(editForm.reraLicenseExpiry).toISOString() : undefined,
            });
            setShowEditForm(false);
            await refreshAndReselect();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update company");
        }
    };
    const handleDeleteCompany = () => { if (selected)
        setConfirmDeleteCompany(true); };
    const doDeleteCompany = async () => {
        if (!selected)
            return;
        setConfirmDeleteCompany(false);
        try {
            await axios.delete(`/api/brokers/companies/${selected.id}`);
            setSelected(null);
            fetchCompanies();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to delete company");
        }
    };
    const handleAddAgent = async (e) => {
        e.preventDefault();
        if (!selected)
            return;
        try {
            await axios.post("/api/brokers/agents", {
                companyId: selected.id,
                ...agentForm,
                reraCardExpiry: agentForm.reraCardExpiry ? new Date(agentForm.reraCardExpiry).toISOString() : undefined,
                eidExpiry: agentForm.eidExpiry ? new Date(agentForm.eidExpiry).toISOString() : undefined,
            });
            setAgentForm(emptyAgentForm());
            setShowAgentForm(false);
            await refreshAndReselect();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to add agent");
        }
    };
    const handleDeleteAgent = (agentId) => setConfirmDeleteAgentId(agentId);
    const doDeleteAgent = async () => {
        const agentId = confirmDeleteAgentId;
        if (!agentId)
            return;
        setConfirmDeleteAgentId(null);
        setDeletingAgent(agentId);
        try {
            await axios.delete(`/api/brokers/agents/${agentId}`);
            await refreshAndReselect();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to remove agent");
        }
        finally {
            setDeletingAgent(null);
        }
    };
    const getTotalCommission = (c) => c.commissions.reduce((s, x) => s + x.amount, 0);
    const getPaidCommission = (c) => c.commissions.filter((x) => x.status === "PAID").reduce((s, x) => s + x.amount, 0);
    const filtered = companies.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));
    // Shared company form fields (used in both create and edit)
    const CompanyFormFields = ({ f, setF, }) => (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Company Name *" }), _jsx("input", { required: true, placeholder: "Company Name", value: f.name, onChange: (e) => setF({ ...f, name: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Commission Rate (%)" }), _jsx("input", { type: "number", step: "0.1", min: "0", max: "20", placeholder: "4", value: f.commissionRate, onChange: (e) => setF({ ...f, commissionRate: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Email" }), _jsx("input", { type: "email", placeholder: "Email", value: f.email, onChange: (e) => setF({ ...f, email: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Phone" }), _jsx("input", { placeholder: "Phone", value: f.phone, onChange: (e) => setF({ ...f, phone: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { className: SECTION_CLS, children: [_jsx("p", { className: SECTION_TITLE_CLS, children: "Licensing" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "License No" }), _jsx("input", { placeholder: "License No", value: f.reraLicenseNumber, onChange: (e) => setF({ ...f, reraLicenseNumber: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "License Expiry Date" }), _jsx("input", { type: "date", value: f.reraLicenseExpiry, onChange: (e) => setF({ ...f, reraLicenseExpiry: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Trade License No" }), _jsx("input", { placeholder: "Trade License No", value: f.tradeLicenseNumber, onChange: (e) => setF({ ...f, tradeLicenseNumber: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Office Registration No (ORN)" }), _jsx("input", { placeholder: "ORN", value: f.officeRegistrationNo, onChange: (e) => setF({ ...f, officeRegistrationNo: e.target.value }), className: INPUT_CLS })] })] }), _jsx(FileUploadField, { label: "Trade License Copy", value: f.tradeLicenseCopyUrl, onChange: (url) => setF({ ...f, tradeLicenseCopyUrl: url }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "VAT Certificate No" }), _jsx("input", { placeholder: "VAT Certificate No", value: f.vatCertificateNo, onChange: (e) => setF({ ...f, vatCertificateNo: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Office Manager Broker ID No" }), _jsx("input", { placeholder: "Broker ID", value: f.officeManagerBrokerId, onChange: (e) => setF({ ...f, officeManagerBrokerId: e.target.value }), className: INPUT_CLS })] })] }), _jsx(FileUploadField, { label: "VAT Certificate / Non-VAT Declaration", value: f.vatCertificateUrl, onChange: (url) => setF({ ...f, vatCertificateUrl: url }) }), _jsx(FileUploadField, { label: "Corporate Tax Certificate", value: f.corporateTaxCertUrl, onChange: (url) => setF({ ...f, corporateTaxCertUrl: url }) }), _jsx(FileUploadField, { label: "ORN Certificate", value: f.ornCertificateUrl, onChange: (url) => setF({ ...f, ornCertificateUrl: url }) }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Company Website" }), _jsx("input", { type: "url", placeholder: "https://...", value: f.website, onChange: (e) => setF({ ...f, website: e.target.value }), className: INPUT_CLS })] })] })] }), _jsxs("div", { className: SECTION_CLS, children: [_jsx("p", { className: SECTION_TITLE_CLS, children: "Location" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Office No" }), _jsx("input", { placeholder: "Office No", value: f.officeNo, onChange: (e) => setF({ ...f, officeNo: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Building Name" }), _jsx("input", { placeholder: "Building Name", value: f.buildingName, onChange: (e) => setF({ ...f, buildingName: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Neighborhood" }), _jsx("input", { placeholder: "Neighborhood", value: f.neighborhood, onChange: (e) => setF({ ...f, neighborhood: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Emirate" }), _jsxs("select", { value: f.emirate, onChange: (e) => setF({ ...f, emirate: e.target.value }), className: INPUT_CLS, children: [_jsx("option", { value: "", children: "Select Emirate" }), EMIRATES.map((em) => _jsx("option", { value: em, children: em }, em))] })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Postal Code" }), _jsx("input", { placeholder: "Postal Code", value: f.postalCode, onChange: (e) => setF({ ...f, postalCode: e.target.value }), className: INPUT_CLS })] })] })] })] }), _jsxs("div", { className: SECTION_CLS, children: [_jsx("p", { className: SECTION_TITLE_CLS, children: "Bank Details" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Bank Name" }), _jsx("input", { placeholder: "Bank Name", value: f.bankName, onChange: (e) => setF({ ...f, bankName: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Account Name" }), _jsx("input", { placeholder: "Account Name", value: f.bankAccountName, onChange: (e) => setF({ ...f, bankAccountName: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Account No" }), _jsx("input", { placeholder: "Account No", value: f.bankAccountNo, onChange: (e) => setF({ ...f, bankAccountNo: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Currency" }), _jsx("input", { placeholder: "AED", value: f.bankCurrency, onChange: (e) => setF({ ...f, bankCurrency: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "IBAN" }), _jsx("input", { placeholder: "AE...", value: f.bankIban, onChange: (e) => setF({ ...f, bankIban: e.target.value }), className: INPUT_CLS })] })] })] })] }));
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Brokers" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [companies.length, " registered companies"] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "text", placeholder: "Search company\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:border-blue-400 bg-slate-50" }), _jsxs("button", { onClick: () => setShowForm(true), className: "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5", children: [_jsx("span", { className: "text-base leading-none", children: "+" }), " Add Company"] })] })] }), loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsx("div", { className: "lg:col-span-1 space-y-2", children: filtered.length === 0 ? (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm", children: "No companies found" })) : filtered.map((company) => (_jsxs("button", { onClick: () => setSelected(company), className: `w-full text-left bg-white rounded-xl border p-4 transition-all hover:border-blue-300 hover:shadow-sm ${selected?.id === company.id ? "border-blue-500 shadow-sm" : "border-slate-200"}`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("div", { className: "w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-sm", children: company.name.charAt(0).toUpperCase() }), _jsxs("span", { className: "text-xs text-slate-400", children: [company.deals.length, " deals"] })] }), _jsx("p", { className: "font-semibold text-slate-800 text-sm mb-1", children: company.name }), company.email && _jsx("p", { className: "text-xs text-slate-400 truncate", children: company.email }), _jsxs("div", { className: "flex items-center justify-between mt-2 pt-2 border-t border-slate-100", children: [_jsxs("span", { className: "text-xs text-slate-500", children: [company.agents.length, " agents"] }), _jsxs("span", { className: "text-xs font-semibold text-emerald-600", children: ["AED ", getPaidCommission(company).toLocaleString(), " paid"] })] })] }, company.id))) }), _jsx("div", { className: "lg:col-span-2", children: !selected ? (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400", children: [_jsx("p", { className: "text-3xl mb-2 opacity-30", children: "\u25C9" }), _jsx("p", { className: "text-sm", children: "Select a company to view details" })] })) : (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "px-6 py-5 border-b border-slate-100 bg-slate-50", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: selected.name }), _jsxs("div", { className: "flex flex-wrap gap-3 mt-0.5", children: [selected.email && _jsx("span", { className: "text-xs text-slate-500", children: selected.email }), selected.phone && _jsx("span", { className: "text-xs text-slate-500", children: selected.phone }), selected.commissionRate != null && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Commission: ", _jsxs("strong", { children: [selected.commissionRate, "%"] })] })), selected.website && (_jsx("a", { href: selected.website, target: "_blank", rel: "noreferrer", className: "text-xs text-blue-500 hover:underline", children: selected.website }))] }), (selected.reraLicenseNumber || selected.tradeLicenseNumber || selected.officeRegistrationNo || selected.vatCertificateNo) && (_jsxs("div", { className: "flex flex-wrap gap-3 mt-1", children: [selected.reraLicenseNumber && (_jsxs("span", { className: "text-xs text-slate-500 flex items-center gap-1", children: ["License: ", selected.reraLicenseNumber, (() => { const w = reraWarning(selected.reraLicenseExpiry); return w ? _jsx("span", { className: `px-1.5 py-0.5 rounded text-xs font-medium ${w.cls}`, children: w.label }) : null; })()] })), selected.tradeLicenseNumber && _jsxs("span", { className: "text-xs text-slate-500", children: ["Trade: ", selected.tradeLicenseNumber] }), selected.officeRegistrationNo && _jsxs("span", { className: "text-xs text-slate-500", children: ["ORN: ", selected.officeRegistrationNo] }), selected.vatCertificateNo && _jsxs("span", { className: "text-xs text-slate-500", children: ["VAT: ", selected.vatCertificateNo] }), selected.officeManagerBrokerId && _jsxs("span", { className: "text-xs text-slate-500", children: ["Broker ID: ", selected.officeManagerBrokerId] })] })), (selected.emirate || selected.buildingName || selected.officeNo) && (_jsx("p", { className: "text-xs text-slate-400 mt-1", children: [selected.officeNo && `Office ${selected.officeNo}`, selected.buildingName, selected.neighborhood, selected.emirate, selected.postalCode].filter(Boolean).join(", ") })), selected.bankName && (_jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [selected.bankName, selected.bankAccountName && ` — ${selected.bankAccountName}`, selected.bankIban && ` · IBAN: ${selected.bankIban.slice(0, 8)}…`] }))] }), _jsxs("div", { className: "flex items-center gap-2 ml-2 shrink-0", children: [selected.deals.length === 0 && (_jsx("button", { onClick: handleDeleteCompany, className: "text-xs px-2.5 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors", children: "Delete" })), _jsx("button", { onClick: openEditForm, className: "text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors", children: "Edit" }), _jsx("button", { onClick: () => setSelected(null), className: "text-slate-400 hover:text-slate-600 text-xl leading-none ml-1", children: "\u00D7" })] })] }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: [
                                                { label: "Agents", value: selected.agents.length, color: "text-blue-600" },
                                                { label: "Deals", value: selected.deals.length, color: "text-indigo-600" },
                                                { label: "Commission", value: `AED ${(getTotalCommission(selected) / 1000).toFixed(0)}K`, color: "text-emerald-600" },
                                            ].map((s) => (_jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-200 text-center", children: [_jsx("p", { className: "text-xs text-slate-500", children: s.label }), _jsx("p", { className: `font-bold text-base ${s.color}`, children: s.value })] }, s.label))) })] }), _jsxs("div", { className: "px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700", children: "Agents" }), _jsxs("button", { onClick: () => { setShowAgentForm(true); setAgentForm(emptyAgentForm()); }, className: "text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1", children: [_jsx("span", { className: "text-sm leading-none", children: "+" }), " Add Agent"] })] }), selected.agents.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400", children: "No agents registered" })) : (_jsx("div", { className: "space-y-2", children: selected.agents.map((agent) => (_jsxs("div", { className: "flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-xs font-semibold", children: agent.name.charAt(0) }), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium text-slate-800", children: agent.name }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-0.5", children: [agent.reraCardNumber && (_jsxs("span", { className: "text-xs text-slate-400 flex items-center gap-1", children: ["RERA: ", agent.reraCardNumber, (() => { const w = reraWarning(agent.reraCardExpiry); return w ? _jsx("span", { className: `px-1 py-0.5 rounded text-xs font-medium ${w.cls}`, children: w.label }) : null; })()] })), agent.eidNo && _jsxs("span", { className: "text-xs text-slate-400", children: ["EID: ", agent.eidNo] })] })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [agent.phone && _jsx("span", { className: "text-xs text-slate-400", children: agent.phone }), _jsx("button", { onClick: () => handleDeleteAgent(agent.id), disabled: deletingAgent === agent.id, className: "text-slate-300 hover:text-red-500 transition-colors text-sm leading-none disabled:opacity-50", title: "Remove agent", children: "\u00D7" })] })] }, agent.id))) }))] }), _jsxs("div", { className: "px-6 py-4", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-3", children: "Commission Breakdown" }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: [
                                                { label: "Total", amount: getTotalCommission(selected), color: "text-slate-700" },
                                                { label: "Paid", amount: getPaidCommission(selected), color: "text-emerald-600" },
                                                { label: "Pending", amount: selected.commissions.filter((c) => ["PENDING_APPROVAL", "APPROVED"].includes(c.status)).reduce((s, c) => s + c.amount, 0), color: "text-amber-600" },
                                                { label: "Not Due", amount: selected.commissions.filter((c) => c.status === "NOT_DUE").reduce((s, c) => s + c.amount, 0), color: "text-slate-400" },
                                            ].map((item) => (_jsxs("div", { className: "bg-slate-50 rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500", children: item.label }), _jsxs("p", { className: `font-bold ${item.color}`, children: ["AED ", item.amount.toLocaleString()] })] }, item.label))) })] })] })) })] })), showForm && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10", children: [_jsx("h2", { className: "font-bold text-slate-900", children: "New Broker Company" }), _jsx("button", { onClick: () => setShowForm(false), className: "text-slate-400 hover:text-slate-600 text-xl leading-none", children: "\u00D7" })] }), _jsxs("form", { onSubmit: handleCreate, className: "px-6 py-5 space-y-0", children: [_jsx(CompanyFormFields, { f: form, setF: setForm }), _jsxs("div", { className: "flex gap-3 pt-5", children: [_jsx("button", { type: "submit", className: "flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm", children: "Create" }), _jsx("button", { type: "button", onClick: () => setShowForm(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" })] })] })] }) })), showEditForm && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10", children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Edit Company" }), _jsx("button", { onClick: () => setShowEditForm(false), className: "text-slate-400 hover:text-slate-600 text-xl leading-none", children: "\u00D7" })] }), _jsxs("form", { onSubmit: handleEdit, className: "px-6 py-5 space-y-0", children: [_jsx(CompanyFormFields, { f: editForm, setF: setEditForm }), _jsxs("div", { className: "flex gap-3 pt-5", children: [_jsx("button", { type: "submit", className: "flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowEditForm(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" })] })] })] }) })), showAgentForm && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl my-8", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10", children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Add Agent" }), _jsx("button", { onClick: () => setShowAgentForm(false), className: "text-slate-400 hover:text-slate-600 text-xl leading-none", children: "\u00D7" })] }), _jsxs("form", { onSubmit: handleAddAgent, className: "px-6 py-5", children: [_jsx("p", { className: SECTION_TITLE_CLS, children: "Identity" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "First Name" }), _jsx("input", { placeholder: "First Name", value: agentForm.firstName, onChange: (e) => setAgentForm({ ...agentForm, firstName: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Last Name" }), _jsx("input", { placeholder: "Last Name", value: agentForm.lastName, onChange: (e) => setAgentForm({ ...agentForm, lastName: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "EID No" }), _jsx("input", { placeholder: "EID No", value: agentForm.eidNo, onChange: (e) => setAgentForm({ ...agentForm, eidNo: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "EID Expiry" }), _jsx("input", { type: "date", value: agentForm.eidExpiry, onChange: (e) => setAgentForm({ ...agentForm, eidExpiry: e.target.value }), className: INPUT_CLS })] })] }), _jsx(FileUploadField, { label: "EID Front", value: agentForm.eidFrontUrl, onChange: (url) => setAgentForm({ ...agentForm, eidFrontUrl: url }), accept: "image/jpeg,image/png,application/pdf" }), _jsx(FileUploadField, { label: "EID Back", value: agentForm.eidBackUrl, onChange: (url) => setAgentForm({ ...agentForm, eidBackUrl: url }), accept: "image/jpeg,image/png,application/pdf" })] }), _jsxs("div", { className: SECTION_CLS, children: [_jsx("p", { className: SECTION_TITLE_CLS, children: "Contact" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Phone" }), _jsx("input", { placeholder: "Phone", value: agentForm.phone, onChange: (e) => setAgentForm({ ...agentForm, phone: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "Email" }), _jsx("input", { type: "email", placeholder: "Email", value: agentForm.email, onChange: (e) => setAgentForm({ ...agentForm, email: e.target.value }), className: INPUT_CLS })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "RERA Card #" }), _jsx("input", { placeholder: "RERA Card #", value: agentForm.reraCardNumber, onChange: (e) => setAgentForm({ ...agentForm, reraCardNumber: e.target.value }), className: INPUT_CLS })] }), _jsxs("div", { children: [_jsx("label", { className: LABEL_CLS, children: "RERA Card Expiry" }), _jsx("input", { type: "date", value: agentForm.reraCardExpiry, onChange: (e) => setAgentForm({ ...agentForm, reraCardExpiry: e.target.value }), className: INPUT_CLS })] })] })] })] }), _jsx("div", { className: SECTION_CLS, children: _jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: agentForm.acceptedConsent, onChange: (e) => setAgentForm({ ...agentForm, acceptedConsent: e.target.checked }), className: "mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600" }), _jsx("span", { className: "text-sm text-slate-600", children: "I consent to Samha Development contacting me regarding my inquiry." })] }) }), _jsxs("div", { className: "flex gap-3 pt-5", children: [_jsx("button", { type: "submit", className: "flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm", children: "Add Agent" }), _jsx("button", { type: "button", onClick: () => setShowAgentForm(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" })] })] })] }) })), _jsx(ConfirmDialog, { open: confirmDeleteCompany, title: "Delete Broker Company", message: "Delete this company? This cannot be undone.", confirmLabel: "Delete", variant: "danger", onConfirm: doDeleteCompany, onCancel: () => setConfirmDeleteCompany(false) }), _jsx(ConfirmDialog, { open: !!confirmDeleteAgentId, title: "Remove Agent", message: "Remove this agent from the company?", confirmLabel: "Remove", variant: "danger", onConfirm: doDeleteAgent, onCancel: () => setConfirmDeleteAgentId(null) })] }));
}
