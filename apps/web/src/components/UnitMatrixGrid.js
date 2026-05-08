import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { getStatusColor } from "../utils/statusColors";
import { useFilterState } from "../hooks/useFilterState";
import UnitDetailPanel from "./UnitDetailPanel";
const UNIT_TYPE_LABELS = {
    STUDIO: "Studio",
    ONE_BR: "1BR",
    TWO_BR: "2BR",
    THREE_BR: "3BR",
    FOUR_BR: "4BR",
    COMMERCIAL: "Comm",
};
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
const DEFAULT_PAGE_SIZE = 50;
// Memoized unit cell to prevent unnecessary re-renders
const UnitCell = memo(function UnitCell({ unit, onClick }) {
    const statusColor = getStatusColor(unit.status);
    const pricePerSqft = unit.area ? Math.round(unit.price / unit.area) : 0;
    return (_jsxs("button", { onClick: () => onClick(unit), className: `relative p-3 rounded-lg border-2 transition group ${statusColor.bg} ${statusColor.text}`, title: `Unit ${unit.unitNumber} | ${UNIT_TYPE_LABELS[unit.type] || unit.type} | ${unit.area.toFixed(2)} sqft | AED ${pricePerSqft}/sqft`, "aria-label": `Unit ${unit.unitNumber} - ${statusColor.text}`, children: [_jsxs("div", { className: "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs py-2 px-3 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10", children: ["Unit ", unit.unitNumber, " | ", UNIT_TYPE_LABELS[unit.type] || unit.type, _jsx("br", {}), unit.area.toFixed(2), " sqft | AED ", pricePerSqft, "/sqft"] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("div", { className: "font-bold text-sm", children: unit.unitNumber }), _jsx("div", { className: "text-xs", children: UNIT_TYPE_LABELS[unit.type] || unit.type }), _jsxs("div", { className: "text-xs opacity-75", children: [unit.area.toFixed(0), " sqft"] })] })] }));
});
export default function UnitMatrixGrid({ projectId, onCreateOffer, onViewDeal, }) {
    // State
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [expandedFloors, setExpandedFloors] = useState(() => {
        const saved = localStorage.getItem("unit-floor-expanded");
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    // Filters
    const { filters, updateFilters, resetFilters } = useFilterState();
    const [availableFloors, setAvailableFloors] = useState([]);
    const [availableTypes, setAvailableTypes] = useState([]);
    const [totalUnits, setTotalUnits] = useState(0);
    // Load units with pagination and error handling
    const loadUnits = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = {
                page: 1,
                limit: DEFAULT_PAGE_SIZE,
            };
            if (projectId)
                params.projectId = projectId;
            if (filters.floor && filters.floor !== "All")
                params.floor = parseInt(filters.floor);
            if (filters.type && filters.type !== "All")
                params.type = filters.type;
            if (filters.minPrice)
                params.minPrice = parseInt(filters.minPrice);
            if (filters.maxPrice)
                params.maxPrice = parseInt(filters.maxPrice);
            const response = await axios.get("/api/units", { params });
            const unitsData = response.data.data || [];
            setUnits(unitsData);
            setTotalUnits(response.data.pagination?.total || unitsData.length);
            // Extract available floors and types from all units, not just current page
            const floors = Array.from(new Set(unitsData.map((u) => u.floor))).sort((a, b) => a - b);
            const types = Array.from(new Set(unitsData.map((u) => u.type)));
            setAvailableFloors(floors);
            setAvailableTypes(types.sort());
        }
        catch (err) {
            const errorMessage = axios.isAxiosError(err)
                ? err.response?.data?.error || "Failed to load units"
                : "An unexpected error occurred";
            setError(errorMessage);
            toast.error(errorMessage);
        }
        finally {
            setLoading(false);
        }
    }, [projectId, filters]);
    useEffect(() => {
        loadUnits();
    }, [loadUnits]);
    // Save expanded floors to localStorage
    useEffect(() => {
        localStorage.setItem("unit-floor-expanded", JSON.stringify(Array.from(expandedFloors)));
    }, [expandedFloors]);
    // Group units by floor
    const unitsByFloor = useMemo(() => {
        const grouped = new Map();
        units.forEach((unit) => {
            if (!grouped.has(unit.floor)) {
                grouped.set(unit.floor, []);
            }
            grouped.get(unit.floor).push(unit);
        });
        // Sort by floor number and units within floor by unit number
        const sorted = new Map(Array.from(grouped.entries())
            .sort(([floorA], [floorB]) => floorA - floorB)
            .map(([floor, unitsInFloor]) => [
            floor,
            unitsInFloor.sort((a, b) => {
                const numA = parseInt(a.unitNumber.split("-")[1] || "0");
                const numB = parseInt(b.unitNumber.split("-")[1] || "0");
                return numA - numB;
            }),
        ]));
        return sorted;
    }, [units]);
    // Initialize with all floors expanded if not in localStorage
    useEffect(() => {
        if (expandedFloors.size === 0 && availableFloors.length > 0) {
            const allFloors = new Set(availableFloors);
            setExpandedFloors(allFloors);
        }
    }, [availableFloors, expandedFloors.size]);
    const toggleFloor = useCallback((floor) => {
        setExpandedFloors((prev) => {
            const next = new Set(prev);
            if (next.has(floor)) {
                next.delete(floor);
            }
            else {
                next.add(floor);
            }
            return next;
        });
    }, []);
    const handleUnitClick = (unit) => {
        setSelectedUnit(unit);
    };
    const handleCreateOffer = (unit) => {
        setSelectedUnit(null);
        onCreateOffer?.(unit);
    };
    const handleViewDeal = (dealId) => {
        setSelectedUnit(null);
        onViewDeal?.(dealId);
    };
    return (_jsxs("div", { className: "flex flex-col h-full bg-slate-50", children: [_jsxs("div", { className: "bg-white border-b border-slate-200 px-4 sm:px-6 py-4 space-y-4 flex-shrink-0", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Filters" }), _jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "floor-filter", className: "block text-xs font-medium text-slate-700 mb-1", children: "Floor" }), _jsxs("select", { id: "floor-filter", value: filters.floor, onChange: (e) => updateFilters({ floor: e.target.value }), className: "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition", children: [_jsx("option", { value: "All", children: "All Floors" }), availableFloors.map((floor) => (_jsxs("option", { value: floor, children: ["Floor ", floor === 0 ? "Ground" : floor] }, floor)))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "type-filter", className: "block text-xs font-medium text-slate-700 mb-1", children: "Type" }), _jsxs("select", { id: "type-filter", value: filters.type, onChange: (e) => updateFilters({ type: e.target.value }), className: "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition", children: [_jsx("option", { value: "All", children: "All Types" }), availableTypes.map((type) => (_jsx("option", { value: type, children: UNIT_TYPE_LABELS[type] || type }, type)))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "min-price", className: "block text-xs font-medium text-slate-700 mb-1", children: "Min Price (AED)" }), _jsx("input", { id: "min-price", type: "number", value: filters.minPrice, onChange: (e) => updateFilters({ minPrice: e.target.value }), placeholder: "e.g., 500000", className: "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "max-price", className: "block text-xs font-medium text-slate-700 mb-1", children: "Max Price (AED)" }), _jsx("input", { id: "max-price", type: "number", value: filters.maxPrice, onChange: (e) => updateFilters({ maxPrice: e.target.value }), placeholder: "e.g., 1000000", className: "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" })] })] })] }), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [_jsx("p", { className: "text-xs text-slate-600", children: loading ? "Loading..." : `${totalUnits} unit${totalUnits !== 1 ? "s" : ""} total` }), _jsx("button", { onClick: resetFilters, className: "text-xs text-blue-600 hover:text-blue-700 font-medium transition", children: "Reset Filters" })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" }), _jsx("p", { className: "text-sm text-slate-600", children: "Loading units..." })] }) })) : error ? (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("div", { className: "text-center max-w-sm", children: [_jsx("p", { className: "text-sm text-red-600 font-medium mb-2", children: "Error loading units" }), _jsx("p", { className: "text-xs text-slate-500", children: error }), _jsx("button", { onClick: () => loadUnits(), className: "mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition", children: "Try Again" })] }) })) : unitsByFloor.size === 0 ? (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("div", { className: "text-center", children: _jsx("p", { className: "text-slate-500 text-sm", children: "No units found matching your filters." }) }) })) : (_jsx("div", { className: "p-4 sm:p-6 space-y-4", children: Array.from(unitsByFloor.entries()).map(([floor, floorUnits]) => (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 overflow-hidden", children: [_jsxs("button", { onClick: () => toggleFloor(floor), className: "w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition", "aria-expanded": expandedFloors.has(floor), "aria-label": `Floor ${floor === 0 ? "Ground" : floor} - ${expandedFloors.has(floor) ? "Collapse" : "Expand"}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("h3", { className: "text-sm font-semibold text-slate-900", children: ["Floor ", floor === 0 ? "Ground" : floor] }), _jsxs("span", { className: "text-xs text-slate-500", children: ["(", floorUnits.length, " unit", floorUnits.length !== 1 ? "s" : "", ")"] })] }), _jsx("span", { className: `text-slate-400 transition-transform duration-200 ${expandedFloors.has(floor) ? "rotate-180" : ""}`, "aria-hidden": "true", children: "\u25BC" })] }), expandedFloors.has(floor) && (_jsx("div", { className: "border-t border-slate-200 p-3 sm:p-4", children: _jsx("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6 auto-rows-max", children: floorUnits.map((unit) => (_jsx(UnitCell, { unit: unit, onClick: handleUnitClick }, unit.id))) }) }))] }, floor))) })) }), selectedUnit && (_jsx(UnitDetailPanel, { unit: selectedUnit, isOpen: !!selectedUnit, onClose: () => setSelectedUnit(null), onCreateOffer: handleCreateOffer, onViewDeal: handleViewDeal }))] }));
}
