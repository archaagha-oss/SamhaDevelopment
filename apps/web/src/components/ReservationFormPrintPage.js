import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
const fmtAED = (n) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
const TYPE_LABEL = {
    STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
    THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};
const ROW = ({ label, value }) => (_jsxs("div", { className: "flex justify-between py-2 border-b border-slate-100 text-sm", children: [_jsx("span", { className: "text-slate-500", children: label }), _jsx("span", { className: "font-semibold text-slate-800", children: value })] }));
export default function ReservationFormPrintPage() {
    const { dealId } = useParams();
    const [deal, setDeal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!dealId)
            return;
        axios.get(`/api/deals/${dealId}`)
            .then((r) => setDeal(r.data))
            .catch((e) => setError(e.response?.data?.error || "Failed to load deal"))
            .finally(() => setLoading(false));
    }, [dealId]);
    if (loading)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error || !deal)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("p", { className: "text-red-600", children: error || "Deal not found" }) }));
    const { lead, unit } = deal;
    const netPrice = deal.salePrice - deal.discount;
    return (_jsxs("div", { className: "bg-white min-h-screen", children: [_jsxs("div", { className: "print:hidden fixed top-4 right-4 z-50 flex gap-2", children: [_jsx("button", { onClick: () => window.print(), className: "px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 shadow-lg", children: "Download / Print PDF" }), _jsx("button", { onClick: () => window.close(), className: "px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 shadow-lg", children: "Close" })] }), _jsxs("div", { className: "max-w-3xl mx-auto px-10 py-16 print:p-0 print:max-w-none", children: [_jsxs("div", { className: "border-b-2 border-slate-800 pb-6 mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900 tracking-tight", children: "Reservation Form" }), _jsxs("div", { className: "flex items-center justify-between mt-2", children: [_jsxs("p", { className: "text-slate-500 text-sm", children: [unit.project.name, " \u2014 ", unit.project.location] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-slate-400", children: "Reference" }), _jsx("p", { className: "text-sm font-bold text-slate-700", children: deal.dealNumber })] })] })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4", children: "Buyer Details" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-10", children: [_jsx(ROW, { label: "Full Name", value: `${lead.firstName} ${lead.lastName}` }), _jsx(ROW, { label: "Phone", value: lead.phone }), _jsx(ROW, { label: "Email", value: lead.email || "—" }), _jsx(ROW, { label: "Nationality", value: lead.nationality || "—" })] })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4", children: "Unit Details" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-10", children: [_jsx(ROW, { label: "Project", value: unit.project.name }), _jsx(ROW, { label: "Unit Number", value: unit.unitNumber }), _jsx(ROW, { label: "Type", value: TYPE_LABEL[unit.type] || unit.type }), _jsx(ROW, { label: "Floor", value: String(unit.floor) }), _jsx(ROW, { label: "Total Area", value: `${unit.area} sqm` }), _jsx(ROW, { label: "View", value: unit.view }), unit.bathrooms != null && _jsx(ROW, { label: "Bathrooms", value: String(unit.bathrooms) }), unit.parkingSpaces != null && _jsx(ROW, { label: "Parking", value: String(unit.parkingSpaces) }), unit.project.handoverDate && _jsx(ROW, { label: "Handover", value: fmtDate(unit.project.handoverDate) })] })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4", children: "Financial Details" }), _jsxs("div", { className: "space-y-0", children: [_jsx(ROW, { label: "Sale Price", value: fmtAED(deal.salePrice) }), deal.discount > 0 && _jsx(ROW, { label: "Discount", value: `− ${fmtAED(deal.discount)}` }), _jsx(ROW, { label: "Net Price", value: fmtAED(netPrice) }), _jsx(ROW, { label: "DLD Fee (4%)", value: fmtAED(deal.dldFee) }), _jsx(ROW, { label: "Admin Fee", value: fmtAED(deal.adminFee) }), _jsxs("div", { className: "flex justify-between py-3 border-b border-slate-800 text-base font-bold mt-1", children: [_jsx("span", { className: "text-slate-800", children: "Total Payable" }), _jsx("span", { className: "text-slate-900", children: fmtAED(netPrice + deal.dldFee + deal.adminFee) })] }), _jsxs("div", { className: "flex justify-between py-2 text-sm mt-1", children: [_jsx("span", { className: "text-slate-500", children: "Reservation Amount Paid" }), _jsx("span", { className: "font-bold text-emerald-700", children: fmtAED(deal.reservationAmount) })] })] })] }), _jsxs("section", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4", children: "Payment & Dates" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-10", children: [_jsx(ROW, { label: "Payment Plan", value: deal.paymentPlan?.name || "—" }), _jsx(ROW, { label: "Reservation Date", value: fmtDate(deal.reservationDate) }), _jsx(ROW, { label: "Oqood Deadline", value: fmtDate(deal.oqoodDeadline) })] })] }), _jsxs("section", { className: "mt-12 grid grid-cols-2 gap-16", children: [_jsxs("div", { children: [_jsx("div", { className: "border-b border-slate-300 h-10 mb-2" }), _jsx("p", { className: "text-xs text-slate-500", children: "Buyer Signature & Date" }), _jsxs("p", { className: "text-sm font-semibold text-slate-700 mt-1", children: [lead.firstName, " ", lead.lastName] })] }), _jsxs("div", { children: [_jsx("div", { className: "border-b border-slate-300 h-10 mb-2" }), _jsx("p", { className: "text-xs text-slate-500", children: "Developer / Agent Signature & Date" })] })] }), _jsxs("p", { className: "text-xs text-slate-400 mt-10 text-center", children: ["This reservation form is subject to the terms and conditions of the Sale and Purchase Agreement. Generated on ", fmtDate(new Date().toISOString()), "."] })] }), _jsx("style", { children: `
        @media print {
          @page { margin: 15mm; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
        }
      ` })] }));
}
