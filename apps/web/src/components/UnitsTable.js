import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { getStatusColor } from "../utils/statusColors";
import { formatAreaShort } from "../utils/formatArea";
import UnitModal from "./UnitModal";
import UnitFormModal from "./UnitFormModal";
import BulkUnitModal from "./BulkUnitModal";
import HoverPreview from "./HoverPreview";
const COLUMN_LABELS = {
    plan: "Plan",
    project: "Project",
    unitNumber: "Unit No.",
    floor: "Floor",
    type: "Type",
    area: "Area",
    view: "View",
    price: "Price",
    status: "Status",
    agent: "Agent",
};
const ALWAYS_VISIBLE = ["unitNumber", "price", "status"];
const DEFAULT_HIDDEN = []; // all visible by default
const COLUMN_PREF_KEY = "samha.unitsTable.hiddenColumns";
const STATUS_LABELS = {
    NOT_RELEASED: "Not Released",
    AVAILABLE: "Available",
    ON_HOLD: "On Hold",
    RESERVED: "Reserved",
    BOOKED: "Booked",
    SOLD: "Sold",
    BLOCKED: "Blocked",
    HANDED_OVER: "Handed Over",
};
const ALL_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const SortIcon = ({ active, asc }) => (_jsx("span", { className: `ml-1 text-xs ${active ? "text-blue-600" : "text-slate-300"}`, children: active ? (asc ? "↑" : "↓") : "⇅" }));
export default function UnitsTable({ projectId }) {
    const navigate = useNavigate();
    const isGlobal = !projectId;
    // Data
    const [units, setUnits] = useState([]);
    const [projects, setProjects] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    // Filters
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [filterType, setFilterType] = useState("ALL");
    const [filterProject, setFilterProject] = useState("ALL");
    const [filterAgent, setFilterAgent] = useState("ALL");
    const [filterPriceMin, setFilterPriceMin] = useState("");
    const [filterPriceMax, setFilterPriceMax] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    // Sort
    const [sortKey, setSortKey] = useState(isGlobal ? "project" : "unitNumber");
    const [sortAsc, setSortAsc] = useState(true);
    // Inline price edit
    const [editingPriceId, setEditingPriceId] = useState(null);
    const [editingPrice, setEditingPrice] = useState("");
    const [savingPrice, setSavingPrice] = useState(false);
    // Selection + bulk ops
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkOp, setBulkOp] = useState(null);
    const [bulkReason, setBulkReason] = useState("");
    const [bulkPriceValue, setBulkPriceValue] = useState("");
    const [bulkPriceType, setBulkPriceType] = useState("PERCENT");
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    // Modals
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [editingUnit, setEditingUnit] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    // Column visibility (persisted in localStorage)
    const [hiddenColumns, setHiddenColumns] = useState(() => {
        if (typeof window === "undefined")
            return new Set(DEFAULT_HIDDEN);
        try {
            const raw = window.localStorage.getItem(COLUMN_PREF_KEY);
            if (!raw)
                return new Set(DEFAULT_HIDDEN);
            const arr = JSON.parse(raw);
            if (Array.isArray(arr))
                return new Set(arr.filter((k) => !ALWAYS_VISIBLE.includes(k)));
        }
        catch { /* ignore */ }
        return new Set(DEFAULT_HIDDEN);
    });
    useEffect(() => {
        try {
            window.localStorage.setItem(COLUMN_PREF_KEY, JSON.stringify(Array.from(hiddenColumns)));
        }
        catch { /* ignore */ }
    }, [hiddenColumns]);
    const isVisible = (k) => !hiddenColumns.has(k);
    const toggleColumn = (k) => {
        if (ALWAYS_VISIBLE.includes(k))
            return;
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            if (next.has(k))
                next.delete(k);
            else
                next.add(k);
            return next;
        });
    };
    const [columnMenuOpen, setColumnMenuOpen] = useState(false);
    const columnMenuRef = useRef(null);
    useEffect(() => {
        if (!columnMenuOpen)
            return;
        const onClick = (e) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(e.target))
                setColumnMenuOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [columnMenuOpen]);
    const load = useCallback(() => {
        setLoading(true);
        const params = projectId ? { projectId, limit: 1000 } : { limit: 2000 };
        const requests = [
            axios.get("/api/units", { params }),
            axios.get("/api/users"),
        ];
        if (isGlobal)
            requests.push(axios.get("/api/projects"));
        Promise.all(requests)
            .then(([unitsRes, usersRes, projectsRes]) => {
            setUnits(unitsRes.data.data || unitsRes.data || []);
            setAgents((usersRes.data || []).filter((u) => u.role === "SALES_AGENT" || u.role === "OPERATIONS"));
            if (projectsRes)
                setProjects(projectsRes.data.data || projectsRes.data || []);
        })
            .finally(() => setLoading(false));
    }, [projectId, isGlobal]);
    useEffect(() => { load(); }, [load]);
    const projectMap = useMemo(() => {
        const m = {};
        projects.forEach((p) => (m[p.id] = p.name));
        return m;
    }, [projects]);
    const agentMap = useMemo(() => {
        const m = {};
        agents.forEach((a) => (m[a.id] = a.name));
        return m;
    }, [agents]);
    // Status summary counts (over all units, before filters)
    const byStatus = useMemo(() => {
        const counts = {};
        units.forEach((u) => { counts[u.status] = (counts[u.status] || 0) + 1; });
        return counts;
    }, [units]);
    const filtered = useMemo(() => {
        return units.filter((u) => {
            if (search && !u.unitNumber.toLowerCase().includes(search.toLowerCase()))
                return false;
            if (filterStatus !== "ALL" && u.status !== filterStatus)
                return false;
            if (filterType !== "ALL" && u.type !== filterType)
                return false;
            if (isGlobal && filterProject !== "ALL" && u.projectId !== filterProject)
                return false;
            if (filterAgent !== "ALL") {
                if (filterAgent === "" && u.assignedAgentId)
                    return false;
                if (filterAgent !== "" && u.assignedAgentId !== filterAgent)
                    return false;
            }
            if (filterPriceMin && u.price < parseInt(filterPriceMin))
                return false;
            if (filterPriceMax && u.price > parseInt(filterPriceMax))
                return false;
            return true;
        });
    }, [units, search, filterStatus, filterType, filterProject, filterAgent, filterPriceMin, filterPriceMax, isGlobal]);
    const sorted = useMemo(() => {
        const copy = [...filtered];
        copy.sort((a, b) => {
            let av = "";
            let bv = "";
            switch (sortKey) {
                case "project":
                    av = projectMap[a.projectId] || "";
                    bv = projectMap[b.projectId] || "";
                    break;
                case "unitNumber":
                    av = a.unitNumber;
                    bv = b.unitNumber;
                    break;
                case "floor":
                    av = a.floor;
                    bv = b.floor;
                    break;
                case "type":
                    av = a.type;
                    bv = b.type;
                    break;
                case "area":
                    av = a.area;
                    bv = b.area;
                    break;
                case "view":
                    av = a.view;
                    bv = b.view;
                    break;
                case "price":
                    av = a.price;
                    bv = b.price;
                    break;
                case "status":
                    av = a.status;
                    bv = b.status;
                    break;
            }
            if (typeof av === "string") {
                av = av.toLowerCase();
                bv = bv.toLowerCase();
            }
            if (av < bv)
                return sortAsc ? -1 : 1;
            if (av > bv)
                return sortAsc ? 1 : -1;
            return 0;
        });
        return copy;
    }, [filtered, sortKey, sortAsc, projectMap]);
    const toggleSort = (key) => {
        if (sortKey === key)
            setSortAsc(!sortAsc);
        else {
            setSortKey(key);
            setSortAsc(true);
        }
    };
    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.size === filtered.length
            ? new Set()
            : new Set(filtered.map((u) => u.id)));
    };
    const exitSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
        setBulkOp(null);
        setBulkReason("");
        setBulkPriceValue("");
        setBulkResult(null);
    };
    const runBulkOp = async () => {
        if (!bulkOp || selectedIds.size === 0)
            return;
        setBulkSubmitting(true);
        setBulkResult(null);
        try {
            const body = { unitIds: Array.from(selectedIds), operation: bulkOp };
            if (bulkReason)
                body.reason = bulkReason;
            if (bulkOp === "PRICE_UPDATE" && bulkPriceValue) {
                body.value = (bulkPriceType === "PERCENT" || bulkPriceType === "FIXED_DELTA")
                    ? { type: bulkPriceType, amount: parseFloat(bulkPriceValue) }
                    : parseFloat(bulkPriceValue);
            }
            const r = await axios.post("/api/units/bulk-ops", body);
            setBulkResult({ succeeded: r.data.succeeded, failed: r.data.failed });
            load();
            setSelectedIds(new Set());
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Bulk operation failed");
        }
        finally {
            setBulkSubmitting(false);
        }
    };
    const savePrice = async (unitId, newPrice) => {
        setSavingPrice(true);
        try {
            await axios.patch(`/api/units/${unitId}`, { price: newPrice });
            setUnits((prev) => prev.map((u) => u.id === unitId ? { ...u, price: newPrice } : u));
            setEditingPriceId(null);
        }
        catch {
            // keep editing open on failure
        }
        finally {
            setSavingPrice(false);
        }
    };
    const clearFilters = () => {
        setSearch("");
        setFilterStatus("ALL");
        setFilterType("ALL");
        setFilterProject("ALL");
        setFilterAgent("ALL");
        setFilterPriceMin("");
        setFilterPriceMax("");
    };
    const hasFilters = search || filterStatus !== "ALL" || filterType !== "ALL" ||
        filterProject !== "ALL" || filterAgent !== "ALL" || filterPriceMin || filterPriceMax;
    const Th = ({ label, sk, align = "left" }) => (_jsx("th", { className: `px-4 py-2.5 text-${align}`, children: _jsxs("button", { onClick: () => toggleSort(sk), className: `text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-0.5 ${align === "right" ? "ml-auto" : ""}`, children: [label, _jsx(SortIcon, { active: sortKey === sk, asc: sortAsc })] }) }));
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx("div", { className: "flex items-center gap-2 px-6 py-3 bg-white border-b border-slate-100 flex-shrink-0 flex-wrap", children: !selectionMode ? (_jsxs(_Fragment, { children: [!isGlobal && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setShowCreateModal(true), className: "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5", children: "+ Add Unit" }), _jsx("button", { onClick: () => setShowBulkModal(true), className: "px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors", children: "\u229E Add Floor" })] })), _jsx("button", { onClick: () => setSelectionMode(true), className: "px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors", children: "\u2611 Select" }), _jsxs("div", { className: "relative", ref: columnMenuRef, children: [_jsxs("button", { onClick: () => setColumnMenuOpen((v) => !v), className: "px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors", title: "Show / hide columns", "aria-haspopup": "menu", "aria-expanded": columnMenuOpen, children: ["\u22EF Columns", hiddenColumns.size > 0 ? ` (${hiddenColumns.size} hidden)` : ""] }), columnMenuOpen && (_jsxs("div", { className: "absolute left-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg py-2 w-48", role: "menu", children: [Object.keys(COLUMN_LABELS)
                                            .filter((k) => k !== "project" || isGlobal) // Project column only in global mode
                                            .map((k) => {
                                            const locked = ALWAYS_VISIBLE.includes(k);
                                            return (_jsxs("label", { className: `flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer ${locked ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50"}`, children: [_jsx("input", { type: "checkbox", checked: isVisible(k), disabled: locked, onChange: () => toggleColumn(k), className: "rounded" }), COLUMN_LABELS[k], locked && _jsx("span", { className: "ml-auto text-[10px] text-slate-400", children: "always" })] }, k));
                                        }), hiddenColumns.size > 0 && (_jsx("button", { type: "button", onClick: () => setHiddenColumns(new Set()), className: "w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 border-t border-slate-100 mt-1", children: "Show all columns" }))] }))] }), _jsx("div", { className: "h-5 w-px bg-slate-200 mx-1" }), _jsx("input", { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search unit no\u2026", className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 w-36" }), isGlobal && (_jsxs("select", { value: filterProject, onChange: (e) => setFilterProject(e.target.value), className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "ALL", children: "All Projects" }), projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "ALL", children: "All Statuses" }), Object.entries(STATUS_LABELS).map(([k, v]) => _jsx("option", { value: k, children: v }, k))] }), _jsxs("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "ALL", children: "All Types" }), ALL_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t))] }), _jsx("button", { onClick: () => setShowAdvanced(!showAdvanced), className: "px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors", children: showAdvanced ? "Less ▲" : "More ▼" }), hasFilters && (_jsx("button", { onClick: clearFilters, className: "text-xs text-red-500 hover:text-red-700 font-medium", children: "Clear \u00D7" })), _jsxs("span", { className: "ml-auto text-xs text-slate-400", children: [filtered.length.toLocaleString(), " / ", units.length.toLocaleString(), " units"] })] })) : (
                /* Selection mode bar */
                _jsxs(_Fragment, { children: [_jsx("button", { onClick: exitSelection, className: "px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200", children: "\u2715 Cancel" }), _jsxs("span", { className: "text-sm text-slate-600 font-medium", children: [selectedIds.size, " selected"] }), _jsx("div", { className: "h-5 w-px bg-slate-200 mx-1" }), ["RELEASE", "BLOCK", "UNBLOCK", "PRICE_UPDATE"].map((op) => {
                            const styles = {
                                RELEASE: bulkOp === op ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                                BLOCK: bulkOp === op ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                                UNBLOCK: bulkOp === op ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                                PRICE_UPDATE: bulkOp === op ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100",
                            };
                            const labels = { RELEASE: "↑ Release", BLOCK: "⊘ Block", UNBLOCK: "✓ Unblock", PRICE_UPDATE: "$ Price" };
                            return (_jsx("button", { onClick: () => setBulkOp(op), className: `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${styles[op]}`, children: labels[op] }, op));
                        }), _jsxs("span", { className: "ml-auto text-xs text-slate-400", children: [filtered.length, " shown"] })] })) }), showAdvanced && !selectionMode && (_jsxs("div", { className: "px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 flex-shrink-0", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Agent" }), _jsxs("select", { value: filterAgent, onChange: (e) => setFilterAgent(e.target.value), className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "ALL", children: "All agents" }), _jsx("option", { value: "", children: "Unassigned" }), agents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Min Price (AED)" }), _jsx("input", { type: "number", value: filterPriceMin, onChange: (e) => setFilterPriceMin(e.target.value), placeholder: "0", className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm w-32 bg-white focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Max Price (AED)" }), _jsx("input", { type: "number", value: filterPriceMax, onChange: (e) => setFilterPriceMax(e.target.value), placeholder: "\u221E", className: "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm w-32 bg-white focus:outline-none focus:border-blue-400" })] })] })), selectionMode && bulkOp && (_jsxs("div", { className: "px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3 flex-wrap flex-shrink-0", children: [_jsx("span", { className: "text-sm font-semibold text-blue-800", children: bulkOp.replace(/_/g, " ") }), bulkOp !== "PRICE_UPDATE" && (_jsx("input", { value: bulkReason, onChange: (e) => setBulkReason(e.target.value), placeholder: bulkOp === "BLOCK" ? "Reason — why are these blocked? (required)" :
                            bulkOp === "RELEASE" ? "Reason — release note for audit (required)" :
                                bulkOp === "UNBLOCK" ? "Reason — why unblocking now? (required)" :
                                    "Reason", className: "border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400 w-72" })), bulkOp === "PRICE_UPDATE" && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { value: bulkPriceType, onChange: (e) => setBulkPriceType(e.target.value), className: "border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none", children: [_jsx("option", { value: "PERCENT", children: "% Change" }), _jsx("option", { value: "FIXED_DELTA", children: "AED Delta" }), _jsx("option", { value: "FIXED", children: "Set Fixed AED" })] }), _jsx("input", { type: "number", value: bulkPriceValue, onChange: (e) => setBulkPriceValue(e.target.value), placeholder: bulkPriceType === "PERCENT" ? "e.g. 5 or -3" : "Amount", className: "border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none w-32" }), _jsx("input", { value: bulkReason, onChange: (e) => setBulkReason(e.target.value), placeholder: "Reason (optional)", className: "border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none w-44" })] })), _jsx("button", { onClick: runBulkOp, disabled: bulkSubmitting ||
                            selectedIds.size === 0 ||
                            ((bulkOp === "BLOCK" || bulkOp === "RELEASE" || bulkOp === "UNBLOCK") && !bulkReason.trim()), title: ((bulkOp === "BLOCK" || bulkOp === "RELEASE" || bulkOp === "UNBLOCK") && !bulkReason.trim())
                            ? "Reason is required for this operation"
                            : undefined, className: "px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: bulkSubmitting ? "Running…" : `Apply to ${selectedIds.size}` }), bulkResult && (_jsxs("span", { className: "text-sm text-slate-600", children: ["\u2713 ", bulkResult.succeeded, " done", bulkResult.failed > 0 ? `, ${bulkResult.failed} skipped` : ""] }))] })), !loading && units.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap flex-shrink-0", children: [Object.entries(byStatus).map(([status, count]) => {
                        const c = getStatusColor(status);
                        return (_jsxs("button", { onClick: () => setFilterStatus(filterStatus === status ? "ALL" : status), className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all ${c.bg} ${c.text} ${filterStatus === status ? "border-slate-700" : "border-transparent hover:border-slate-300"}`, children: [STATUS_LABELS[status] || status, " ", _jsx("span", { className: "font-bold", children: count })] }, status));
                    }), filterStatus !== "ALL" && (_jsx("button", { onClick: () => setFilterStatus("ALL"), className: "text-xs text-slate-400 hover:text-slate-600 ml-1", children: "Clear \u00D7" }))] })), _jsx("div", { className: "flex-1 overflow-auto", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : filtered.length === 0 ? (_jsx("div", { className: "flex flex-col items-center justify-center h-48 text-slate-400", children: _jsx("p", { children: units.length === 0 ? "No units yet — add your first unit above" : "No units match the current filters" }) })) : (_jsxs("table", { className: "w-full text-sm", style: { minWidth: "960px" }, children: [_jsx("thead", { className: "sticky top-0 bg-slate-50 border-b border-slate-200 z-10", children: _jsxs("tr", { children: [selectionMode && (_jsx("th", { className: "px-4 py-2.5 w-10", children: _jsx("input", { type: "checkbox", checked: selectedIds.size === filtered.length && filtered.length > 0, onChange: toggleSelectAll, className: "rounded" }) })), isVisible("plan") && _jsx("th", { className: "px-3 py-2.5 text-center text-xs font-semibold text-slate-500", style: { minWidth: 56, width: 56 }, children: "Plan" }), isGlobal && isVisible("project") && _jsx(Th, { label: "Project", sk: "project" }), isVisible("unitNumber") && _jsx(Th, { label: "Unit No.", sk: "unitNumber" }), isVisible("floor") && _jsx(Th, { label: "Floor", sk: "floor" }), isVisible("type") && _jsx(Th, { label: "Type", sk: "type" }), isVisible("area") && _jsx(Th, { label: "Area (sqft)", sk: "area" }), isVisible("view") && _jsx(Th, { label: "View", sk: "view" }), isVisible("price") && _jsx(Th, { label: "Price (AED)", sk: "price", align: "right" }), isVisible("status") && _jsx(Th, { label: "Status", sk: "status" }), isVisible("agent") && _jsx("th", { className: "px-4 py-2.5 text-left text-xs font-semibold text-slate-500", style: { minWidth: 140 }, children: "Agent" }), !selectionMode && _jsx("th", { className: "px-4 py-2.5 w-16" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: sorted.map((unit) => {
                                const c = getStatusColor(unit.status);
                                const isSelected = selectedIds.has(unit.id);
                                const canEdit = !isGlobal && ["AVAILABLE", "BLOCKED", "NOT_RELEASED"].includes(unit.status);
                                const floorPlan = unit.images?.[0];
                                return (_jsxs("tr", { className: `cursor-pointer group transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`, onClick: () => {
                                        if (selectionMode)
                                            toggleSelect(unit.id);
                                        else
                                            navigate(`/projects/${unit.projectId}/units/${unit.id}`);
                                    }, children: [selectionMode && (_jsx("td", { className: "px-4 py-3", onClick: (e) => e.stopPropagation(), children: _jsx("input", { type: "checkbox", checked: isSelected, onChange: () => toggleSelect(unit.id), className: "rounded" }) })), isVisible("plan") && (_jsx("td", { className: "px-3 py-2 text-center", onClick: (e) => e.stopPropagation(), style: { width: 56 }, children: floorPlan ? (_jsx(HoverPreview, { src: floorPlan.url, caption: floorPlan.caption || `Floor plan — ${unit.unitNumber}`, size: 360, children: _jsx("button", { type: "button", onClick: () => navigate(`/projects/${unit.projectId}/units/${unit.id}`), className: "w-10 h-10 rounded-md overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors bg-slate-50 align-middle", title: "Hover to enlarge \u00B7 click to open unit", "aria-label": "Open unit", children: _jsx("img", { src: floorPlan.url, alt: floorPlan.caption || "Floor plan", className: "w-full h-full object-cover", loading: "lazy" }) }) })) : (_jsx("span", { className: "inline-flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-slate-300 text-slate-400 text-base", title: "No floor plan uploaded", children: "\uD83D\uDCD0" })) })), isGlobal && isVisible("project") && (_jsx("td", { className: "px-4 py-3", style: { minWidth: 120 }, children: _jsx("button", { onClick: (e) => { e.stopPropagation(); navigate(`/projects/${unit.projectId}`); }, className: "text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium", children: projectMap[unit.projectId] || "—" }) })), isVisible("unitNumber") && (_jsx("td", { className: "px-4 py-3", style: { minWidth: 88 }, children: _jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    navigate(`/projects/${unit.projectId}/units/${unit.id}`);
                                                }, className: "font-mono font-semibold text-slate-800 hover:text-blue-600 hover:underline text-xs", children: unit.unitNumber }) })), isVisible("floor") && _jsxs("td", { className: "px-4 py-3 text-slate-500 text-xs", style: { minWidth: 56 }, children: ["F", unit.floor] }), isVisible("type") && _jsx("td", { className: "px-4 py-3 text-slate-700 text-xs", style: { minWidth: 96 }, children: unit.type.replace(/_/g, " ") }), isVisible("area") && _jsx("td", { className: "px-4 py-3 text-slate-500 text-xs", style: { minWidth: 88 }, children: formatAreaShort(unit.area) }), isVisible("view") && _jsx("td", { className: "px-4 py-3 text-slate-500 text-xs", style: { minWidth: 88 }, children: unit.view }), isVisible("price") && (_jsx("td", { className: "px-4 py-3 text-right", onClick: (e) => e.stopPropagation(), style: { minWidth: 128 }, children: editingPriceId === unit.id ? (_jsx("input", { type: "number", value: editingPrice, autoFocus: true, onChange: (e) => setEditingPrice(e.target.value), onBlur: () => editingPrice && parseInt(editingPrice) > 0 ? savePrice(unit.id, parseInt(editingPrice)) : setEditingPriceId(null), onKeyDown: (e) => {
                                                    if (e.key === "Enter" && editingPrice && parseInt(editingPrice) > 0)
                                                        savePrice(unit.id, parseInt(editingPrice));
                                                    if (e.key === "Escape")
                                                        setEditingPriceId(null);
                                                }, disabled: savingPrice, className: "w-28 px-2 py-1 border border-blue-400 rounded text-right text-xs font-semibold bg-blue-50" })) : (_jsx("button", { onClick: () => { setEditingPriceId(unit.id); setEditingPrice(unit.price.toString()); }, className: "font-semibold text-slate-800 hover:text-blue-600 hover:underline text-xs", title: "Click to edit price", children: unit.price.toLocaleString("en-AE") })) })), isVisible("status") && (_jsx("td", { className: "px-4 py-3", style: { minWidth: 110 }, children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`, children: STATUS_LABELS[unit.status] || unit.status }) })), isVisible("agent") && (_jsx("td", { className: "px-4 py-3 text-xs text-slate-500", style: { minWidth: 140 }, children: unit.assignedAgentId ? agentMap[unit.assignedAgentId] || "—" : "—" })), !selectionMode && (_jsx("td", { className: "px-4 py-3 text-right", onClick: (e) => e.stopPropagation(), style: { width: 64 }, children: _jsx("div", { className: "flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity", children: canEdit && (_jsx("button", { onClick: (e) => { e.stopPropagation(); setEditingUnit(unit); }, className: "text-xs text-blue-600 hover:text-blue-800 font-medium", children: "Edit" })) }) }))] }, unit.id));
                            }) })] })) }), showCreateModal && projectId && (_jsx(UnitFormModal, { projectId: projectId, onClose: () => setShowCreateModal(false), onSaved: load })), showBulkModal && projectId && (_jsx(BulkUnitModal, { projectId: projectId, onClose: () => setShowBulkModal(false), onCreated: load })), editingUnit && projectId && (_jsx(UnitFormModal, { projectId: projectId, unit: editingUnit, onClose: () => setEditingUnit(null), onSaved: () => { setEditingUnit(null); load(); } })), selectedUnit && (_jsx(UnitModal, { unit: selectedUnit, agents: agents, statusLabels: STATUS_LABELS, onClose: () => setSelectedUnit(null), onRefresh: load, onEditUnit: (u) => { setSelectedUnit(null); setEditingUnit(u); }, onDeleted: () => { setSelectedUnit(null); load(); } }))] }));
}
