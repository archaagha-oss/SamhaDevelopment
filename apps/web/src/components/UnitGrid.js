import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import UnitModal from "./UnitModal";
export default function UnitGrid({ units, statusColors, statusLabels, onRefresh, }) {
    const [selectedUnit, setSelectedUnit] = useState(null);
    // Group units by floor
    const floors = [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a); // Descending (top floor first)
    // Calculate max units per floor dynamically
    const maxUnitsPerFloor = Math.max(...floors.map((floor) => Math.max(...units
        .filter((u) => u.floor === floor)
        .map((u) => {
        const unitNumber = parseInt(u.unitNumber.split("-")[1]);
        return unitNumber;
    }))), 10 // Minimum 10 columns for consistency
    );
    return (_jsxs("div", { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-100", children: [_jsx("th", { className: "border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-900 w-20", children: "Floor" }), Array.from({ length: maxUnitsPerFloor }).map((_, i) => (_jsx("th", { className: "border border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-600 w-12", children: String(i + 1).padStart(2, "0") }, i)))] }) }), _jsx("tbody", { children: floors.map((floor) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "border border-gray-300 px-4 py-3 font-semibold text-gray-900 bg-gray-50", children: floor }), Array.from({ length: maxUnitsPerFloor }).map((_, i) => {
                                        const unitNumber = `${floor}-${String(i + 1).padStart(2, "0")}`;
                                        const unit = units.find((u) => u.unitNumber === unitNumber);
                                        return (_jsx("td", { className: "border border-gray-300 p-1", children: unit ? (_jsx("button", { onClick: () => setSelectedUnit(unit), className: `w-full h-12 rounded font-bold text-white text-xs hover:shadow-md transition-all cursor-pointer ${statusColors[unit.status] || "bg-gray-200"}`, title: `${unit.unitNumber} - ${unit.type} - ${statusLabels[unit.status]}`, children: unit.unitNumber.split("-")[1] })) : (_jsx("div", { className: "w-full h-12 bg-gray-100 rounded border-2 border-dashed border-gray-300" })) }, `${floor}-${i}`));
                                    })] }, floor))) })] }) }), selectedUnit && (_jsx(UnitModal, { unit: selectedUnit, statusLabels: statusLabels, onClose: () => setSelectedUnit(null), onRefresh: onRefresh }))] }));
}
