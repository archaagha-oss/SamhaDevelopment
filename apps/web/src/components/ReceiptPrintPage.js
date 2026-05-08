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
const METHOD_LABEL = {
    BANK_TRANSFER: "Bank Transfer", CASH: "Cash", CHEQUE: "Cheque",
    CRYPTO: "Crypto", CARD: "Card", PDC: "PDC",
};
const Row = ({ label, value, bold }) => (_jsxs("div", { className: "flex justify-between py-2.5 border-b border-slate-100 text-sm", children: [_jsx("span", { className: "text-slate-500", children: label }), _jsx("span", { className: bold ? "font-bold text-slate-900" : "font-semibold text-slate-800", children: value })] }));
export default function ReceiptPrintPage() {
    const { paymentId } = useParams();
    const [data, setData] = useState(null);
    const [docVersion, setDocVersion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const searchParams = new URLSearchParams(window.location.search);
    const docId = searchParams.get("docId");
    const autoPrint = searchParams.get("auto") === "print";
    useEffect(() => {
        if (!paymentId)
            return;
        if (docId) {
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
            axios.get(`/api/payments/${paymentId}`)
                .then((r) => {
                const p = r.data;
                setData({
                    dealNumber: p.deal?.dealNumber ?? "",
                    milestoneLabel: p.milestoneLabel,
                    amount: p.amount,
                    paidDate: p.paidDate,
                    paymentMethod: p.paymentMethod ?? "",
                    receiptKey: p.receiptKey ?? undefined,
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
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("div", { className: "w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error || !data)
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-white", children: _jsx("p", { className: "text-red-600", children: error || "Receipt not found" }) }));
    return (_jsxs("div", { className: "bg-white min-h-screen", children: [_jsxs("div", { className: "print:hidden fixed top-4 right-4 z-50 flex gap-2", children: [_jsx("button", { onClick: () => window.print(), className: "px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-lg", children: "Download / Print" }), _jsx("button", { onClick: () => window.close(), className: "px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 shadow-lg", children: "Close" })] }), docVersion !== null && (_jsx("div", { className: "print:hidden fixed top-4 left-4 z-50", children: _jsxs("span", { className: "px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 rounded-lg shadow", children: ["Viewing v", docVersion, " \u2014 frozen at generation time"] }) })), _jsxs("div", { className: "max-w-2xl mx-auto px-8 py-12 print:py-8 print:px-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-8 pb-6 border-b-2 border-emerald-700", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900 tracking-tight", children: "PAYMENT RECEIPT" }), _jsxs("p", { className: "text-sm text-slate-500 mt-1", children: [data.projectDetails.name, " \u2014 ", data.projectDetails.location] })] }), _jsxs("div", { className: "text-right text-sm text-slate-500 space-y-1", children: [_jsxs("p", { className: "font-semibold text-slate-700", children: ["Date: ", today()] }), _jsx("p", { className: "font-mono text-xs text-slate-400", children: data.dealNumber }), data.paidDate && (_jsxs("p", { className: "text-xs font-medium text-emerald-700", children: ["Paid: ", fmtDate(data.paidDate)] }))] })] }), _jsxs("div", { className: "mb-6 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3", children: [_jsx("span", { className: "text-emerald-600 text-xl", children: "\u2713" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-emerald-800", children: "Payment Confirmed" }), _jsx("p", { className: "text-xs text-emerald-600", children: "This receipt confirms that the payment below has been received." })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Received From" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4", children: [_jsx(Row, { label: "Buyer Name", value: data.buyerDetails.name, bold: true }), _jsx(Row, { label: "Phone", value: data.buyerDetails.phone }), data.buyerDetails.email && _jsx(Row, { label: "Email", value: data.buyerDetails.email })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Property Details" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4", children: [_jsx(Row, { label: "Unit", value: data.unitDetails.unitNumber, bold: true }), _jsx(Row, { label: "Type", value: TYPE_LABEL[data.unitDetails.type] ?? data.unitDetails.type }), _jsx(Row, { label: "Floor", value: `Floor ${data.unitDetails.floor}` }), _jsx(Row, { label: "Project", value: data.projectDetails.name })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3", children: "Payment Details" }), _jsxs("div", { className: "bg-slate-50 rounded-xl p-4", children: [_jsx(Row, { label: "Description", value: data.milestoneLabel }), _jsx(Row, { label: "Payment Method", value: METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod }), data.paidDate && _jsx(Row, { label: "Payment Date", value: fmtDate(data.paidDate) }), data.receiptKey && _jsx(Row, { label: "Reference", value: data.receiptKey }), _jsxs("div", { className: "flex justify-between pt-3 mt-1 border-t-2 border-emerald-200 text-sm", children: [_jsx("span", { className: "font-bold text-slate-700 text-base", children: "Amount Received" }), _jsx("span", { className: "font-bold text-emerald-700 text-base", children: fmtAED(data.amount) })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-8 pt-6 border-t border-slate-200", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mb-6", children: "Authorized By" }), _jsx("div", { className: "border-b border-slate-300 mb-2" }), _jsx("p", { className: "text-xs text-slate-400", children: "Developer Representative" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 uppercase tracking-wide mb-6", children: "Received By" }), _jsx("div", { className: "border-b border-slate-300 mb-2" }), _jsx("p", { className: "text-xs text-slate-400", children: data.buyerDetails.name })] })] }), _jsxs("p", { className: "text-center text-xs text-slate-300 mt-10 print:mt-6", children: ["Generated ", today(), " \u00B7 ", data.dealNumber, docVersion !== null ? ` · v${docVersion}` : ""] })] })] }));
}
