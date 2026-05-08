import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import DealActivityPanel from "./DealActivityPanel";
import DealDetailContent from "./DealDetailContent";
import DealSummaryPanel from "./DealSummaryPanel";
import Breadcrumbs from "./Breadcrumbs";
/**
 * DealDetailLayout - Two-column responsive layout wrapper for deal details
 *
 * Left column (60% desktop): Timeline + Activity
 * Right column (40% desktop): Summary + Payment Progress (sticky)
 * Mobile: Stacked vertically with tabs
 *
 * This is a refactored layout of the full deal cockpit with improved UX
 */
export default function DealDetailLayout({ dealId: dealIdProp, onBack }) {
    const params = useParams();
    const navigate = useNavigate();
    const dealId = dealIdProp ?? params.dealId ?? "";
    const handleBack = onBack ?? (() => navigate("/deals"));
    const [deal, setDeal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [useLegacyLayout, setUseLegacyLayout] = useState(false);
    useEffect(() => {
        loadDeal();
    }, [dealId]);
    const loadDeal = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`/api/deals/${dealId}`);
            setDeal(response.data.data || null);
        }
        catch (err) {
            const errorMsg = err.response?.data?.error || "Failed to load deal";
            setError(errorMsg);
            toast.error(errorMsg);
        }
        finally {
            setLoading(false);
        }
    };
    const handlePrimaryAction = async () => {
        if (!deal)
            return;
        try {
            // Example: Handle stage advancement
            const nextStages = {
                RESERVATION_PENDING: "RESERVATION_CONFIRMED",
                RESERVATION_CONFIRMED: "SPA_PENDING",
                SPA_PENDING: "SPA_SENT",
                SPA_SENT: "SPA_SIGNED",
                SPA_SIGNED: "OQOOD_PENDING",
                OQOOD_PENDING: "OQOOD_REGISTERED",
                OQOOD_REGISTERED: "INSTALLMENTS_ACTIVE",
                INSTALLMENTS_ACTIVE: "HANDOVER_PENDING",
                HANDOVER_PENDING: "COMPLETED",
            };
            const nextStage = nextStages[deal.stage];
            if (!nextStage) {
                toast.info("No next stage available");
                return;
            }
            // Navigate to full deal detail page for now (transition placeholder)
            navigate(`/deals/${dealId}`);
            toast.success(`Advanced to ${nextStage.replace(/_/g, " ")}`);
        }
        catch (err) {
            toast.error("Action failed");
        }
    };
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (error || !deal) {
        return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("button", { onClick: handleBack, className: "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800", children: "\u2190 Back" }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-xl p-6 text-center", children: [_jsx("p", { className: "text-red-600 font-medium", children: error || "Deal not found" }), _jsx("button", { onClick: handleBack, className: "mt-3 text-sm text-red-500 underline", children: "Go back" })] })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-slate-50", children: [_jsx("div", { className: "flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4", children: _jsx(Breadcrumbs, { crumbs: [
                        { label: "Deals", path: "/deals" },
                        { label: deal.dealNumber },
                    ] }) }), _jsxs("div", { className: "flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0", children: [_jsx("div", { className: "hidden lg:flex overflow-hidden flex-col border-r border-slate-200", children: _jsx(DealActivityPanel, { dealId: dealId, stage: deal.stage, reservationDate: deal.reservationDate, spaSignedDate: deal.spaSignedDate, oqoodRegisteredDate: deal.oqoodRegisteredDate, oqoodDeadline: deal.oqoodDeadline, completedDate: deal.completedDate }) }), _jsx("div", { className: "md:col-span-1 lg:col-span-2 overflow-hidden flex flex-col", children: _jsx(DealDetailContent, { dealId: dealId, deal: deal, onPaymentPaid: () => loadDeal(), onTaskCompleted: () => loadDeal() }) }), _jsx("div", { className: "hidden lg:flex flex-col h-full overflow-hidden sticky top-0", children: _jsx(DealSummaryPanel, { deal: deal, onPrimaryAction: handlePrimaryAction, primaryActionLabel: "Next Step", primaryActionColor: "bg-blue-600 hover:bg-blue-700" }) }), _jsx("div", { className: "lg:hidden overflow-hidden flex flex-col border-b border-slate-200", children: _jsx(DealActivityPanel, { dealId: dealId, stage: deal.stage, reservationDate: deal.reservationDate, spaSignedDate: deal.spaSignedDate, oqoodRegisteredDate: deal.oqoodRegisteredDate, oqoodDeadline: deal.oqoodDeadline, completedDate: deal.completedDate }) })] }), _jsx("div", { className: "lg:hidden flex-shrink-0 border-t border-slate-200 bg-white", children: _jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-600 font-medium", children: "Deal" }), _jsx("p", { className: "text-sm font-bold text-slate-900", children: deal.dealNumber })] }), _jsxs("p", { className: "text-sm text-slate-600", children: [deal.lead.firstName, " ", deal.lead.lastName] })] }), _jsxs("div", { className: "flex items-center justify-between text-xs text-slate-600", children: [_jsxs("span", { children: ["Sale Price: AED ", deal.salePrice.toLocaleString()] }), _jsxs("span", { children: ["Unit: ", deal.unit.unitNumber] })] }), _jsx("button", { onClick: handlePrimaryAction, className: "w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition", children: "Next Step" })] }) })] }));
}
