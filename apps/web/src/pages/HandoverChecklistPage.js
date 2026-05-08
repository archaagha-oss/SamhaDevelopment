import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { handoverApi } from "../services/phase2ApiService";
const STATUS_BADGES = {
    PENDING: "bg-amber-100 text-amber-800",
    COMPLETED: "bg-green-100 text-green-800",
    WAIVED: "bg-gray-200 text-gray-800",
    NOT_APPLICABLE: "bg-gray-100 text-gray-600",
};
export default function HandoverChecklistPage() {
    const { dealId } = useParams();
    const [checklist, setChecklist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState("");
    const load = async () => {
        if (!dealId)
            return;
        setLoading(true);
        try {
            try {
                const c = await handoverApi.byDeal(dealId);
                setChecklist(c);
            }
            catch (err) {
                if (err.response?.status === 404)
                    setChecklist(null);
                else
                    throw err;
            }
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
    }, [dealId]);
    const ensure = async () => {
        if (!dealId)
            return;
        try {
            await handoverApi.ensure(dealId);
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    const toggle = async (item, status) => {
        try {
            await handoverApi.setItem(item.id, { status });
            toast.success("Item updated");
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    const finish = async () => {
        if (!checklist)
            return;
        if (!customerName) {
            toast.error("Customer name required for sign-off");
            return;
        }
        try {
            await handoverApi.complete(checklist.id, { customerName });
            toast.success("Checklist completed");
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    if (!dealId)
        return _jsx("div", { className: "p-6", children: "Deal ID required." });
    if (loading)
        return _jsx("div", { className: "p-6 text-gray-500", children: "Loading\u2026" });
    if (!checklist) {
        return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Handover Checklist" }), _jsx("p", { className: "text-gray-500", children: "No checklist exists for this deal." }), _jsx("button", { className: "bg-blue-600 text-white px-4 py-2 rounded text-sm", onClick: ensure, children: "+ Create Checklist" })] }));
    }
    const ready = checklist.items.filter((i) => i.required).every((i) => i.status !== "PENDING");
    return (_jsxs("div", { className: "p-6 space-y-4 max-w-4xl", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Handover Checklist" }), _jsxs("p", { className: "text-sm text-gray-500", children: ["Started ", new Date(checklist.startedAt).toLocaleDateString(), ".", checklist.completedAt && ` Completed ${new Date(checklist.completedAt).toLocaleDateString()}.`] }), _jsx("div", { className: "border rounded divide-y", children: checklist.items.map((it) => (_jsxs("div", { className: "px-4 py-3 flex items-center gap-3", children: [_jsx("span", { className: `px-2 py-0.5 rounded text-xs ${STATUS_BADGES[it.status]}`, children: it.status }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "font-medium", children: [it.label, it.required && _jsx("span", { className: "text-red-500 ml-1", children: "*" })] }), it.completedAt && (_jsxs("div", { className: "text-xs text-gray-500", children: ["Done ", new Date(it.completedAt).toLocaleDateString(), " by ", it.completedBy ?? "—"] }))] }), _jsxs("div", { className: "flex gap-2", children: [it.status !== "COMPLETED" && (_jsx("button", { className: "text-green-700 text-xs hover:underline", onClick: () => toggle(it, "COMPLETED"), children: "Mark Done" })), it.status === "COMPLETED" && (_jsx("button", { className: "text-gray-500 text-xs hover:underline", onClick: () => toggle(it, "PENDING"), children: "Reopen" })), !it.required && it.status === "PENDING" && (_jsxs(_Fragment, { children: [_jsx("button", { className: "text-gray-700 text-xs hover:underline", onClick: () => toggle(it, "WAIVED"), children: "Waive" }), _jsx("button", { className: "text-gray-700 text-xs hover:underline", onClick: () => toggle(it, "NOT_APPLICABLE"), children: "N/A" })] }))] })] }, it.id))) }), !checklist.completedAt && (_jsxs("div", { className: "border rounded p-4 bg-gray-50 space-y-2", children: [_jsx("h2", { className: "font-medium", children: "Customer Sign-off" }), _jsxs("p", { className: "text-xs text-gray-600", children: ["All required items ", ready ? "have been completed" : "must be completed", " before customer sign-off."] }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "border rounded px-2 py-1 text-sm flex-1", placeholder: "Customer name (printed)", value: customerName, onChange: (e) => setCustomerName(e.target.value) }), _jsx("button", { disabled: !ready, className: "bg-green-600 disabled:bg-gray-300 text-white px-4 py-1 rounded text-sm", onClick: finish, children: "Sign Off & Complete" })] })] }))] }));
}
