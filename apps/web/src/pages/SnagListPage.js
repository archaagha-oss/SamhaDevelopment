import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { snagsApi } from "../services/phase2ApiService";
const SEVERITY_COLORS = {
    COSMETIC: "bg-gray-200 text-gray-800",
    MINOR: "bg-blue-100 text-blue-800",
    MAJOR: "bg-amber-100 text-amber-800",
    CRITICAL: "bg-red-100 text-red-800",
};
const STATUS_OPTIONS = ["RAISED", "ACKNOWLEDGED", "IN_PROGRESS", "FIXED", "REJECTED", "CLOSED"];
export default function SnagListPage() {
    const { unitId } = useParams();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState({});
    const load = async () => {
        if (!unitId)
            return;
        setLoading(true);
        try {
            const data = await snagsApi.listForUnit(unitId);
            setLists(data);
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
    }, [unitId]);
    const ensureList = async () => {
        if (!unitId)
            return;
        if (lists.length > 0)
            return lists[0].id;
        try {
            const list = await snagsApi.createList(unitId, "Walk-through");
            await load();
            return list.id;
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    const addItem = async (listId) => {
        if (!newItem.description) {
            toast.error("Description required");
            return;
        }
        try {
            await snagsApi.addItem(listId, {
                room: newItem.room,
                category: newItem.category,
                description: newItem.description,
                severity: newItem.severity ?? "MINOR",
                contractorName: newItem.contractorName,
                dueDate: newItem.dueDate,
            });
            toast.success("Snag added");
            setNewItem({});
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    const setStatus = async (item, status) => {
        try {
            await snagsApi.setStatus(item.id, status);
            toast.success(`Status updated`);
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    if (!unitId)
        return _jsx("div", { className: "p-6", children: "Unit ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Snag Lists" }), _jsx("button", { className: "bg-blue-600 text-white px-3 py-1 rounded text-sm", onClick: ensureList, children: "+ New List" })] }), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading\u2026" })) : lists.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No snag lists for this unit yet." })) : (lists.map((list) => (_jsxs("section", { className: "border rounded p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "font-medium", children: [list.label, " ", _jsxs("span", { className: "text-xs text-gray-500", children: ["\u00B7 raised ", new Date(list.raisedAt).toLocaleDateString()] })] }), list.closedAt && (_jsxs("span", { className: "text-xs text-green-700", children: ["Closed ", new Date(list.closedAt).toLocaleDateString()] }))] }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-1", children: "Room" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Description" }), _jsx("th", { children: "Severity" }), _jsx("th", { children: "Contractor" }), _jsx("th", { children: "Due" }), _jsx("th", { children: "Status" })] }) }), _jsxs("tbody", { children: [list.items.map((it) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-1", children: it.room ?? "—" }), _jsx("td", { children: it.category ?? "—" }), _jsx("td", { children: it.description }), _jsx("td", { children: _jsx("span", { className: `px-2 py-0.5 rounded text-xs ${SEVERITY_COLORS[it.severity]}`, children: it.severity }) }), _jsx("td", { children: it.contractorName ?? "—" }), _jsx("td", { children: it.dueDate ? new Date(it.dueDate).toLocaleDateString() : "—" }), _jsx("td", { children: _jsx("select", { className: "border rounded px-1 py-0.5 text-xs", value: it.status, onChange: (e) => setStatus(it, e.target.value), children: STATUS_OPTIONS.map((s) => (_jsx("option", { value: s, children: s }, s))) }) })] }, it.id))), _jsxs("tr", { children: [_jsx("td", { className: "py-2", children: _jsx("input", { className: "border rounded px-1 py-0.5 text-xs w-full", placeholder: "Room", value: newItem.room ?? "", onChange: (e) => setNewItem({ ...newItem, room: e.target.value }) }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 text-xs w-full", placeholder: "Category", value: newItem.category ?? "", onChange: (e) => setNewItem({ ...newItem, category: e.target.value }) }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 text-xs w-full", placeholder: "Description", value: newItem.description ?? "", onChange: (e) => setNewItem({ ...newItem, description: e.target.value }) }) }), _jsx("td", { children: _jsx("select", { className: "border rounded px-1 py-0.5 text-xs", value: newItem.severity ?? "MINOR", onChange: (e) => setNewItem({ ...newItem, severity: e.target.value }), children: Object.keys(SEVERITY_COLORS).map((s) => _jsx("option", { value: s, children: s }, s)) }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 text-xs w-full", placeholder: "Contractor", value: newItem.contractorName ?? "", onChange: (e) => setNewItem({ ...newItem, contractorName: e.target.value }) }) }), _jsx("td", { children: _jsx("input", { className: "border rounded px-1 py-0.5 text-xs w-full", type: "date", value: newItem.dueDate ?? "", onChange: (e) => setNewItem({ ...newItem, dueDate: e.target.value }) }) }), _jsx("td", { children: _jsx("button", { className: "bg-blue-600 text-white text-xs px-2 py-1 rounded", onClick: () => addItem(list.id), children: "+ Add" }) })] })] })] })] }, list.id))))] }));
}
