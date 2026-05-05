import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
const inp = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const lbl = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";
const STEPS = ["Lead", "Unit & Price", "Payment Plan", "Broker & Incentives"];
function fmtArea(a) { return `${a.toLocaleString()} sqft`; }
export default function DealFormModal({ onClose, onCreated, defaultLeadId }) {
    const [step, setStep] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    // Form state
    const [leadId, setLeadId] = useState(defaultLeadId ?? "");
    const [leadSearch, setLeadSearch] = useState("");
    const [projectId, setProjectId] = useState("");
    const [unitId, setUnitId] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [discount, setDiscount] = useState("");
    const [paymentPlanId, setPaymentPlanId] = useState("");
    const [brokerCompanyId, setBrokerCompanyId] = useState("");
    const [brokerAgentId, setBrokerAgentId] = useState("");
    const [commissionRateOverride, setCommissionRateOverride] = useState("");
    const [adminFeeWaived, setAdminFeeWaived] = useState(false);
    const [adminFeeWaivedReason, setAdminFeeWaivedReason] = useState("");
    const [dldPaidBy, setDldPaidBy] = useState("BUYER");
    const [dldWaivedReason, setDldWaivedReason] = useState("");
    // Data
    const [leads, setLeads] = useState([]);
    const [projects, setProjects] = useState([]);
    const [units, setUnits] = useState([]);
    const [paymentPlans, setPaymentPlans] = useState([]);
    const [brokerCompanies, setBrokerCompanies] = useState([]);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const firstFieldRef = useRef(null);
    useEffect(() => {
        axios.get("/api/leads", { params: { page: 1, limit: 500 } }).then((r) => setLeads(r.data.data || [])).catch(() => { });
        axios.get("/api/projects").then((r) => setProjects(r.data.data || r.data || [])).catch(() => { });
        axios.get("/api/payment-plans").then((r) => setPaymentPlans(r.data || [])).catch(() => { });
        axios.get("/api/brokers/companies").then((r) => setBrokerCompanies(r.data || [])).catch(() => { });
    }, []);
    useEffect(() => {
        if (!projectId) {
            setUnits([]);
            setUnitId("");
            return;
        }
        setLoadingUnits(true);
        axios.get("/api/units", { params: { projectId, status: "AVAILABLE", limit: 500 } })
            .then((r) => setUnits(r.data.data || []))
            .catch(() => setUnits([]))
            .finally(() => setLoadingUnits(false));
    }, [projectId]);
    // Auto-fill price from selected unit
    const selectedUnit = units.find((u) => u.id === unitId);
    useEffect(() => {
        if (selectedUnit && !salePrice)
            setSalePrice(String(selectedUnit.price));
    }, [selectedUnit]);
    const selectedPlan = paymentPlans.find((p) => p.id === paymentPlanId);
    const selectedCompany = brokerCompanies.find((c) => c.id === brokerCompanyId);
    const brokerAgents = selectedCompany?.agents ?? [];
    const netPrice = (parseFloat(salePrice) || 0) - (parseFloat(discount) || 0);
    const filteredLeads = leads.filter((l) => {
        if (!leadSearch)
            return true;
        const q = leadSearch.toLowerCase();
        return `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) || l.phone.includes(q);
    });
    const canAdvance = [
        leadId.length > 0,
        unitId.length > 0 && parseFloat(salePrice) > 0,
        paymentPlanId.length > 0,
        true, // broker step is optional
    ];
    const handleClose = () => {
        if (dirty && !window.confirm("Discard unsaved deal?"))
            return;
        onClose();
    };
    const handleSubmit = async () => {
        setError(null);
        setSubmitting(true);
        try {
            await axios.post("/api/deals", {
                leadId,
                unitId,
                salePrice: parseFloat(salePrice),
                discount: parseFloat(discount) || 0,
                paymentPlanId,
                brokerCompanyId: brokerCompanyId || undefined,
                brokerAgentId: brokerAgentId || undefined,
                commissionRateOverride: brokerCompanyId && commissionRateOverride ? parseFloat(commissionRateOverride) : undefined,
                adminFeeWaived: adminFeeWaived || undefined,
                adminFeeWaivedReason: adminFeeWaived ? adminFeeWaivedReason || undefined : undefined,
                dldPaidBy: dldPaidBy !== "BUYER" ? dldPaidBy : undefined,
                dldWaivedReason: dldPaidBy === "DEVELOPER" ? dldWaivedReason || undefined : undefined,
            });
            onCreated();
            onClose();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to create deal");
        }
        finally {
            setSubmitting(false);
        }
    };
    const selectedLead = leads.find((l) => l.id === leadId);
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]", children: [_jsxs("div", { className: "px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "font-bold text-slate-900 text-lg", children: "New Deal" }), _jsx("button", { onClick: handleClose, className: "text-slate-400 hover:text-slate-700 text-2xl leading-none transition-colors", children: "\u00D7" })] }), _jsx("div", { className: "flex items-center gap-0", children: STEPS.map((label, i) => {
                                const done = i < step;
                                const current = i === step;
                                return (_jsxs("div", { className: "flex items-center flex-1 last:flex-none", children: [_jsxs("button", { onClick: () => done && setStep(i), disabled: !done, className: "flex flex-col items-center gap-1 group disabled:cursor-default", children: [_jsx("div", { className: `w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${done ? "bg-blue-600 border-blue-600 text-white" :
                                                        current ? "bg-white border-blue-600 text-blue-600" :
                                                            "bg-slate-100 border-slate-200 text-slate-400"}`, children: done ? "✓" : i + 1 }), _jsx("span", { className: `text-[10px] font-semibold whitespace-nowrap ${current ? "text-blue-700" : done ? "text-blue-500" : "text-slate-400"}`, children: label })] }), i < STEPS.length - 1 && (_jsx("div", { className: `flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < step ? "bg-blue-500" : "bg-slate-200"}` }))] }, i));
                            }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-5", children: [step === 0 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-700 mb-1", children: "Who is this deal for?" }), _jsx("p", { className: "text-xs text-slate-400 mb-4", children: "Select the lead that will become the buyer." })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Search leads" }), _jsx("input", { ref: (el) => { firstFieldRef.current = el; }, autoFocus: true, type: "text", placeholder: "Name or phone number\u2026", value: leadSearch, onChange: (e) => { setLeadSearch(e.target.value); setDirty(true); }, className: inp })] }), _jsx("div", { className: "border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto", children: filteredLeads.length === 0 ? (_jsx("p", { className: "px-4 py-8 text-center text-sm text-slate-400", children: "No leads found" })) : filteredLeads.map((l) => (_jsxs("button", { type: "button", onClick: () => { setLeadId(l.id); setDirty(true); }, className: `w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-50 last:border-0 ${leadId === l.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-slate-50"}`, children: [_jsxs("div", { className: `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${leadId === l.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`, children: [l.firstName[0], l.lastName[0]] }), _jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800", children: [l.firstName, " ", l.lastName] }), _jsx("p", { className: "text-xs text-slate-400", children: l.phone })] }), leadId === l.id && _jsx("span", { className: "ml-auto text-blue-600 text-sm", children: "\u2713" })] }, l.id))) }), leadId && !leadSearch && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3", children: [_jsxs("div", { className: "w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0", children: [selectedLead?.firstName[0], selectedLead?.lastName[0]] }), _jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-blue-900", children: [selectedLead?.firstName, " ", selectedLead?.lastName] }), _jsx("p", { className: "text-xs text-blue-600", children: selectedLead?.phone })] }), _jsx("button", { onClick: () => { setLeadId(""); setLeadSearch(""); }, className: "ml-auto text-blue-400 hover:text-blue-600 text-lg leading-none", children: "\u00D7" })] }))] })), step === 1 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-700 mb-1", children: "Which unit?" }), _jsx("p", { className: "text-xs text-slate-400 mb-4", children: "Select a project, then pick an available unit." })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Project" }), _jsxs("select", { autoFocus: true, value: projectId, onChange: (e) => { setProjectId(e.target.value); setUnitId(""); setSalePrice(""); setDirty(true); }, className: inp, children: [_jsx("option", { value: "", children: "Select project\u2026" }), projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), projectId && (_jsxs("div", { children: [_jsxs("label", { className: lbl, children: ["Available Unit ", loadingUnits ? "— loading…" : `(${units.length} available)`] }), loadingUnits ? (_jsx("div", { className: "flex items-center justify-center h-20", children: _jsx("div", { className: "w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : units.length === 0 ? (_jsx("div", { className: "border border-slate-200 rounded-xl px-4 py-6 text-center", children: _jsx("p", { className: "text-sm text-slate-400", children: "No available units in this project" }) })) : (_jsx("div", { className: "border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto", children: units.map((u) => (_jsxs("button", { type: "button", onClick: () => { setUnitId(u.id); setSalePrice(String(u.price)); setDirty(true); }, className: `w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-50 last:border-0 ${unitId === u.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-slate-50"}`, children: [_jsx("div", { className: `w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${unitId === u.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`, children: u.unitNumber }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800", children: [u.type.replace(/_/g, " "), " \u00B7 Floor ", u.floor] }), _jsxs("p", { className: "text-xs text-slate-400", children: [fmtArea(u.area), " \u00B7 ", u.view] })] }), _jsx("div", { className: "text-right flex-shrink-0", children: _jsxs("p", { className: "text-sm font-bold text-slate-800", children: ["AED ", u.price.toLocaleString()] }) }), unitId === u.id && _jsx("span", { className: "text-blue-600 text-sm ml-1", children: "\u2713" })] }, u.id))) }))] })), unitId && (_jsxs("div", { className: "grid grid-cols-2 gap-3 pt-2", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Sale Price (AED)" }), _jsx("input", { required: true, type: "number", min: "1", step: "1", value: salePrice, onChange: (e) => { setSalePrice(e.target.value); setDirty(true); }, className: inp }), selectedUnit && parseFloat(salePrice) !== selectedUnit.price && (_jsxs("p", { className: "text-xs text-slate-400 mt-1", children: ["Listed: AED ", selectedUnit.price.toLocaleString()] }))] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Discount (AED)" }), _jsx("input", { type: "number", min: "0", step: "1", placeholder: "0", value: discount, onChange: (e) => { setDiscount(e.target.value); setDirty(true); }, className: inp })] })] })), unitId && parseFloat(salePrice) > 0 && (_jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 grid grid-cols-3 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 mb-0.5", children: "Sale Price" }), _jsxs("p", { className: "font-bold text-slate-800", children: ["AED ", (parseFloat(salePrice) || 0).toLocaleString()] })] }), parseFloat(discount) > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 mb-0.5", children: "Discount" }), _jsxs("p", { className: "font-bold text-emerald-600", children: ["\u2212 AED ", (parseFloat(discount) || 0).toLocaleString()] })] })), _jsxs("div", { className: parseFloat(discount) > 0 ? "" : "col-span-2", children: [_jsx("p", { className: "text-xs text-slate-400 mb-0.5", children: "Net Price" }), _jsxs("p", { className: "font-bold text-blue-700 text-base", children: ["AED ", netPrice.toLocaleString()] })] })] }))] })), step === 2 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-700 mb-1", children: "Choose a payment plan" }), _jsx("p", { className: "text-xs text-slate-400 mb-4", children: "This defines when and how the buyer pays. Milestone amounts are calculated from the net price." })] }), _jsx("div", { className: "space-y-2", children: paymentPlans.filter((p) => p.isActive !== false).map((plan) => {
                                        const isSelected = paymentPlanId === plan.id;
                                        return (_jsxs("div", { className: `border-2 rounded-xl overflow-hidden transition-all ${isSelected ? "border-blue-500 shadow-sm" : "border-slate-200 hover:border-slate-300"}`, children: [_jsxs("button", { type: "button", onClick: () => { setPaymentPlanId(plan.id); setDirty(true); }, className: "w-full flex items-center gap-4 px-4 py-3 text-left", children: [_jsx("div", { className: `w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300"}`, children: isSelected && _jsx("span", { className: "text-white text-[10px] font-bold", children: "\u2713" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-bold text-slate-800", children: plan.name }), plan.description && _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: plan.description })] }), _jsxs("span", { className: "text-xs text-slate-400 flex-shrink-0", children: [plan.milestones?.length ?? 0, " milestones"] })] }), isSelected && plan.milestones && plan.milestones.length > 0 && (_jsxs("div", { className: "border-t border-slate-100 bg-slate-50", children: [_jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left", children: [_jsx("th", { className: "px-4 py-2 font-semibold text-slate-500", children: "Milestone" }), _jsx("th", { className: "px-4 py-2 font-semibold text-slate-500 text-right", children: "%" }), netPrice > 0 && _jsx("th", { className: "px-4 py-2 font-semibold text-slate-500 text-right", children: "Amount" }), _jsx("th", { className: "px-4 py-2 font-semibold text-slate-500", children: "Trigger" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: plan.milestones.map((m, i) => {
                                                                        const amt = netPrice > 0 ? Math.round(netPrice * m.percentage / 100) : null;
                                                                        return (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-2 text-slate-700 font-medium", children: [m.label, m.isDLDFee && _jsx("span", { className: "ml-1 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px]", children: "DLD" }), m.isAdminFee && _jsx("span", { className: "ml-1 px-1 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px]", children: "Admin" })] }), _jsxs("td", { className: "px-4 py-2 text-right font-bold text-slate-700", children: [m.percentage, "%"] }), netPrice > 0 && (_jsx("td", { className: "px-4 py-2 text-right font-bold text-blue-700", children: amt !== null ? `AED ${amt.toLocaleString()}` : "—" })), _jsx("td", { className: "px-4 py-2 text-slate-400", children: m.triggerType?.replace(/_/g, " ") })] }, i));
                                                                    }) })] }), netPrice <= 0 && (_jsx("p", { className: "px-4 py-2 text-xs text-amber-600 bg-amber-50 border-t border-amber-100", children: "Set sale price in step 2 to see AED amounts" }))] }))] }, plan.id));
                                    }) })] })), step === 3 && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-700 mb-1", children: "Broker & deal incentives" }), _jsx("p", { className: "text-xs text-slate-400 mb-4", children: "All fields on this step are optional. Skip if this is a direct sale." })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Broker Company" }), _jsxs("select", { value: brokerCompanyId, onChange: (e) => { setBrokerCompanyId(e.target.value); setBrokerAgentId(""); setDirty(true); }, className: inp, children: [_jsx("option", { value: "", children: "None \u2014 direct sale" }), brokerCompanies.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Broker Agent" }), _jsxs("select", { value: brokerAgentId, onChange: (e) => { setBrokerAgentId(e.target.value); setDirty(true); }, disabled: !brokerCompanyId, className: inp, children: [_jsx("option", { value: "", children: "Select agent\u2026" }), brokerAgents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] })] }), brokerCompanyId && (_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Commission Rate Override (%)" }), _jsx("input", { type: "number", step: "0.1", min: "0", max: "20", placeholder: "Leave blank to use company's default rate", value: commissionRateOverride, onChange: (e) => setCommissionRateOverride(e.target.value), className: inp })] })), _jsxs("div", { className: "border border-slate-200 rounded-xl p-4 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Fee Overrides" }), _jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [_jsx("div", { onClick: () => setAdminFeeWaived((v) => !v), className: `w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${adminFeeWaived ? "bg-blue-600" : "bg-slate-200"}`, children: _jsx("span", { className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${adminFeeWaived ? "left-4" : "left-0.5"}` }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-700", children: "Waive Admin Fee" }), adminFeeWaived && (_jsx("input", { autoFocus: true, placeholder: "Reason for admin fee waiver\u2026", value: adminFeeWaivedReason, onChange: (e) => setAdminFeeWaivedReason(e.target.value), className: "mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" }))] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "DLD Fee Paid By" }), _jsx("div", { className: "flex gap-2", children: ["BUYER", "DEVELOPER"].map((opt) => (_jsx("button", { type: "button", onClick: () => setDldPaidBy(opt), className: `flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${dldPaidBy === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`, children: opt === "BUYER" ? "Buyer pays" : "Developer pays (waived for buyer)" }, opt))) }), dldPaidBy === "DEVELOPER" && (_jsx("input", { className: `${inp} mt-2`, placeholder: "Reason for DLD waiver\u2026", value: dldWaivedReason, onChange: (e) => setDldWaivedReason(e.target.value) }))] })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 space-y-2 text-sm", children: [_jsx("p", { className: "text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3", children: "Deal Summary" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-6 gap-y-1.5", children: [_jsx("div", { children: _jsx("span", { className: "text-slate-500", children: "Buyer" }) }), _jsx("div", { className: "font-semibold text-slate-800", children: selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : "—" }), _jsx("div", { children: _jsx("span", { className: "text-slate-500", children: "Unit" }) }), _jsx("div", { className: "font-semibold text-slate-800", children: selectedUnit ? `${selectedUnit.unitNumber} · Fl.${selectedUnit.floor}` : "—" }), _jsx("div", { children: _jsx("span", { className: "text-slate-500", children: "Net Price" }) }), _jsxs("div", { className: "font-bold text-blue-700", children: ["AED ", netPrice.toLocaleString()] }), _jsx("div", { children: _jsx("span", { className: "text-slate-500", children: "Payment Plan" }) }), _jsx("div", { className: "font-semibold text-slate-800", children: selectedPlan?.name || "—" }), brokerCompanyId && (_jsxs(_Fragment, { children: [_jsx("div", { children: _jsx("span", { className: "text-slate-500", children: "Broker" }) }), _jsx("div", { className: "font-semibold text-slate-800", children: selectedCompany?.name })] }))] })] }), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl", children: error }))] }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0", children: [_jsx("button", { type: "button", onClick: handleClose, className: "px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 text-sm transition-colors", children: "Cancel" }), _jsxs("div", { className: "flex-1 flex justify-end gap-2", children: [step > 0 && (_jsx("button", { type: "button", onClick: () => setStep((s) => s - 1), className: "px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 text-sm transition-colors", children: "\u2190 Back" })), step < STEPS.length - 1 ? (_jsx("button", { type: "button", onClick: () => setStep((s) => s + 1), disabled: !canAdvance[step], className: "px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed", children: "Next \u2192" })) : (_jsx("button", { type: "button", onClick: handleSubmit, disabled: submitting || !canAdvance.slice(0, 3).every(Boolean), className: "px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 text-sm transition-colors disabled:opacity-50", children: submitting ? "Creating…" : "Create Deal ✓" }))] })] })] }) }));
}
