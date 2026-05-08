import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
const fmtAED = (n) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
const TYPE_LABEL = {
    STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
    THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};
const Row = ({ label, value, bold }) => (_jsxs("div", { className: "flex justify-between py-2.5 border-b border-slate-100 text-sm", children: [_jsx("span", { className: "text-slate-500", children: label }), _jsx("span", { className: bold ? "font-bold text-slate-900" : "font-semibold text-slate-800", children: value })] }));
// Map a stored dataSnapshot (immutable) back to the DealDetail render interface.
function snapshotToDeal(snap) {
    const buyerName = snap.buyerDetails?.name ?? "";
    const spaceIdx = buyerName.indexOf(" ");
    const firstName = spaceIdx === -1 ? buyerName : buyerName.slice(0, spaceIdx);
    const lastName = spaceIdx === -1 ? "" : buyerName.slice(spaceIdx + 1);
    return {
        id: snap.dealId ?? "",
        dealNumber: snap.dealNumber ?? "",
        salePrice: snap.salePrice ?? 0,
        discount: snap.discount ?? 0,
        dldFee: snap.dldFee ?? 0,
        adminFee: snap.adminFee ?? 0,
        reservationDate: snap.reservationDate ?? "",
        stage: "RESERVATION_CONFIRMED",
        lead: {
            firstName,
            lastName,
            phone: snap.buyerDetails?.phone ?? "",
            email: snap.buyerDetails?.email,
            nationality: snap.buyerDetails?.nationality,
        },
        unit: {
            unitNumber: snap.unitDetails?.unitNumber ?? "",
            type: snap.unitDetails?.type ?? "",
            floor: snap.unitDetails?.floor ?? 0,
            area: snap.unitDetails?.area ?? 0,
            view: snap.unitDetails?.view,
            bathrooms: snap.unitDetails?.bathrooms,
            parkingSpaces: snap.unitDetails?.parkingSpaces,
            project: {
                name: snap.projectDetails?.name ?? "",
                location: snap.projectDetails?.location ?? "",
                handoverDate: snap.projectDetails?.handoverDate,
            },
        },
        paymentPlan: snap.paymentPlan?.name ? { name: snap.paymentPlan.name } : null,
    };
}
export default function SalesOfferPrintPage() {
    const { dealId } = useParams();
    const [deal, setDeal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [docVersion, setDocVersion] = useState(null);
    const searchParams = new URLSearchParams(window.location.search);
    const docId = searchParams.get("docId");
    const autoPrint = searchParams.get("auto") === "print";
    useEffect(() => {
        if (!dealId)
            return;
        if (docId) {
            // Historical version — render from the immutable dataSnapshot
            axios.get(`/api/deals/${dealId}/documents/${docId}`)
                .then((r) => {
                const doc = r.data;
                setDocVersion(doc.version ?? null);
                setDeal(snapshotToDeal(doc.dataSnapshot ?? {}));
            })
                .catch((e) => setError(e.response?.data?.error || "Document not found"))
                .finally(() => setLoading(false));
        }
        else {
            // Latest — fetch current deal state
            axios.get(`/api/deals/${dealId}`)
                .then((r) => setDeal(r.data))
                .catch((e) => setError(e.response?.data?.error || "Failed to load deal"))
                .finally(() => setLoading(false));
        }
    }, [dealId, docId]);
    // Auto-trigger print dialog when opened with ?auto=print
    useEffect(() => {
        if (!deal || !autoPrint)
            return;
        const t = setTimeout(() => window.print(), 400);
        return () => clearTimeout(t);
    }, [deal, autoPrint]);
    if (loading)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error || !deal)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("p", { className: "text-red-600", children: error || "Deal not found" }) }));
    const { lead, unit } = deal;
    const netPrice = deal.salePrice - deal.discount;
    const totalWithFees = netPrice + deal.dldFee + deal.adminFee;
    return (_jsxs("div", { className: "bg-white min-h-screen", children: [_jsxs("div", { className: "print:hidden fixed top-4 right-4 z-50 flex gap-2", children: [_jsx("button", { onClick: () => window.print(), className: "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg", children: "Download / Print PDF" }), _jsx("button", { onClick: () => window.close(), className: "px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 shadow-lg", children: "Close" })] }), docVersion !== null && (_jsx("div", { className: "print:hidden fixed top-4 left-4 z-50", children: _jsxs("span", { className: "px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 rounded-lg shadow", children: ["Viewing v", docVersion, " \u2014 data frozen at generation time"] }) })), _jsxs("div", { className: "max-w-2xl mx-auto px-8 py-12 print:py-8 print:px-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-8 pb-6 border-b-2 border-blue-600", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-blue-700 tracking-tight", children: "Sales Offer" }), _jsxs("p", { className: "text-sm text-slate-500 mt-1", children: [unit.project.name, " \u2014 ", unit.project.location] })] }), _jsxs("div", { className: "text-right text-sm text-slate-500 space-y-1", children: [_jsxs("p", { className: "font-semibold text-slate-700", children: ["Date: ", today()] }), _jsx("p", { className: "font-mono text-xs text-slate-400", children: deal.dealNumber }), docVersion !== null && (_jsxs("p", { className: "text-xs font-semibold text-amber-600", children: ["Version ", docVersion] }))] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Buyer Details" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4 space-y-0", children: [_jsx(Row, { label: "Full Name", value: `${lead.firstName} ${lead.lastName}` }), _jsx(Row, { label: "Phone", value: lead.phone }), lead.email && _jsx(Row, { label: "Email", value: lead.email }), lead.nationality && _jsx(Row, { label: "Nationality", value: lead.nationality })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Unit Details" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4 space-y-0", children: [_jsx(Row, { label: "Unit Number", value: unit.unitNumber, bold: true }), _jsx(Row, { label: "Property Type", value: TYPE_LABEL[unit.type] ?? unit.type }), _jsx(Row, { label: "Floor", value: `Floor ${unit.floor}` }), _jsx(Row, { label: "Total Area", value: `${unit.area.toLocaleString()} sq.ft` }), unit.view && _jsx(Row, { label: "View", value: unit.view }), unit.bathrooms && _jsx(Row, { label: "Bathrooms", value: String(unit.bathrooms) }), unit.parkingSpaces && _jsx(Row, { label: "Parking", value: String(unit.parkingSpaces) }), unit.project.handoverDate && (_jsx(Row, { label: "Estimated Handover", value: fmtDate(unit.project.handoverDate) })), deal.paymentPlan && _jsx(Row, { label: "Payment Plan", value: deal.paymentPlan.name })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Pricing Summary" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4 space-y-0", children: [_jsx(Row, { label: "Listed Price", value: fmtAED(deal.salePrice) }), deal.discount > 0 && (_jsxs("div", { className: "flex justify-between py-2.5 border-b border-slate-100 text-sm", children: [_jsx("span", { className: "text-emerald-600", children: "Discount" }), _jsxs("span", { className: "font-semibold text-emerald-600", children: ["- ", fmtAED(deal.discount)] })] })), _jsx(Row, { label: "Net Sale Price", value: fmtAED(netPrice), bold: true }), _jsx(Row, { label: "DLD Fee (4%)", value: fmtAED(deal.dldFee) }), _jsx(Row, { label: "Admin Fee", value: fmtAED(deal.adminFee) }), _jsxs("div", { className: "flex justify-between pt-3 mt-1 border-t-2 border-slate-200 text-sm", children: [_jsx("span", { className: "font-bold text-slate-700 text-base", children: "Total (inc. Fees)" }), _jsx("span", { className: "font-bold text-blue-700 text-base", children: fmtAED(totalWithFees) })] })] })] }), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-8", children: "This offer is valid for 7 days from the date of issue. Unit availability is subject to change until a reservation agreement is signed and a reservation deposit is received." }), _jsxs("div", { className: "grid grid-cols-2 gap-8 pt-6 border-t border-slate-200", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mb-6", children: "Authorized Signature" }), _jsx("div", { className: "border-b border-slate-300 mb-2" }), _jsx("p", { className: "text-xs text-slate-400", children: "Developer Representative" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mb-6", children: "Buyer Acknowledgment" }), _jsx("div", { className: "border-b border-slate-300 mb-2" }), _jsxs("p", { className: "text-xs text-slate-400", children: [lead.firstName, " ", lead.lastName] })] })] }), _jsxs("p", { className: "text-center text-xs text-slate-300 mt-10 print:mt-6", children: ["Generated on ", today(), " \u00B7 ", deal.dealNumber, docVersion !== null ? ` · v${docVersion}` : ""] })] })] }));
}
