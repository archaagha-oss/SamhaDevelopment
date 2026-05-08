import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import axios from "axios";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-0.5";
const hint = "text-xs text-slate-400 mt-0.5";
const BLANK_ESCROW = {
    id: "",
    purpose: "ESCROW",
    accountName: "",
    bankName: "",
    branchAddress: "",
    iban: "",
    accountNumber: "",
    refPrefix: "",
};
const BLANK_CURRENT = { ...BLANK_ESCROW, purpose: "CURRENT", refPrefix: null };
// Editor for SPA Particulars Items IX (Escrow) and X (Current Account).
// One ESCROW + one CURRENT account per project; refPrefix on the escrow row
// builds the per-unit "Reference: Unit no" (e.g. "SR2-STD-" + "207").
export default function ProjectBankAccountsModal({ projectId, onClose }) {
    const [escrow, setEscrow] = useState(BLANK_ESCROW);
    const [current, setCurrent] = useState(BLANK_CURRENT);
    const [loading, setLoading] = useState(true);
    const [savingPurpose, setSavingPurpose] = useState(null);
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        axios
            .get(`/api/projects/${projectId}/bank-accounts`)
            .then((r) => {
            const e = r.data.find((a) => a.purpose === "ESCROW");
            const c = r.data.find((a) => a.purpose === "CURRENT");
            if (e)
                setEscrow({ ...e, branchAddress: e.branchAddress ?? "", refPrefix: e.refPrefix ?? "" });
            if (c)
                setCurrent({ ...c, branchAddress: c.branchAddress ?? "" });
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [projectId]);
    const save = async (account) => {
        setError(null);
        setSaved(null);
        setSavingPurpose(account.purpose);
        try {
            const payload = {
                purpose: account.purpose,
                accountName: account.accountName,
                bankName: account.bankName,
                branchAddress: account.branchAddress || null,
                iban: account.iban,
                accountNumber: account.accountNumber,
                refPrefix: account.purpose === "ESCROW" ? (account.refPrefix || null) : null,
            };
            await axios.put(`/api/projects/${projectId}/bank-accounts`, payload);
            setSaved(account.purpose);
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save bank account");
        }
        finally {
            setSavingPurpose(null);
        }
    };
    const renderEditor = (account, setter, title, showRefPrefix) => (_jsxs("div", { className: "border border-slate-200 rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold text-slate-800 text-sm", children: title }), saved === account.purpose && (_jsx("span", { className: "text-xs text-emerald-600 font-medium", children: "Saved" }))] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Account Name *" }), _jsx("input", { required: true, value: account.accountName, onChange: (e) => setter({ ...account, accountName: e.target.value }), placeholder: account.purpose === "ESCROW" ? "e.g. SAMHA RESIDENCE 2" : "e.g. SAMHA REAL ESTATE DEVELOPMENT LLC", className: inp })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Bank Name *" }), _jsx("input", { required: true, value: account.bankName, onChange: (e) => setter({ ...account, bankName: e.target.value }), placeholder: "e.g. Sharjah Islamic Bank", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Branch Address" }), _jsx("input", { value: account.branchAddress ?? "", onChange: (e) => setter({ ...account, branchAddress: e.target.value }), placeholder: "e.g. SHARJAH-Main Branch", className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "IBAN *" }), _jsx("input", { required: true, value: account.iban, onChange: (e) => setter({ ...account, iban: e.target.value }), placeholder: "AE\u2026", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Account Number *" }), _jsx("input", { required: true, value: account.accountNumber, onChange: (e) => setter({ ...account, accountNumber: e.target.value }), className: inp })] })] }), showRefPrefix && (_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Per-Unit Reference Prefix" }), _jsx("input", { value: account.refPrefix ?? "", onChange: (e) => setter({ ...account, refPrefix: e.target.value }), placeholder: "e.g. SR2-STD-", className: inp }), _jsx("p", { className: hint, children: "Combined with the unit number to build the SPA \"Reference: Unit no\" line (e.g. SR2-STD-207)." })] })), _jsx("div", { className: "pt-1", children: _jsx("button", { onClick: () => save(account), disabled: savingPurpose === account.purpose, className: "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50", children: savingPurpose === account.purpose ? "Saving…" : `Save ${title}` }) })] }));
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Project Bank Accounts" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Used by SPA Particulars Items IX (Escrow) and X (Current Account)" })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "px-6 py-5 space-y-5", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : (_jsxs(_Fragment, { children: [renderEditor(escrow, setEscrow, "Escrow Account", true), renderEditor(current, setCurrent, "Current Account", false), error && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: error })), _jsx("div", { className: "pt-1 flex justify-end", children: _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Close" }) })] })) })] }) }));
}
