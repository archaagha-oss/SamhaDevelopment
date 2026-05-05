import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white disabled:opacity-50";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const LOCKED_STAGES = ["SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED", "CANCELLED"];
export default function DealEditModal({ deal, onClose, onSaved }) {
    const isLocked = LOCKED_STAGES.includes(deal.stage);
    const [form, setForm] = useState({
        salePrice: String(deal.salePrice),
        discount: String(deal.discount || 0),
        brokerCompanyId: deal.brokerCompany?.id ?? "",
        brokerAgentId: deal.brokerAgent?.id ?? "",
        commissionRateOverride: deal.commissionRateOverride ? String(deal.commissionRateOverride) : "",
        adminFeeWaived: deal.adminFeeWaived ?? false,
        adminFeeWaivedReason: deal.adminFeeWaivedReason ?? "",
        dldPaidBy: (deal.dldPaidBy ?? "BUYER"),
        dldWaivedReason: deal.dldWaivedReason ?? "",
        assignedAgentId: deal.assignedAgent?.id ?? "",
    });
    const [brokerCompanies, setBrokerCompanies] = useState([]);
    const [agents, setAgents] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        axios.get("/api/brokers/companies").then((r) => setBrokerCompanies(r.data || [])).catch(() => { });
        axios.get("/api/users").then((r) => setAgents((r.data || []).filter((u) => u.role === "SALES_AGENT" || u.role === "OPERATIONS"))).catch(() => { });
    }, []);
    const selectedCompany = brokerCompanies.find((c) => c.id === form.brokerCompanyId);
    const brokerAgents = selectedCompany?.agents ?? [];
    const netPrice = (parseFloat(form.salePrice) || 0) - (parseFloat(form.discount) || 0);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await axios.patch(`/api/deals/${deal.id}`, {
                salePrice: parseFloat(form.salePrice),
                discount: parseFloat(form.discount) || 0,
                brokerCompanyId: form.brokerCompanyId || null,
                brokerAgentId: form.brokerAgentId || null,
                commissionRateOverride: form.brokerCompanyId && form.commissionRateOverride ? parseFloat(form.commissionRateOverride) : null,
                adminFeeWaived: form.adminFeeWaived,
                adminFeeWaivedReason: form.adminFeeWaived ? form.adminFeeWaivedReason || null : null,
                dldPaidBy: form.dldPaidBy,
                dldWaivedReason: form.dldPaidBy === "DEVELOPER" ? form.dldWaivedReason || null : null,
                assignedAgentId: form.assignedAgentId || null,
            });
            onSaved();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to update deal");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsx("h2", { className: "font-bold text-slate-900 text-lg", children: "Edit Deal" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { id: "deal-edit-form", onSubmit: handleSubmit, className: "overflow-y-auto flex-1 px-6 py-4 space-y-4", children: [isLocked && (_jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700", children: "Deal is past SPA Signing stage. Sale price and discount are locked. You can still update broker, agent, and fee settings." })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Sale Price (AED)" }), _jsx("input", { required: true, type: "number", min: "1", step: "1", disabled: isLocked, value: form.salePrice, onChange: (e) => setForm((f) => ({ ...f, salePrice: e.target.value })), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Discount (AED)" }), _jsx("input", { type: "number", min: "0", step: "1", disabled: isLocked, value: form.discount, onChange: (e) => setForm((f) => ({ ...f, discount: e.target.value })), className: inp })] })] }), !isLocked && form.salePrice && (_jsxs("div", { className: "bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm flex justify-between", children: [_jsx("span", { className: "text-slate-600", children: "Net Price" }), _jsxs("span", { className: "font-bold text-slate-800", children: ["AED ", netPrice.toLocaleString()] })] })), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Assigned Sales Agent" }), _jsxs("select", { value: form.assignedAgentId, onChange: (e) => setForm((f) => ({ ...f, assignedAgentId: e.target.value })), className: inp, children: [_jsx("option", { value: "", children: "Unassigned" }), agents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Broker Company" }), _jsxs("select", { value: form.brokerCompanyId, onChange: (e) => setForm((f) => ({ ...f, brokerCompanyId: e.target.value, brokerAgentId: "" })), className: inp, children: [_jsx("option", { value: "", children: "None (direct)" }), brokerCompanies.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Broker Agent" }), _jsxs("select", { value: form.brokerAgentId, onChange: (e) => setForm((f) => ({ ...f, brokerAgentId: e.target.value })), disabled: !form.brokerCompanyId, className: inp, children: [_jsx("option", { value: "", children: "Select agent\u2026" }), brokerAgents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] })] }), form.brokerCompanyId && (_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Commission Rate Override (%)" }), _jsx("input", { type: "number", step: "0.1", min: "0", max: "20", value: form.commissionRateOverride, onChange: (e) => setForm((f) => ({ ...f, commissionRateOverride: e.target.value })), placeholder: "Leave blank for company default", className: inp })] })), _jsxs("div", { className: "space-y-3 border border-slate-200 rounded-lg p-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Fee Overrides" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "checkbox", id: "adminFeeWaived", checked: form.adminFeeWaived, onChange: (e) => setForm((f) => ({ ...f, adminFeeWaived: e.target.checked })), className: "w-4 h-4 rounded border-slate-300" }), _jsx("label", { htmlFor: "adminFeeWaived", className: "text-sm text-slate-700 font-medium", children: "Waive Admin Fee" })] }), form.adminFeeWaived && (_jsx("input", { placeholder: "Reason for admin fee waiver", value: form.adminFeeWaivedReason, onChange: (e) => setForm((f) => ({ ...f, adminFeeWaivedReason: e.target.value })), className: inp })), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "DLD Fee Paid By" }), _jsxs("select", { value: form.dldPaidBy, onChange: (e) => setForm((f) => ({ ...f, dldPaidBy: e.target.value })), className: inp, children: [_jsx("option", { value: "BUYER", children: "Buyer" }), _jsx("option", { value: "DEVELOPER", children: "Developer (Waived for Buyer)" })] })] }), form.dldPaidBy === "DEVELOPER" && (_jsx("input", { placeholder: "Reason for DLD waiver", value: form.dldWaivedReason, onChange: (e) => setForm((f) => ({ ...f, dldWaivedReason: e.target.value })), className: inp }))] }), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg", children: error }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors", children: "Cancel" }), _jsx("button", { form: "deal-edit-form", type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50", children: submitting ? "Saving…" : "Save Changes" })] })] }) }));
}
