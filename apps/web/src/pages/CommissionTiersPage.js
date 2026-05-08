import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { commissionTiersApi } from "../services/phase2ApiService";
export default function CommissionTiersPage() {
    const [rules, setRules] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [draftTiers, setDraftTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        setLoading(true);
        try {
            const data = await commissionTiersApi.list();
            setRules(data);
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
    const startEdit = (rule) => {
        setEditingId(rule.id);
        setDraftTiers(rule.tiers.map((t) => ({ ...t })));
    };
    const updateTier = (idx, key, value) => {
        const next = [...draftTiers];
        next[idx][key] = value === "" ? null : Number(value);
        setDraftTiers(next);
    };
    const addTier = () => {
        setDraftTiers([
            ...draftTiers,
            {
                minSalePrice: 0,
                maxSalePrice: null,
                ratePercent: 3,
                flatBonus: 0,
                sortOrder: draftTiers.length,
            },
        ]);
    };
    const save = async () => {
        if (!editingId)
            return;
        try {
            await commissionTiersApi.update(editingId, { tiers: draftTiers });
            toast.success("Tiers updated");
            setEditingId(null);
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Tiered Commission Rules" }), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading\u2026" })) : rules.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No tiered commission rules configured." })) : (rules.map((rule) => (_jsxs("section", { className: "border rounded p-4 space-y-3", children: [_jsxs("header", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-medium", children: rule.name }), _jsxs("p", { className: "text-xs text-gray-500", children: [rule.projectId ? "Project-scoped" : "Global", " \u00B7 priority ", rule.priority, " \u00B7 ", rule.isActive ? "active" : "inactive"] })] }), editingId !== rule.id ? (_jsx("button", { className: "text-sm text-blue-600 hover:underline", onClick: () => startEdit(rule), children: "Edit Tiers" })) : (_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "text-sm text-gray-500 hover:underline", onClick: () => setEditingId(null), children: "Cancel" }), _jsx("button", { className: "bg-blue-600 text-white text-sm px-3 py-1 rounded", onClick: save, children: "Save" })] }))] }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-1", children: "Min Sale" }), _jsx("th", { children: "Max Sale" }), _jsx("th", { children: "Rate %" }), _jsx("th", { children: "Flat Bonus" })] }) }), _jsx("tbody", { children: (editingId === rule.id ? draftTiers : rule.tiers).map((t, idx) => (_jsx("tr", { className: "border-b", children: editingId === rule.id ? (_jsxs(_Fragment, { children: [_jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 w-28", type: "number", value: t.minSalePrice ?? "", onChange: (e) => updateTier(idx, "minSalePrice", e.target.value) }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 w-28", type: "number", value: t.maxSalePrice ?? "", onChange: (e) => updateTier(idx, "maxSalePrice", e.target.value), placeholder: "\u221E" }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 w-20", type: "number", step: "0.1", value: t.ratePercent, onChange: (e) => updateTier(idx, "ratePercent", e.target.value) }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 w-24", type: "number", value: t.flatBonus, onChange: (e) => updateTier(idx, "flatBonus", e.target.value) }) })] })) : (_jsxs(_Fragment, { children: [_jsx("td", { className: "py-1", children: t.minSalePrice?.toLocaleString() ?? "0" }), _jsx("td", { children: t.maxSalePrice?.toLocaleString() ?? "∞" }), _jsxs("td", { children: [t.ratePercent, "%"] }), _jsx("td", { children: t.flatBonus.toLocaleString() })] })) }, t.id ?? `new-${idx}`))) })] }), editingId === rule.id && (_jsx("button", { className: "text-xs text-blue-600 hover:underline", onClick: addTier, children: "+ Add tier" }))] }, rule.id))))] }));
}
