import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface Unit {
  id: string;
  projectId?: string;
  unitNumber: string;
  floor: number;
  type: string;
  area: number;
  price: number;
  view: string;
  status: string;
  assignedAgentId?: string;
}

interface UnitGridProps {
  units: Unit[];
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
  /** Optional — used when units don't carry projectId (single-project view) */
  projectId?: string;
  onRefresh?: () => void;
}

const STATUS_ORDER = [
  "NOT_RELEASED", "AVAILABLE", "ON_HOLD", "RESERVED", "BOOKED", "SOLD", "BLOCKED", "HANDED_OVER",
];

export default function UnitGrid({
  units,
  statusColors,
  statusLabels,
  projectId,
}: UnitGridProps) {
  const navigate = useNavigate();

  // Floor list (descending — top floor first, like a real elevation drawing)
  const floors = useMemo(
    () => [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a),
    [units]
  );

  const [activeFloor, setActiveFloor] = useState<number | "ALL">(floors[0] ?? "ALL");

  // Reset active floor when the unit set changes shape
  useEffect(() => {
    if (activeFloor === "ALL") return;
    if (!floors.includes(activeFloor)) setActiveFloor(floors[0] ?? "ALL");
  }, [floors, activeFloor]);

  // Per-floor counts for the floor tabs
  const countsByFloor = useMemo(() => {
    const m: Record<number, number> = {};
    units.forEach((u) => { m[u.floor] = (m[u.floor] ?? 0) + 1; });
    return m;
  }, [units]);

  // Status legend counts (always reflect the full unit set, not the active floor)
  const countsByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    units.forEach((u) => { m[u.status] = (m[u.status] ?? 0) + 1; });
    return m;
  }, [units]);

  // Floors to render in the body
  const visibleFloors = activeFloor === "ALL" ? floors : floors.filter((f) => f === activeFloor);

  // Max units across whichever floors are visible
  const maxUnitsPerFloor = useMemo(() => {
    if (visibleFloors.length === 0) return 10;
    return Math.max(
      ...visibleFloors.map((floor) =>
        Math.max(
          ...units
            .filter((u) => u.floor === floor)
            .map((u) => {
              const suffix = parseInt(u.unitNumber.split("-")[1] || "0", 10);
              return Number.isFinite(suffix) ? suffix : 0;
            })
        )
      ),
      10
    );
  }, [units, visibleFloors]);

  const openUnit = (u: Unit) => {
    const pid = u.projectId ?? projectId;
    if (!pid) return;
    navigate(`/projects/${pid}/units/${u.id}`);
  };

  return (
    <div className="space-y-3">

      {/* ─── Status legend ─── */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-400 font-semibold uppercase tracking-wide mr-1">Legend</span>
        {STATUS_ORDER.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-white"
            title={statusLabels[s] || s}
          >
            <span className={`w-2.5 h-2.5 rounded-sm ${statusColors[s] || "bg-slate-200"}`} />
            <span className="font-medium text-slate-700">{statusLabels[s] || s}</span>
            <span className="text-slate-400">{countsByStatus[s] ?? 0}</span>
          </span>
        ))}
      </div>

      {/* ─── Floor tabs ─── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-1.5">
        <button
          type="button"
          onClick={() => setActiveFloor("ALL")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
            activeFloor === "ALL"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All floors <span className="opacity-70 ml-1">{units.length}</span>
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        {floors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFloor(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
              activeFloor === f
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Floor {f} <span className="opacity-70 ml-1">{countsByFloor[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ─── Grid ─── */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold text-gray-900 w-20 sticky left-0 bg-gray-50">
                Floor
              </th>
              {Array.from({ length: maxUnitsPerFloor }).map((_, i) => (
                <th
                  key={i}
                  className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-500 w-14"
                >
                  {String(i + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleFloors.map((floor) => (
              <tr key={floor} className="hover:bg-gray-50/40">
                <td className="border border-gray-200 px-4 py-2 font-semibold text-gray-900 bg-gray-50 sticky left-0">
                  F{floor}
                </td>
                {Array.from({ length: maxUnitsPerFloor }).map((_, i) => {
                  const expectedNumber = `${floor}-${String(i + 1).padStart(2, "0")}`;
                  const unit = units.find((u) => u.unitNumber === expectedNumber);
                  return (
                    <td key={`${floor}-${i}`} className="border border-gray-200 p-1">
                      {unit ? (
                        <button
                          type="button"
                          onClick={() => openUnit(unit)}
                          className={`w-full h-12 rounded font-semibold text-white text-[11px] hover:shadow-md hover:ring-2 hover:ring-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all cursor-pointer ${
                            statusColors[unit.status] || "bg-gray-200"
                          }`}
                          title={`${unit.unitNumber} · ${unit.type.replace(/_/g, " ")} · ${statusLabels[unit.status] ?? unit.status}`}
                          aria-label={`Open unit ${unit.unitNumber} (${statusLabels[unit.status] ?? unit.status})`}
                        >
                          {unit.unitNumber}
                        </button>
                      ) : (
                        <div className="w-full h-12 bg-gray-50 rounded border border-dashed border-gray-200" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
