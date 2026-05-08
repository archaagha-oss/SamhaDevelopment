import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
const DEFAULT_VALIDITY_DAYS = 7;
export default function CreateOfferModal({ isOpen, onClose, leadId: initialLeadId, unitId: initialUnitId, unitNumber: initialUnitNumber, unitPrice: initialUnitPrice, unitArea: initialUnitArea, onOfferCreated, }) {
    const [leadId, setLeadId] = useState(initialLeadId || "");
    const [unitId, setUnitId] = useState(initialUnitId || "");
    const [unitNumber, setUnitNumber] = useState(initialUnitNumber || "");
    const [unitPrice, setUnitPrice] = useState(initialUnitPrice || 0);
    const [unitArea, setUnitArea] = useState(initialUnitArea || 0);
    const [offeredPrice, setOfferedPrice] = useState(initialUnitPrice || 0);
    const [validityDays, setValidityDays] = useState(DEFAULT_VALIDITY_DAYS);
    const [loading, setLoading] = useState(false);
    const [leads, setLeads] = useState([]);
    const [units, setUnits] = useState([]);
    const [leadsLoading, setLeadsLoading] = useState(false);
    const [unitsLoading, setUnitsLoading] = useState(false);
    useEffect(() => {
        if (isOpen) {
            loadLeads();
            if (initialLeadId) {
                setLeadId(initialLeadId);
            }
            if (initialUnitId) {
                setUnitId(initialUnitId);
                setUnitNumber(initialUnitNumber || "");
                setUnitPrice(initialUnitPrice || 0);
                setOfferedPrice(initialUnitPrice || 0);
                setUnitArea(initialUnitArea || 0);
            }
        }
    }, [isOpen, initialLeadId, initialUnitId]);
    const loadLeads = async () => {
        try {
            setLeadsLoading(true);
            const response = await axios.get("/api/leads");
            setLeads(response.data.data || []);
        }
        catch (err) {
            console.error("Failed to load leads:", err);
            toast.error("Failed to load leads");
        }
        finally {
            setLeadsLoading(false);
        }
    };
    const loadUnits = async (q = "") => {
        try {
            setUnitsLoading(true);
            const params = { limit: 50 };
            if (q)
                params.search = q;
            const response = await axios.get("/api/units", { params });
            setUnits(response.data.data || []);
        }
        catch (err) {
            console.error("Failed to load units:", err);
            toast.error("Failed to load units");
        }
        finally {
            setUnitsLoading(false);
        }
    };
    useEffect(() => {
        if (isOpen && !initialUnitId) {
            loadUnits();
        }
    }, [isOpen, initialUnitId]);
    const discount = unitPrice - offeredPrice;
    const pricePerSqft = unitArea ? Math.round(offeredPrice / unitArea) : 0;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validityDays);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!leadId || !unitId || !offeredPrice) {
            toast.error("Please fill in all required fields");
            return;
        }
        setLoading(true);
        try {
            // Create offer
            const offerResponse = await axios.post("/api/offers", {
                leadId,
                unitId,
                offeredPrice,
                discountAmount: discount > 0 ? discount : 0,
                validityDays,
            });
            const offerId = offerResponse.data.data?.id;
            toast.success("Offer created successfully");
            // Auto-accept offer to create deal
            if (offerId) {
                try {
                    const dealResponse = await axios.patch(`/api/offers/${offerId}/status`, {
                        status: "ACCEPTED",
                    });
                    const dealId = dealResponse.data.data?.deal?.id;
                    if (dealId) {
                        toast.success("Offer accepted! Deal created.");
                        onOfferCreated?.(offerId, dealId);
                    }
                    else {
                        onOfferCreated?.(offerId);
                    }
                }
                catch (dealErr) {
                    const msg = dealErr.response?.data?.error || "Offer created but could not auto-accept";
                    toast.info(msg);
                    onOfferCreated?.(offerId);
                }
            }
            onClose();
        }
        catch (err) {
            const msg = err.response?.data?.error || "Failed to create offer";
            toast.error(msg);
        }
        finally {
            setLoading(false);
        }
    };
    if (!isOpen)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity", onClick: onClose }), _jsxs("div", { className: "fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 overflow-y-auto", children: [_jsxs("div", { className: "sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Create Offer" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6 space-y-5", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "lead", className: "block text-sm font-medium text-slate-700 mb-2", children: "Lead *" }), _jsxs("select", { id: "lead", value: leadId, onChange: (e) => setLeadId(e.target.value), disabled: !!initialLeadId || leadsLoading, className: "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-slate-50", children: [_jsx("option", { value: "", children: "Select a lead..." }), leads.map((lead) => (_jsxs("option", { value: lead.id, children: [lead.firstName, " ", lead.lastName] }, lead.id)))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "unit", className: "block text-sm font-medium text-slate-700 mb-2", children: "Unit *" }), _jsxs("select", { id: "unit", value: unitId, onChange: (e) => {
                                            const selected = units.find((u) => u.id === e.target.value);
                                            if (selected) {
                                                setUnitId(selected.id);
                                                setUnitNumber(selected.unitNumber);
                                                setUnitPrice(selected.price);
                                                setOfferedPrice(selected.price);
                                                setUnitArea(selected.area);
                                            }
                                            else {
                                                setUnitId("");
                                                setUnitNumber("");
                                                setUnitPrice(0);
                                                setOfferedPrice(0);
                                                setUnitArea(0);
                                            }
                                        }, disabled: !!initialUnitId || unitsLoading, className: "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-slate-50", children: [_jsx("option", { value: "", children: "Select a unit..." }), units.map((unit) => (_jsxs("option", { value: unit.id, children: [unit.unitNumber, " (", unit.type, ") - AED ", unit.price.toLocaleString()] }, unit.id)))] })] }), unitNumber && (_jsxs("div", { className: "bg-slate-50 rounded-lg p-4 space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-slate-600", children: "Unit:" }), _jsx("span", { className: "font-medium text-slate-900", children: unitNumber })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-slate-600", children: "List Price:" }), _jsxs("span", { className: "font-medium text-slate-900", children: ["AED ", unitPrice.toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-slate-600", children: "Area:" }), _jsxs("span", { className: "font-medium text-slate-900", children: [unitArea.toFixed(2), " sqft"] })] }), unitArea > 0 && (_jsxs("div", { className: "flex justify-between text-sm border-t border-slate-200 pt-2", children: [_jsx("span", { className: "text-slate-600", children: "Price/sqft:" }), _jsxs("span", { className: "font-medium text-slate-900", children: ["AED ", Math.round(unitPrice / unitArea).toLocaleString()] })] }))] })), _jsxs("div", { children: [_jsx("label", { htmlFor: "offeredPrice", className: "block text-sm font-medium text-slate-700 mb-2", children: "Offered Price (AED) *" }), _jsx("input", { id: "offeredPrice", type: "number", value: offeredPrice, onChange: (e) => setOfferedPrice(Math.max(0, Number(e.target.value))), className: "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition", required: true }), discount > 0 && (_jsxs("p", { className: "text-xs text-emerald-600 mt-1 font-medium", children: ["Discount: AED ", discount.toLocaleString()] })), unitArea > 0 && (_jsxs("p", { className: "text-xs text-slate-500 mt-1", children: ["AED ", pricePerSqft.toLocaleString(), " per sqft"] }))] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "validityDays", className: "block text-sm font-medium text-slate-700 mb-2", children: "Valid For (Days)" }), _jsx("input", { id: "validityDays", type: "number", min: "1", value: validityDays, onChange: (e) => setValidityDays(Math.max(1, Number(e.target.value))), className: "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: ["Expires: ", expiryDate.toLocaleDateString("en-AE")] })] }), offeredPrice > 0 && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-blue-900", children: "Offer Summary" }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-blue-700", children: "Sale Price:" }), _jsxs("span", { className: "font-bold text-blue-900", children: ["AED ", offeredPrice.toLocaleString()] })] }), discount > 0 && (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-blue-700", children: "Your Discount:" }), _jsxs("span", { className: "font-bold text-emerald-600", children: ["-AED ", discount.toLocaleString()] })] }))] })), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition", disabled: loading, children: "Cancel" }), _jsxs("button", { type: "submit", className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2", disabled: loading || !leadId || !unitId || !offeredPrice, children: [loading && _jsx("div", { className: "w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" }), loading ? "Creating..." : "Create Offer"] })] })] })] })] }));
}
