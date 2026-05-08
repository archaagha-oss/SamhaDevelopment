import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { refundsApi } from "../services/phase2ApiService";
const STATUS_COLORS = {
    REQUESTED: "bg-amber-100 text-amber-800",
    APPROVED: "bg-blue-100 text-blue-800",
    PROCESSED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-200 text-gray-800",
};
export default function RefundsPage() {
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        setLoading(true);
        try {
            const data = await refundsApi.listOpen();
            setRefunds(data);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, []);
    const action = async (id, newStatus) => {
        try {
            let extras = {};
            if (newStatus === "REJECTED") {
                const reason = prompt("Rejection reason:");
                if (!reason)
                    return;
                extras.rejectedReason = reason;
            }
            if (newStatus === "PROCESSED") {
                const ref = prompt("Bank / payment reference:");
                if (!ref)
                    return;
                extras.processedReference = ref;
            }
            await refundsApi.transition(id, { newStatus, ...extras });
            toast.success(`Refund ${newStatus}`);
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Refund Requests" }), _jsx("p", { className: "text-sm text-gray-500", children: "Open and approved refunds awaiting action. Processed / cancelled refunds drop off this list." }), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading\u2026" })) : refunds.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No open refund requests." })) : (_jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-2", children: "Deal" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Reason" }), _jsx("th", { children: "Requested by" }), _jsx("th", { children: "When" }), _jsx("th", { children: "Status" }), _jsx("th", {})] }) }), _jsx("tbody", { children: refunds.map((r) => (_jsxs("tr", { className: "border-b", children: [_jsxs("td", { className: "py-2 font-mono text-xs", children: [r.dealId.slice(0, 10), "\u2026"] }), _jsxs("td", { children: [r.currency, " ", r.amount.toLocaleString()] }), _jsx("td", { className: "max-w-xs truncate", children: r.reason }), _jsx("td", { children: r.requestedBy }), _jsx("td", { children: new Date(r.requestedAt).toLocaleDateString() }), _jsx("td", { children: _jsx("span", { className: `px-2 py-0.5 rounded text-xs ${STATUS_COLORS[r.status]}`, children: r.status }) }), _jsxs("td", { className: "space-x-2", children: [r.status === "REQUESTED" && (_jsxs(_Fragment, { children: [_jsx("button", { className: "text-blue-600 text-xs hover:underline", onClick: () => action(r.id, "APPROVED"), children: "Approve" }), _jsx("button", { className: "text-red-600 text-xs hover:underline", onClick: () => action(r.id, "REJECTED"), children: "Reject" })] })), r.status === "APPROVED" && (_jsx("button", { className: "text-green-600 text-xs hover:underline", onClick: () => action(r.id, "PROCESSED"), children: "Mark Processed" }))] })] }, r.id))) })] }))] }));
}
