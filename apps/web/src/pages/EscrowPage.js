import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { escrowApi } from "../services/phase2ApiService";
export default function EscrowPage() {
    const { projectId } = useParams();
    const [accounts, setAccounts] = useState([]);
    const [active, setActive] = useState(null);
    const [balance, setBalance] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [entry, setEntry] = useState({ direction: "CREDIT", reason: "CUSTOMER_PAYMENT" });
    const loadAccounts = async () => {
        if (!projectId)
            return;
        try {
            const data = await escrowApi.accountsForProject(projectId);
            setAccounts(data);
            if (data.length > 0 && !active)
                setActive(data[0].id);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    const loadAccount = async () => {
        if (!active)
            return;
        try {
            const [bal, led] = await Promise.all([escrowApi.balance(active), escrowApi.ledger(active)]);
            setBalance(bal);
            setLedger(led);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    useEffect(() => {
        void loadAccounts();
    }, [projectId]);
    useEffect(() => {
        void loadAccount();
    }, [active]);
    const post = async (e) => {
        e.preventDefault();
        if (!active)
            return;
        try {
            await escrowApi.postEntry(active, {
                direction: entry.direction,
                reason: entry.reason,
                amount: Number(entry.amount),
                externalRef: entry.externalRef ?? null,
                notes: entry.notes ?? null,
            });
            toast.success("Entry posted");
            setEntry({ direction: "CREDIT", reason: "CUSTOMER_PAYMENT" });
            await loadAccount();
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? err.message);
        }
    };
    if (!projectId)
        return _jsx("div", { className: "p-6", children: "Project ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Escrow Ledger" }), accounts.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No escrow accounts configured for this project." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex gap-2", children: accounts.map((a) => (_jsxs("button", { className: `text-sm px-3 py-1 rounded border ${active === a.id ? "bg-blue-600 text-white" : "bg-white"}`, onClick: () => setActive(a.id), children: [a.bankName, " \u00B7 ", a.accountNo] }, a.id))) }), balance && (_jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "border rounded p-4", children: [_jsx("div", { className: "text-xs uppercase text-gray-500", children: "Credits" }), _jsxs("div", { className: "text-2xl font-semibold", children: ["AED ", balance.credits.toLocaleString()] })] }), _jsxs("div", { className: "border rounded p-4", children: [_jsx("div", { className: "text-xs uppercase text-gray-500", children: "Debits" }), _jsxs("div", { className: "text-2xl font-semibold", children: ["AED ", balance.debits.toLocaleString()] })] }), _jsxs("div", { className: "border rounded p-4 bg-blue-50", children: [_jsx("div", { className: "text-xs uppercase text-gray-500", children: "Balance" }), _jsxs("div", { className: "text-2xl font-semibold", children: ["AED ", balance.balance.toLocaleString()] })] })] })), _jsxs("form", { className: "border rounded p-4 grid grid-cols-6 gap-2 bg-gray-50", onSubmit: post, children: [_jsxs("select", { className: "border rounded px-2 py-1 text-sm", value: entry.direction, onChange: (e) => setEntry({ ...entry, direction: e.target.value }), children: [_jsx("option", { value: "CREDIT", children: "CREDIT" }), _jsx("option", { value: "DEBIT", children: "DEBIT" })] }), _jsx("select", { className: "border rounded px-2 py-1 text-sm", value: entry.reason, onChange: (e) => setEntry({ ...entry, reason: e.target.value }), children: [
                                    "CUSTOMER_PAYMENT",
                                    "DEVELOPER_DRAWDOWN",
                                    "REFUND",
                                    "BANK_FEE",
                                    "TRANSFER",
                                    "OPENING_BALANCE",
                                    "ADJUSTMENT",
                                ].map((r) => (_jsx("option", { children: r }, r))) }), _jsx("input", { className: "border rounded px-2 py-1 text-sm", type: "number", placeholder: "Amount", value: entry.amount ?? "", onChange: (e) => setEntry({ ...entry, amount: e.target.value }) }), _jsx("input", { className: "border rounded px-2 py-1 text-sm", placeholder: "Bank ref", value: entry.externalRef ?? "", onChange: (e) => setEntry({ ...entry, externalRef: e.target.value }) }), _jsx("input", { className: "border rounded px-2 py-1 text-sm col-span-1", placeholder: "Notes", value: entry.notes ?? "", onChange: (e) => setEntry({ ...entry, notes: e.target.value }) }), _jsx("button", { className: "bg-blue-600 text-white text-sm rounded px-3 py-1", type: "submit", children: "Post" })] }), _jsx("h2", { className: "font-medium mt-4", children: "Ledger" }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-1", children: "Posted" }), _jsx("th", { children: "Direction" }), _jsx("th", { children: "Reason" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Ref" }), _jsx("th", { children: "Notes" }), _jsx("th", { children: "By" })] }) }), _jsx("tbody", { children: ledger.map((e) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-1", children: new Date(e.postedAt).toLocaleString() }), _jsx("td", { className: e.direction === "CREDIT" ? "text-green-700" : "text-red-700", children: e.direction }), _jsx("td", { children: e.reason }), _jsxs("td", { className: "text-right", children: [e.currency, " ", e.amount.toLocaleString()] }), _jsx("td", { children: e.externalRef ?? "—" }), _jsx("td", { className: "max-w-xs truncate", children: e.notes ?? "" }), _jsx("td", { children: e.postedBy })] }, e.id))) })] })] }))] }));
}
