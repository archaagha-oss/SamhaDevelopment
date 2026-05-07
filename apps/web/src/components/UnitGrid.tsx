import { useState, useMemo } from "react";
import UnitModal from "./UnitModal";
import { formatAreaShort } from "../utils/formatArea";

interface Unit {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  area: number;
  price: number;
  view: string;
  status: string;
  assignedAgentId?: string;
  parkingSpaces?: number;
}

interface UnitGridProps {
  units: Unit[];
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
  onRefresh?: () => void;
}

const TYPE_ICON: Record<string, string> = {
  STUDIO:     "S",
  ONE_BR:     "1",
  TWO_BR:     "2",
  THREE_BR:   "3",
  FOUR_BR:    "4",
  COMMERCIAL: "C",
};

function fmtPrice(price: number): string {
  if (price >= 1_000_000) return `AED ${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `AED ${Math.round(price / 1_000)}k`;
  return `AED ${price.toLocaleString()}`;
}

export default function UnitGrid({
  units,
  statusColors,
  statusLabels,
  onRefresh,
}: UnitGridProps) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const floors = useMemo(
    () => [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a),
    [units]
  );

  const maxUnitsPerFloor = useMemo(
    () => Math.max(
      ...floors.map((floor) =>
        Math.max(
          ...units
            .filter((u) => u.floor === floor)
            .map((u) => parseInt(u.unitNumber.split("-")[1] || "0", 10) || 0)
        )
      ),
      10
    ),
    [floors, units]
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 w-16 sticky left-0 bg-slate-50 z-10">
                Floor
              </th>
              {Array.from({ length: maxUnitsPerFloor }).map((_, i) => (
                <th
                  key={i}
                  className="border border-slate-200 px-1.5 py-2 text-center text-[10px] font-semibold text-slate-500 w-10 md:w-14"
                >
                  {String(i + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {floors.map((floor) => (
              <tr key={floor} className="hover:bg-slate-50/50">
                <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700 bg-slate-50 text-sm sticky left-0 z-10">
                  {floor}
                </td>
                {Array.from({ length: maxUnitsPerFloor }).map((_, i) => {
                  const unitNumber = `${floor}-${String(i + 1).padStart(2, "0")}`;
                  const unit = units.find((u) => u.unitNumber === unitNumber);

                  if (!unit) {
                    return (
                      <td key={`${floor}-${i}`} className="border border-slate-200 p-1">
                        <div className="w-full h-10 md:h-14 bg-slate-50 rounded border border-dashed border-slate-200" />
                      </td>
                    );
                  }

                  const tooltip = [
                    `Unit ${unit.unitNumber}`,
                    unit.type.replace(/_/g, " "),
                    formatAreaShort(unit.area),
                    fmtPrice(unit.price),
                    unit.parkingSpaces ? `${unit.parkingSpaces} parking` : null,
                    statusLabels[unit.status] || unit.status,
                  ].filter(Boolean).join(" · ");

                  return (
                    <td key={`${floor}-${i}`} className="border border-slate-200 p-1">
                      <button
                        onClick={() => setSelectedUnit(unit)}
                        className={`relative w-full h-10 md:h-14 rounded font-bold text-white text-xs md:text-sm hover:shadow-md hover:scale-105 transition-all cursor-pointer ${
                          statusColors[unit.status] || "bg-slate-300"
                        }`}
                        title={tooltip}
                      >
                        <span className="absolute top-0.5 right-1 text-[8px] md:text-[10px] font-semibold opacity-70">
                          {TYPE_ICON[unit.type] || ""}
                        </span>
                        <span className="font-bold">{unit.unitNumber.split("-")[1]}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUnit && (
        <UnitModal
          unit={selectedUnit}
          statusLabels={statusLabels}
          onClose={() => setSelectedUnit(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
