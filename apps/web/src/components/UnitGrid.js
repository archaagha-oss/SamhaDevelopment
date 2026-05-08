import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
const STATUS_ORDER = [
    "NOT_RELEASED", "AVAILABLE", "ON_HOLD", "RESERVED", "BOOKED", "SOLD", "BLOCKED", "HANDED_OVER",
];
export default function UnitGrid({ units, statusColors, statusLabels, projectId, }) {
    const navigate = useNavigate();
    // Floor list (descending — top floor first, like a real elevation drawing)
    const floors = useMemo(() => [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a), [units]);
    const [activeFloor, setActiveFloor] = useState(floors[0] ?? "ALL");
    // Reset active floor when the unit set changes shape
    useEffect(() => {
        if (activeFloor === "ALL")
            return;
        if (!floors.includes(activeFloor))
            setActiveFloor(floors[0] ?? "ALL");
    }, [floors, activeFloor]);
    // Per-floor counts for the floor tabs
    const countsByFloor = useMemo(() => {
        const m = {};
        units.forEach((u) => { m[u.floor] = (m[u.floor] ?? 0) + 1; });
        return m;
    }, [units]);
    // Status legend counts (always reflect the full unit set, not the active floor)
    const countsByStatus = useMemo(() => {
        const m = {};
        units.forEach((u) => { m[u.status] = (m[u.status] ?? 0) + 1; });
        return m;
    }, [units]);
    // Floors to render in the body
    const visibleFloors = activeFloor === "ALL" ? floors : floors.filter((f) => f === activeFloor);
    // Max units across whichever floors are visible
    const maxUnitsPerFloor = useMemo(() => {
        if (visibleFloors.length === 0)
            return 10;
        return Math.max(...visibleFloors.map((floor) => Math.max(...units
            .filter((u) => u.floor === floor)
            .map((u) => {
            const suffix = parseInt(u.unitNumber.split("-")[1] || "0", 10);
            return Number.isFinite(suffix) ? suffix : 0;
        }))), 10);
    }, [units, visibleFloors]);
    const openUnit = (u) => {
        const pid = u.projectId ?? projectId;
        if (!pid)
            return;
        navigate(`/projects/${pid}/units/${u.id}`);
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap text-xs", children: [_jsx("span", { className: "text-slate-400 font-semibold uppercase tracking-wide mr-1", children: "Legend" }), STATUS_ORDER.map((s) => (_jsxs("span", { className: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-white", title: statusLabels[s] || s, children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-sm ${statusColors[s] || "bg-slate-200"}` }), _jsx("span", { className: "font-medium text-slate-700", children: statusLabels[s] || s }), _jsx("span", { className: "text-slate-400", children: countsByStatus[s] ?? 0 })] }, s)))] }), _jsxs("div", { className: "flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-1.5", children: [_jsxs("button", { type: "button", onClick: () => setActiveFloor("ALL"), className: `px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${activeFloor === "ALL"
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"}`, children: ["All floors ", _jsx("span", { className: "opacity-70 ml-1", children: units.length })] }), _jsx("div", { className: "h-4 w-px bg-slate-200 mx-1" }), floors.map((f) => (_jsxs("button", { type: "button", onClick: () => setActiveFloor(f), className: `px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${activeFloor === f
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"}`, children: ["Floor ", f, " ", _jsx("span", { className: "opacity-70 ml-1", children: countsByFloor[f] ?? 0 })] }, f)))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50", children: [_jsx("th", { className: "border border-gray-200 px-4 py-2 text-left text-sm font-semibold text-gray-900 w-20 sticky left-0 bg-gray-50", children: "Floor" }), Array.from({ length: maxUnitsPerFloor }).map((_, i) => (_jsx("th", { className: "border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-500 w-14", children: String(i + 1).padStart(2, "0") }, i)))] }) }), _jsx("tbody", { children: visibleFloors.map((floor) => (_jsxs("tr", { className: "hover:bg-gray-50/40", children: [_jsxs("td", { className: "border border-gray-200 px-4 py-2 font-semibold text-gray-900 bg-gray-50 sticky left-0", children: ["F", floor] }), Array.from({ length: maxUnitsPerFloor }).map((_, i) => {
                                        const expectedNumber = `${floor}-${String(i + 1).padStart(2, "0")}`;
                                        const unit = units.find((u) => u.unitNumber === expectedNumber);
                                        return (_jsx("td", { className: "border border-gray-200 p-1", children: unit ? (_jsx("button", { type: "button", onClick: () => openUnit(unit), className: `w-full h-12 rounded font-semibold text-white text-[11px] hover:shadow-md hover:ring-2 hover:ring-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all cursor-pointer ${statusColors[unit.status] || "bg-gray-200"}`, title: `${unit.unitNumber} · ${unit.type.replace(/_/g, " ")} · ${statusLabels[unit.status] ?? unit.status}`, "aria-label": `Open unit ${unit.unitNumber} (${statusLabels[unit.status] ?? unit.status})`, children: unit.unitNumber })) : (_jsx("div", { className: "w-full h-12 bg-gray-50 rounded border border-dashed border-gray-200" })) }, `${floor}-${i}`));
                                    })] }, floor))) })] }) })] }));
}
