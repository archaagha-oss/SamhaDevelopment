import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
const fmtAED = (n) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
const TYPE_LABEL = {
    STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
    THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};
export default function OfferPrintPage() {
    const { offerId } = useParams();
    const [offer, setOffer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!offerId)
            return;
        axios.get(`/api/offers/${offerId}`)
            .then((r) => setOffer(r.data))
            .catch((e) => setError(e.response?.data?.error || "Failed to load offer"))
            .finally(() => setLoading(false));
    }, [offerId]);
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (error || !offer) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("p", { className: "text-red-600", children: error || "Offer not found" }) }));
    }
    const { lead, unit } = offer;
    const floorPlans = unit.images.filter((i) => i.type === "FLOOR_PLAN");
    const floorMaps = unit.images.filter((i) => i.type === "FLOOR_MAP");
    return (_jsxs("div", { className: "bg-white min-h-screen", children: [_jsxs("div", { className: "print:hidden fixed top-4 right-4 z-50 flex gap-2", children: [_jsx("button", { onClick: () => window.print(), className: "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg", children: "Download / Print PDF" }), _jsx("button", { onClick: () => window.close(), className: "px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 shadow-lg", children: "Close" })] }), _jsxs("div", { className: "max-w-3xl mx-auto px-8 py-10 print:p-0 print:max-w-none", children: [_jsxs("div", { className: "flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-900", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-black text-slate-900 tracking-tight", children: "SALES OFFER" }), _jsxs("p", { className: "text-slate-500 text-sm mt-1", children: [unit.project.name, " \u2014 ", unit.project.location] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Offer Date" }), _jsx("p", { className: "text-sm font-semibold text-slate-800", children: fmtDate(offer.createdAt) }), offer.expiresAt && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mt-1", children: "Valid Until" }), _jsx("p", { className: "text-sm font-semibold text-red-600", children: fmtDate(offer.expiresAt) })] }))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-6 mb-8", children: [_jsxs("div", { className: "bg-slate-50 rounded-xl p-5", children: [_jsx("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Prepared For" }), _jsxs("p", { className: "text-lg font-bold text-slate-900", children: [lead.firstName, " ", lead.lastName] }), _jsx("p", { className: "text-sm text-slate-600 mt-1", children: lead.phone }), lead.email && _jsx("p", { className: "text-sm text-slate-600", children: lead.email }), lead.nationality && (_jsxs("p", { className: "text-xs text-slate-400 mt-2", children: ["Nationality: ", lead.nationality] }))] }), _jsxs("div", { className: "bg-slate-900 rounded-xl p-5 text-white", children: [_jsx("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Offer Price" }), _jsx("p", { className: "text-2xl font-black", children: fmtAED(offer.offeredPrice) }), offer.discountAmount > 0 && (_jsxs("div", { className: "mt-2 space-y-1", children: [_jsxs("p", { className: "text-xs text-slate-400", children: ["List Price: ", _jsx("span", { className: "line-through", children: fmtAED(offer.originalPrice) })] }), _jsxs("p", { className: "text-xs text-emerald-400 font-semibold", children: ["Discount: ", fmtAED(offer.discountAmount), " (", offer.discountPct.toFixed(1), "%)"] })] }))] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Unit Details" }), _jsx("div", { className: "border border-slate-200 rounded-xl overflow-hidden", children: _jsx("table", { className: "w-full text-sm", children: _jsx("tbody", { className: "divide-y divide-slate-100", children: [
                                            ["Project", unit.project.name],
                                            ["Unit Number", unit.unitNumber],
                                            ["Unit Type", TYPE_LABEL[unit.type] ?? unit.type],
                                            ["Floor", `Floor ${unit.floor}`],
                                            ["Area", `${unit.area} sqm`],
                                            ["View", unit.view],
                                            ...(unit.bathrooms != null ? [["Bathrooms", String(unit.bathrooms)]] : []),
                                            ...(unit.parkingSpaces != null ? [["Parking", String(unit.parkingSpaces)]] : []),
                                            ...(unit.project.handoverDate ? [["Handover", fmtDate(unit.project.handoverDate)]] : []),
                                        ].map(([label, value]) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2.5 text-slate-500 font-medium w-40", children: label }), _jsx("td", { className: "px-4 py-2.5 text-slate-900 font-semibold", children: value })] }, label))) }) }) })] }), floorPlans.length > 0 && (_jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Floor Plan" }), _jsx("div", { className: `grid gap-4 ${floorPlans.length === 1 ? "grid-cols-1" : "grid-cols-2"}`, children: floorPlans.map((img) => (_jsxs("div", { className: "border border-slate-200 rounded-xl overflow-hidden", children: [_jsx("img", { src: img.url, alt: img.caption || "Floor Plan", className: "w-full object-contain max-h-72" }), img.caption && (_jsx("p", { className: "text-xs text-center text-slate-500 py-1.5 bg-slate-50", children: img.caption }))] }, img.id))) })] })), floorMaps.length > 0 && (_jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Unit Location on Floor" }), _jsxs("p", { className: "text-xs text-slate-500 mb-3", children: ["Floor ", unit.floor, " \u00B7 Unit ", unit.unitNumber] }), _jsx("div", { className: `grid gap-4 ${floorMaps.length === 1 ? "grid-cols-1" : "grid-cols-2"}`, children: floorMaps.map((img) => (_jsxs("div", { className: "border-2 border-amber-200 rounded-xl overflow-hidden", children: [_jsx("img", { src: img.url, alt: img.caption || "Floor Location Map", className: "w-full object-contain max-h-72" }), img.caption && (_jsx("p", { className: "text-xs text-center text-slate-500 py-1.5 bg-amber-50", children: img.caption }))] }, img.id))) })] })), _jsxs("div", { className: "mt-10 pt-6 border-t border-slate-200 text-center", children: [_jsx("p", { className: "text-xs text-slate-400", children: "This offer is valid for 7 days from the date of issue unless otherwise specified. Prices are subject to change without prior notice." }), _jsxs("p", { className: "text-xs text-slate-300 mt-2", children: ["Generated by Samha CRM \u00B7 ", fmtDate(new Date().toISOString())] })] })] }), _jsx("style", { children: `
        @media print {
          @page { margin: 15mm; }
          .print\\:hidden { display: none !important; }
          table, tr, .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      ` })] }));
}
