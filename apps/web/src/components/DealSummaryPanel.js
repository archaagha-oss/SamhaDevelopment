import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
const STAGE_COLORS = {
    RESERVATION_PENDING: "bg-slate-100 text-slate-700",
    RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
    SPA_PENDING: "bg-yellow-100 text-yellow-700",
    SPA_SENT: "bg-yellow-100 text-yellow-700",
    SPA_SIGNED: "bg-violet-100 text-violet-700",
    OQOOD_PENDING: "bg-orange-100 text-orange-700",
    OQOOD_REGISTERED: "bg-teal-100 text-teal-700",
    INSTALLMENTS_ACTIVE: "bg-indigo-100 text-indigo-700",
    HANDOVER_PENDING: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
};
/**
 * DealSummaryPanel - Right column (40%) of deal detail layout
 *
 * Displays:
 * - Deal summary: buyer, unit, price, broker, start date
 * - Stage badge (color-coded)
 * - Payment progress bar
 * - Payment milestones table
 * - Documents section
 * - Primary action button (sticky)
 */
export default function DealSummaryPanel({ deal, onPrimaryAction, primaryActionLabel = "Proceed", primaryActionColor = "bg-blue-600 hover:bg-blue-700", }) {
    const formatDate = (dateStr) => {
        if (!dateStr)
            return "N/A";
        return new Date(dateStr).toLocaleDateString("en-AE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };
    // Calculate payment progress
    const paymentProgress = useMemo(() => {
        if (!deal.payments || deal.payments.length === 0) {
            return { paid: 0, total: deal.salePrice, percentage: 0 };
        }
        const paid = deal.payments
            .filter((p) => p.status === "PAID")
            .reduce((sum, p) => sum + p.amount, 0);
        return {
            paid,
            total: deal.salePrice,
            percentage: Math.round((paid / deal.salePrice) * 100),
        };
    }, [deal.payments, deal.salePrice]);
    const stageColor = STAGE_COLORS[deal.stage] || "bg-gray-100 text-gray-700";
    return (_jsxs("div", { className: "flex flex-col h-full bg-slate-50 border-l border-slate-200", children: [_jsxs("div", { className: "flex-shrink-0 bg-white border-b border-slate-200 p-6 space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-600 font-medium", children: "Deal Number" }), _jsx("p", { className: "text-lg font-bold text-slate-900", children: deal.dealNumber })] }), _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${stageColor}`, children: deal.stage.replace(/_/g, " ") })] }), _jsxs("div", { className: "bg-slate-50 rounded-lg p-4 space-y-3 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-600", children: "Buyer:" }), _jsxs("span", { className: "font-medium text-slate-900", children: [deal.lead.firstName, " ", deal.lead.lastName] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-600", children: "Unit:" }), _jsx("span", { className: "font-medium text-slate-900", children: deal.unit.unitNumber })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-600", children: "Sale Price:" }), _jsxs("span", { className: "font-bold text-slate-900", children: ["AED ", deal.salePrice.toLocaleString()] })] }), deal.brokerCompany && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-600", children: "Broker:" }), _jsx("span", { className: "font-medium text-slate-900", children: deal.brokerCompany.name })] })), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-600", children: "Started:" }), _jsx("span", { className: "font-medium text-slate-900", children: formatDate(deal.createdAt) })] })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-3", children: "Payment Progress" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-slate-600", children: ["AED ", paymentProgress.paid.toLocaleString(), " of AED ", paymentProgress.total.toLocaleString()] }), _jsxs("span", { className: "font-medium text-slate-900", children: [paymentProgress.percentage, "%"] })] }), _jsx("div", { className: "w-full bg-slate-200 rounded-full h-2 overflow-hidden", children: _jsx("div", { className: "bg-emerald-500 h-full transition-all duration-300", style: { width: `${paymentProgress.percentage}%` } }) })] })] }), deal.payments && deal.payments.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-3", children: "Payment Milestones" }), _jsx("div", { className: "space-y-2 max-h-64 overflow-y-auto", children: deal.payments.map((payment) => (_jsx("div", { className: `p-3 rounded-lg border text-sm ${payment.status === "PAID"
                                        ? "bg-emerald-50 border-emerald-200"
                                        : "bg-amber-50 border-amber-200"}`, children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("span", { className: "text-slate-900 font-medium", children: ["AED ", payment.amount.toLocaleString()] }), _jsx("span", { className: `text-xs font-medium px-2 py-1 rounded ${payment.status === "PAID"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-amber-100 text-amber-700"}`, children: payment.status })] }) }, payment.id))) })] }))] }), _jsx("div", { className: "flex-shrink-0 bg-white border-t border-slate-200 p-6", children: _jsx("button", { onClick: onPrimaryAction, className: `w-full px-4 py-3 text-white rounded-lg font-medium transition ${primaryActionColor}`, children: primaryActionLabel }) })] }));
}
