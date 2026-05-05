import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
export default function UnitInterestPicker({ isOpen, onClose, selectedUnitIds, primaryUnitId, onUnitsChange, }) {
    const [availableUnits, setUnits] = useState([]);
    const [search, setSearch] = useState("");
    const [priceRange, setPriceRange] = useState({ min: "", max: "" });
    const [selectedProject, setSelectedProject] = useState("");
    const [localSelected, setLocalSelected] = useState(new Set(selectedUnitIds));
    const [localPrimary, setLocalPrimary] = useState(primaryUnitId);
    const [loading, setLoading] = useState(false);
    const projects = [...new Set(availableUnits.map((u) => u.project?.name).filter(Boolean))];
    useEffect(() => {
        if (!isOpen)
            return;
        setLoading(true);
        axios
            .get("/api/units", { params: { limit: 500 } })
            .then((r) => {
            const all = r.data?.data ?? r.data ?? [];
            setUnits(all.filter((u) => u.status === "AVAILABLE" || u.status === "ON_HOLD"));
        })
            .catch(() => setUnits([]))
            .finally(() => setLoading(false));
    }, [isOpen]);
    const filteredUnits = availableUnits.filter((u) => {
        const matchesSearch = search === "" ||
            u.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
            u.type.toLowerCase().includes(search.toLowerCase());
        const minPrice = priceRange.min ? parseFloat(priceRange.min) : 0;
        const maxPrice = priceRange.max ? parseFloat(priceRange.max) : Infinity;
        const matchesPrice = u.price >= minPrice && u.price <= maxPrice;
        const matchesProject = selectedProject === "" || u.project?.name === selectedProject;
        return matchesSearch && matchesPrice && matchesProject;
    });
    const toggleUnit = (unitId) => {
        const next = new Set(localSelected);
        if (next.has(unitId)) {
            next.delete(unitId);
            if (localPrimary === unitId)
                setLocalPrimary("");
        }
        else {
            next.add(unitId);
            if (next.size === 1)
                setLocalPrimary(unitId);
        }
        setLocalSelected(next);
    };
    const handleConfirm = () => {
        onUnitsChange(localSelected, localPrimary);
        onClose();
    };
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50", children: [_jsx("div", { className: "absolute inset-0 bg-black/30", onClick: onClose }), _jsxs("div", { className: "absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsx("h2", { className: "font-bold text-slate-900 text-lg", children: "Add Units of Interest" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "px-6 py-4 border-b border-slate-100 space-y-3 flex-shrink-0", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Search" }), _jsx("input", { type: "text", placeholder: "Unit number or type\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Min Price (AED)" }), _jsx("input", { type: "number", placeholder: "e.g. 500000", value: priceRange.min, onChange: (e) => setPriceRange({ ...priceRange, min: e.target.value }), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Max Price (AED)" }), _jsx("input", { type: "number", placeholder: "e.g. 5000000", value: priceRange.max, onChange: (e) => setPriceRange({ ...priceRange, max: e.target.value }), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] })] }), projects.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Project" }), _jsxs("select", { value: selectedProject, onChange: (e) => setSelectedProject(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "", children: "All projects" }), projects.map((p) => (_jsx("option", { value: p, children: p }, p)))] })] }))] }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-4", children: loading ? (_jsx("div", { className: "text-center py-8 text-slate-400", children: "Loading units\u2026" })) : filteredUnits.length === 0 ? (_jsx("div", { className: "text-center py-8 text-slate-400", children: "No units found" })) : (_jsx("div", { className: "space-y-2", children: filteredUnits.map((u) => {
                                const checked = localSelected.has(u.id);
                                const isOnHold = u.status === "ON_HOLD";
                                return (_jsxs("label", { className: `flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isOnHold ? "border-orange-200 bg-orange-50 hover:bg-orange-100" : "border-slate-200 hover:bg-slate-50"}`, children: [_jsx("input", { type: "checkbox", checked: checked, onChange: () => toggleUnit(u.id), className: "rounded border-slate-300 text-blue-600 focus:ring-blue-500" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-semibold text-slate-800", children: u.unitNumber }), localPrimary === u.id && (_jsx("span", { className: "text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium", children: "Primary \u2605" })), isOnHold && (_jsx("span", { className: "text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium", children: "On Hold" }))] }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: [u.type.replace(/_/g, " "), " \u00B7 Floor ", u.floor, u.project?.name && ` · ${u.project.name}`] })] }), _jsxs("span", { className: "text-sm font-bold text-blue-600 flex-shrink-0", children: ["AED ", u.price.toLocaleString()] })] }, u.id));
                            }) })) }), localSelected.size > 0 && (_jsxs("div", { className: "px-6 py-3 border-t border-slate-100 bg-blue-50 text-xs text-blue-700 flex-shrink-0", children: [_jsxs("p", { className: "font-medium mb-2", children: ["Selected: ", localSelected.size, " unit(s)"] }), _jsx("p", { children: "Click a unit to mark it as primary interest (\u2605)" })] })), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors", children: "Cancel" }), _jsxs("button", { type: "button", onClick: handleConfirm, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50", children: ["Confirm (", localSelected.size, ")"] })] })] })] }));
}
