import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import EmptyState from "./EmptyState";
const fmtM = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
export default function CommissionDashboard() {
    const [tab, setTab] = useState("PENDING_APPROVAL");
    const [pending, setPending] = useState([]);
    const [approved, setApproved] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [paid, setPaid] = useState([]);
    const [approvingId, setApprovingId] = useState(null);
    const [showPayModal, setShowPayModal] = useState(null);
    const [payForm, setPayForm] = useState({ paidAmount: "", paidVia: "BANK_TRANSFER", receiptKey: "" });
    const [payingId, setPayingId] = useState(null);
    const fetchData = () => {
        setLoading(true);
        Promise.all([
            axios.get("/api/commissions/pending"),
            axios.get("/api/commissions/stats"),
            axios.get("/api/commissions", { params: { status: "APPROVED", limit: 100 } }),
            axios.get("/api/commissions", { params: { status: "PAID", limit: 100 } }),
        ]).then(([pendingRes, statsRes, approvedRes, paidRes]) => {
            setPending(pendingRes.data);
            setStats(statsRes.data);
            setApproved(approvedRes.data.data || approvedRes.data);
            setPaid(paidRes.data.data || paidRes.data);
        }).catch(console.error).finally(() => setLoading(false));
    };
    useEffect(fetchData, []);
    const handleApprove = async (id) => {
        setApprovingId(id);
        try {
            await axios.patch(`/api/commissions/${id}/approve`, { approvedBy: "system" });
            toast.success("Commission approved");
            fetchData();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to approve");
        }
        finally {
            setApprovingId(null);
        }
    };
    const handleMarkPaid = async () => {
        if (!showPayModal)
            return;
        setPayingId(showPayModal.id);
        try {
            await axios.patch(`/api/commissions/${showPayModal.id}/paid`, {
                paidAmount: payForm.paidAmount || showPayModal.amount,
                paidVia: payForm.paidVia,
                receiptKey: payForm.receiptKey || null,
            });
            toast.success("Commission marked as paid");
            setShowPayModal(null);
            fetchData();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to mark as paid");
        }
        finally {
            setPayingId(null);
        }
    };
    const canApprove = (c) => c.spaSignedMet && c.oqoodMet;
    const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
    const kpis = [
        { label: "Pending Approval", key: "PENDING_APPROVAL", color: "text-amber-600", bg: "bg-amber-50" },
        { label: "Approved", key: "APPROVED", color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Paid", key: "PAID", color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Not Due", key: "NOT_DUE", color: "text-slate-500", bg: "bg-slate-50" },
    ];
    const tableRows = tab === "PENDING_APPROVAL" ? pending : tab === "APPROVED" ? approved : paid;
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Commissions" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Review, approve and pay broker commissions" })] }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3", children: kpis.map(({ label, key, color, bg }) => {
                    const s = stats[key];
                    return (_jsxs("div", { className: `${bg} rounded-xl p-4 border border-slate-200`, children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: label }), _jsx("p", { className: `text-2xl font-bold ${color}`, children: s?.count ?? 0 }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: ["AED ", fmtM(s?.total ?? 0)] })] }, key));
                }) }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsx("div", { className: "flex items-center justify-between px-5 py-3 border-b border-slate-100", children: _jsxs("div", { className: "flex items-center gap-1 bg-slate-100 rounded-lg p-1", children: [_jsxs("button", { onClick: () => setTab("PENDING_APPROVAL"), className: `px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === "PENDING_APPROVAL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: ["Pending Approval", _jsx("span", { className: `ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${tab === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}`, children: pending.length })] }), _jsxs("button", { onClick: () => setTab("APPROVED"), className: `px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === "APPROVED" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: ["Ready to Pay", _jsx("span", { className: `ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${tab === "APPROVED" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`, children: approved.length })] }), _jsxs("button", { onClick: () => setTab("PAID"), className: `px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === "PAID" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: ["Paid", _jsx("span", { className: `ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${tab === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`, children: paid.length })] })] }) }), loading ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("div", { className: "w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Deal", "Buyer", "Unit", "Broker", "Amount", "Rate", tab === "PAID" ? "Paid On" : "Conditions", "Action"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: tableRows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, children: _jsx(EmptyState, { icon: "\u25C7", title: tab === "PENDING_APPROVAL" ? "No commissions pending approval" : "No commissions awaiting payment", description: tab === "PENDING_APPROVAL"
                                                ? "Commissions appear here once SPA is signed and Oqood is registered."
                                                : "Once commissions are approved, they appear here for payment processing." }) }) })) : tableRows.map((c) => {
                                    const approvable = canApprove(c);
                                    return (_jsxs("tr", { className: "hover:bg-slate-50/80 transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-500", children: c.deal.dealNumber }), _jsxs("td", { className: "px-4 py-3 font-semibold text-slate-800", children: [c.deal.lead.firstName, " ", c.deal.lead.lastName] }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: c.deal.unit.unitNumber }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: c.brokerCompany?.name || "—" }), _jsxs("td", { className: "px-4 py-3", children: [_jsxs("p", { className: "font-semibold text-slate-800", children: ["AED ", c.amount.toLocaleString()] }), tab === "PAID" && c.paidAmount && c.paidAmount !== c.amount && (_jsxs("p", { className: "text-xs text-slate-400", children: ["Paid: AED ", c.paidAmount.toLocaleString()] }))] }), _jsxs("td", { className: "px-4 py-3 text-slate-600", children: [c.rate, "%"] }), _jsx("td", { className: "px-4 py-3", children: tab === "PAID" ? (_jsxs("div", { children: [c.paidDate && _jsx("p", { className: "text-xs font-semibold text-emerald-700", children: fmtDate(c.paidDate) }), c.paidVia && _jsx("p", { className: "text-xs text-slate-500", children: c.paidVia.replace(/_/g, " ") })] })) : (_jsxs("div", { className: "flex gap-1.5", children: [_jsxs("span", { className: `text-xs px-1.5 py-0.5 rounded font-medium ${c.spaSignedMet ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`, children: ["SPA ", c.spaSignedMet ? "✓" : "✗"] }), _jsxs("span", { className: `text-xs px-1.5 py-0.5 rounded font-medium ${c.oqoodMet ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`, children: ["Oqood ", c.oqoodMet ? "✓" : "✗"] })] })) }), _jsx("td", { className: "px-4 py-3", children: tab === "PENDING_APPROVAL" ? (_jsx("button", { onClick: () => handleApprove(c.id), disabled: !approvable || approvingId === c.id, className: `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${approvable
                                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                                        : "bg-slate-100 text-slate-400 cursor-not-allowed"}`, children: approvingId === c.id ? "…" : approvable ? "Approve" : "Blocked" })) : tab === "APPROVED" ? (_jsx("button", { onClick: () => { setShowPayModal(c); setPayForm({ paidAmount: String(c.amount), paidVia: "BANK_TRANSFER", receiptKey: "" }); }, disabled: payingId === c.id, className: "px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50", children: payingId === c.id ? "…" : "Mark Paid" })) : (_jsx("span", { className: "text-xs text-emerald-600 font-semibold", children: "\u2713 Paid" })) })] }, c.id));
                                }) })] }))] }), showPayModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-100", children: [_jsx("h3", { className: "font-bold text-slate-900", children: "Mark Commission as Paid" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [showPayModal.deal.dealNumber, " \u00B7 ", showPayModal.brokerCompany?.name] })] }), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Amount Paid (AED)" }), _jsx("input", { type: "number", value: payForm.paidAmount, onChange: (e) => setPayForm((f) => ({ ...f, paidAmount: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-emerald-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Payment Method" }), _jsx("select", { value: payForm.paidVia, onChange: (e) => setPayForm((f) => ({ ...f, paidVia: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-emerald-400", children: ["BANK_TRANSFER", "CHEQUE", "CASH"].map((m) => (_jsx("option", { value: m, children: m.replace(/_/g, " ") }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Receipt / Reference (optional)" }), _jsx("input", { type: "text", value: payForm.receiptKey, onChange: (e) => setPayForm((f) => ({ ...f, receiptKey: e.target.value })), placeholder: "e.g. CHQ-2026-001", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-emerald-400" })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setShowPayModal(null), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: handleMarkPaid, disabled: payingId !== null, className: "flex-1 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50", children: payingId ? "Saving…" : "Confirm Paid" })] })] }) }))] }));
}
