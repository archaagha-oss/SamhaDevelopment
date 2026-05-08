import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useSettings } from "../contexts/SettingsContext";
import { formatCurrency, formatDate } from "../utils/format";
const TYPE_LABEL = {
    STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
    THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};
const Row = ({ label, value, bold }) => (_jsxs("div", { className: "flex justify-between py-2.5 border-b border-slate-100 text-sm", children: [_jsx("span", { className: "text-slate-500", children: label }), _jsx("span", { className: bold ? "font-bold text-slate-900" : "font-semibold text-slate-800", children: value })] }));
export default function InvoicePrintPage() {
    const { paymentId } = useParams();
    const { settings } = useSettings();
    const [data, setData] = useState(null);
    const [docVersion, setDocVersion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fmtAmt = (n) => formatCurrency(n, settings, { decimals: 0 });
    const fmtDate2 = (d) => formatDate(d, settings);
    const today = () => formatDate(new Date(), settings);
    const searchParams = new URLSearchParams(window.location.search);
    const docId = searchParams.get("docId");
    const autoPrint = searchParams.get("auto") === "print";
    useEffect(() => {
        if (!paymentId)
            return;
        if (docId) {
            // Load from stored dataSnapshot (historical version)
            axios.get(`/api/payments/${paymentId}/documents/${docId}`)
                .then((r) => {
                const doc = r.data;
                setDocVersion(doc.version ?? null);
                setData({ ...doc.dataSnapshot, generatedAt: doc.uploadedAt });
            })
                .catch((e) => setError(e.response?.data?.error || "Document not found"))
                .finally(() => setLoading(false));
        }
        else {
            // Load live payment data
            axios.get(`/api/payments/${paymentId}`)
                .then((r) => {
                const p = r.data;
                setData({
                    dealNumber: p.deal?.dealNumber ?? "",
                    milestoneLabel: p.milestoneLabel,
                    amount: p.amount,
                    dueDate: p.dueDate,
                    status: p.status,
                    buyerDetails: { name: `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`.trim(), phone: p.deal?.lead?.phone ?? "", email: p.deal?.lead?.email },
                    unitDetails: { unitNumber: p.deal?.unit?.unitNumber ?? "", type: p.deal?.unit?.type ?? "", floor: p.deal?.unit?.floor ?? 0 },
                    projectDetails: { name: p.deal?.unit?.project?.name ?? "", location: p.deal?.unit?.project?.location ?? "" },
                });
            })
                .catch((e) => setError(e.response?.data?.error || "Failed to load payment"))
                .finally(() => setLoading(false));
        }
    }, [paymentId, docId]);
    useEffect(() => {
        if (!data || !autoPrint)
            return;
        const t = setTimeout(() => window.print(), 400);
        return () => clearTimeout(t);
    }, [data, autoPrint]);
    if (loading)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error || !data)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("p", { className: "text-red-600", children: error || "Invoice not found" }) }));
    return (_jsxs("div", { className: "bg-white min-h-screen", children: [_jsxs("div", { className: "print:hidden fixed top-4 right-4 z-50 flex gap-2", children: [_jsx("button", { onClick: () => window.print(), className: "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg", children: "Download / Print PDF" }), _jsx("button", { onClick: () => window.close(), className: "px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 shadow-lg", children: "Close" })] }), docVersion !== null && (_jsx("div", { className: "print:hidden fixed top-4 left-4 z-50", children: _jsxs("span", { className: "px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 rounded-lg shadow", children: ["Viewing v", docVersion, " \u2014 frozen at generation time"] }) })), _jsxs("div", { className: "max-w-2xl mx-auto px-8 py-12 print:py-8 print:px-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-800", children: [_jsxs("div", { className: "flex items-start gap-3", children: [settings.logoUrl && (_jsx("img", { src: settings.logoUrl, alt: "", className: "h-12 w-12 object-contain", onError: (e) => { e.currentTarget.style.display = "none"; } })), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900 tracking-tight", children: "INVOICE" }), settings.companyName && _jsx("p", { className: "text-xs font-semibold text-slate-700 mt-1", children: settings.companyName }), _jsxs("p", { className: "text-sm text-slate-500 mt-0.5", children: [data.projectDetails.name, " \u2014 ", data.projectDetails.location] })] })] }), _jsxs("div", { className: "text-right text-sm text-slate-500 space-y-1", children: [_jsxs("p", { className: "font-semibold text-slate-700", children: ["Date: ", today()] }), _jsx("p", { className: "font-mono text-xs text-slate-400", children: data.dealNumber }), _jsxs("p", { className: "text-xs font-medium text-slate-600", children: ["Due: ", fmtDate2(data.dueDate)] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Bill To" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4", children: [_jsx(Row, { label: "Buyer Name", value: data.buyerDetails.name, bold: true }), _jsx(Row, { label: "Phone", value: data.buyerDetails.phone }), data.buyerDetails.email && _jsx(Row, { label: "Email", value: data.buyerDetails.email })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Property Details" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4", children: [_jsx(Row, { label: "Unit", value: data.unitDetails.unitNumber, bold: true }), _jsx(Row, { label: "Type", value: TYPE_LABEL[data.unitDetails.type] ?? data.unitDetails.type }), _jsx(Row, { label: "Floor", value: `Floor ${data.unitDetails.floor}` }), _jsx(Row, { label: "Project", value: data.projectDetails.name })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Invoice Details" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4", children: [_jsx(Row, { label: "Description", value: data.milestoneLabel }), _jsx(Row, { label: "Due Date", value: fmtDate2(data.dueDate) }), _jsxs("div", { className: "flex justify-between pt-3 mt-1 border-t-2 border-slate-200 text-sm", children: [_jsx("span", { className: "font-bold text-slate-700 text-base", children: "Amount Due" }), _jsx("span", { className: "font-bold text-slate-900 text-base", children: fmtAmt(data.amount) })] })] })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 mb-8", children: [_jsx("p", { className: "font-semibold text-slate-700 mb-2", children: "Payment Instructions" }), data.paymentInstructions ? (_jsx("pre", { className: "whitespace-pre-wrap font-sans text-sm text-slate-600", children: data.paymentInstructions })) : (_jsxs(_Fragment, { children: [_jsx("p", { children: "Please transfer the amount due to our designated bank account before the due date." }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Quote your unit number and deal reference when making the transfer." })] }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 break-inside-avoid", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mb-2", children: "Authorized By" }), _jsx("div", { className: "border-b border-slate-400 h-10 mb-2" }), _jsx("p", { className: "text-xs text-slate-400", children: "Developer Representative" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mb-2", children: "Acknowledged By" }), _jsx("div", { className: "border-b border-slate-400 h-10 mb-2" }), _jsx("p", { className: "text-xs text-slate-400", children: data.buyerDetails.name })] })] }), _jsxs("p", { className: "text-center text-xs text-slate-300 mt-10 print:mt-6", children: ["Generated ", today(), " \u00B7 ", data.dealNumber, docVersion !== null ? ` · v${docVersion}` : ""] })] }), _jsx("style", { children: `
        @media print {
          @page { margin: 15mm; }
          .print\\:hidden { display: none !important; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      ` })] }));
}
