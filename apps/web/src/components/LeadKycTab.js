import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { kycApi } from "../services/phase2ApiService";
const STATUS_COLORS = {
    PENDING: "bg-amber-100 text-amber-800",
    IN_REVIEW: "bg-blue-100 text-blue-800",
    APPROVED: "bg-green-100 text-green-800",
    EXPIRED: "bg-red-100 text-red-800",
    REJECTED: "bg-red-100 text-red-800",
};
const RISK_COLORS = {
    LOW: "bg-green-100 text-green-800",
    MEDIUM: "bg-amber-100 text-amber-800",
    HIGH: "bg-red-100 text-red-800",
};
export default function LeadKycTab({ leadId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        idType: "PASSPORT",
        nationality: "",
        occupation: "",
        pepFlag: false,
        sourceOfFunds: "",
    });
    const load = async () => {
        setLoading(true);
        try {
            setRecords(await kycApi.listForLead(leadId));
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, [leadId]);
    const submit = async (e) => {
        e.preventDefault();
        try {
            await kycApi.create(leadId, form);
            toast.success("KYC record created");
            setShowForm(false);
            setForm({});
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    const approve = async (rec) => {
        try {
            await kycApi.update(rec.id, { status: "APPROVED" });
            toast.success("KYC approved");
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("h3", { className: "font-medium", children: "KYC Records" }), _jsx("button", { className: "text-sm text-blue-600 hover:underline", onClick: () => setShowForm((s) => !s), children: showForm ? "Cancel" : "+ New KYC" })] }), showForm && (_jsxs("form", { className: "grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded", onSubmit: submit, children: [_jsxs("select", { className: "border rounded px-2 py-1 text-sm", value: form.idType ?? "PASSPORT", onChange: (e) => setForm({ ...form, idType: e.target.value }), children: [_jsx("option", { children: "PASSPORT" }), _jsx("option", { children: "EMIRATES_ID" }), _jsx("option", { children: "OTHER" })] }), _jsx("input", { className: "border rounded px-2 py-1 text-sm", placeholder: "ID number", value: form.idNumber ?? "", onChange: (e) => setForm({ ...form, idNumber: e.target.value }) }), _jsx("input", { className: "border rounded px-2 py-1 text-sm", type: "date", placeholder: "ID expiry", value: form.idExpiryDate ?? "", onChange: (e) => setForm({ ...form, idExpiryDate: e.target.value }) }), _jsx("input", { className: "border rounded px-2 py-1 text-sm", placeholder: "Nationality", value: form.nationality ?? "", onChange: (e) => setForm({ ...form, nationality: e.target.value }) }), _jsx("input", { className: "border rounded px-2 py-1 text-sm", placeholder: "Occupation", value: form.occupation ?? "", onChange: (e) => setForm({ ...form, occupation: e.target.value }) }), _jsxs("select", { className: "border rounded px-2 py-1 text-sm", value: form.residencyStatus ?? "", onChange: (e) => setForm({ ...form, residencyStatus: e.target.value }), children: [_jsx("option", { value: "", children: "Residency status" }), _jsx("option", { value: "CITIZEN", children: "CITIZEN" }), _jsx("option", { value: "RESIDENT", children: "RESIDENT" }), _jsx("option", { value: "NON_RESIDENT", children: "NON_RESIDENT" })] }), _jsx("textarea", { className: "border rounded px-2 py-1 text-sm col-span-2", placeholder: "Source of funds", value: form.sourceOfFunds ?? "", onChange: (e) => setForm({ ...form, sourceOfFunds: e.target.value }) }), _jsxs("label", { className: "flex items-center gap-1 text-sm col-span-2", children: [_jsx("input", { type: "checkbox", checked: !!form.pepFlag, onChange: (e) => setForm({ ...form, pepFlag: e.target.checked }) }), "Politically exposed person (PEP)"] }), _jsx("div", { className: "col-span-2 text-right", children: _jsx("button", { className: "bg-blue-600 text-white text-sm px-3 py-1 rounded", type: "submit", children: "Save" }) })] })), loading ? (_jsx("p", { className: "text-gray-500 text-sm", children: "Loading\u2026" })) : records.length === 0 ? (_jsx("p", { className: "text-gray-500 text-sm", children: "No KYC records." })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-1", children: "Status" }), _jsx("th", { children: "Risk" }), _jsx("th", { children: "ID" }), _jsx("th", { children: "Nationality" }), _jsx("th", { children: "Occupation" }), _jsx("th", { children: "PEP" }), _jsx("th", { children: "Expires" }), _jsx("th", {})] }) }), _jsx("tbody", { children: records.map((r) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-1", children: _jsx("span", { className: `px-2 py-0.5 rounded text-xs ${STATUS_COLORS[r.status]}`, children: r.status }) }), _jsx("td", { children: _jsx("span", { className: `px-2 py-0.5 rounded text-xs ${RISK_COLORS[r.riskRating]}`, children: r.riskRating }) }), _jsxs("td", { children: [r.idType ?? "—", " ", r.idNumber ? `· ${r.idNumber}` : ""] }), _jsx("td", { children: r.nationality ?? "—" }), _jsx("td", { children: r.occupation ?? "—" }), _jsx("td", { children: r.pepFlag ? "Yes" : "No" }), _jsx("td", { children: r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—" }), _jsx("td", { children: r.status !== "APPROVED" && (_jsx("button", { className: "text-blue-600 hover:underline text-xs", onClick: () => approve(r), children: "Approve" })) })] }, r.id))) })] }))] }));
}
