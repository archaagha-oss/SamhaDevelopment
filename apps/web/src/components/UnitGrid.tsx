import { useState } from "react";
import UnitModal from "./UnitModal";

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
}

interface UnitGridProps {
  units: Unit[];
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
  onRefresh?: () => void;
}

export default function UnitGrid({
  units,
  statusColors,
  statusLabels,
  onRefresh,
}: UnitGridProps) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Group units by floor
  const floors = [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a); // Descending (top floor first)

  // Calculate max units per floor dynamically
  const maxUnitsPerFloor = Math.max(
    ...floors.map((floor) =>
      Math.max(
        ...units
          .filter((u) => u.floor === floor)
          .map((u) => {
            const unitNumber = parseInt(u.unitNumber.split("-")[1]);
            return unitNumber;
          })
      )
    ),
    10 // Minimum 10 columns for consistency
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-900 w-20">
                Floor
              </th>
              {Array.from({ length: maxUnitsPerFloor }).map((_, i) => (
                <th
                  key={i}
                  className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-600 w-12"
                >
                  {String(i + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {floors.map((floor) => (
              <tr key={floor} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900 bg-gray-50">
                  {floor}
                </td>
                {Array.from({ length: maxUnitsPerFloor }).map((_, i) => {
                  const unitNumber = `${floor}-${String(i + 1).padStart(2, "0")}`;
                  const unit = units.find((u) => u.unitNumber === unitNumber);

                  return (
                    <td
                      key={`${floor}-${i}`}
                      className="border border-gray-300 p-1"
                    >
                      {unit ? (
                        <button
                          onClick={() => setSelectedUnit(unit)}
                          className={`w-full h-12 rounded font-bold text-white text-xs hover:shadow-md transition-all cursor-pointer ${
                            statusColors[unit.status] || "bg-gray-200"
                          }`}
                          title={`${unit.unitNumber} - ${unit.type} - ${statusLabels[unit.status]}`}
                        >
                          {unit.unitNumber.split("-")[1]}
                        </button>
                      ) : (
                        <div className="w-full h-12 bg-gray-100 rounded border-2 border-dashed border-gray-300"></div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unit Modal */}
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
