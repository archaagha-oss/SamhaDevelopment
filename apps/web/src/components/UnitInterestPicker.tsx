import { useState, useEffect } from "react";
import axios from "axios";

interface UnitOption {
  id: string;
  unitNumber: string;
  type: string;
  price: number;
  floor: number;
  project?: { name: string };
  status?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedUnitIds: Set<string>;
  primaryUnitId: string;
  onUnitsChange: (selected: Set<string>, primary: string) => void;
}

export default function UnitInterestPicker({
  isOpen,
  onClose,
  selectedUnitIds,
  primaryUnitId,
  onUnitsChange,
}: Props) {
  const [availableUnits, setUnits] = useState<UnitOption[]>([]);
  const [search, setSearch] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [selectedProject, setSelectedProject] = useState("");
  const [localSelected, setLocalSelected] = useState(new Set(selectedUnitIds));
  const [localPrimary, setLocalPrimary] = useState(primaryUnitId);
  const [loading, setLoading] = useState(false);

  const projects = [...new Set(availableUnits.map((u) => u.project?.name).filter(Boolean))];

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    axios
      .get("/api/units", { params: { limit: 500 } })
      .then((r) => {
        const all = r.data?.data ?? r.data ?? [];
        setUnits(all.filter((u: { status?: string }) => u.status === "AVAILABLE" || u.status === "ON_HOLD"));
      })
      .catch(() => setUnits([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filteredUnits = availableUnits.filter((u) => {
    const matchesSearch =
      search === "" ||
      u.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      u.type.toLowerCase().includes(search.toLowerCase());

    const minPrice = priceRange.min ? parseFloat(priceRange.min) : 0;
    const maxPrice = priceRange.max ? parseFloat(priceRange.max) : Infinity;
    const matchesPrice = u.price >= minPrice && u.price <= maxPrice;

    const matchesProject = selectedProject === "" || u.project?.name === selectedProject;

    return matchesSearch && matchesPrice && matchesProject;
  });

  const toggleUnit = (unitId: string) => {
    const next = new Set(localSelected);
    if (next.has(unitId)) {
      next.delete(unitId);
      if (localPrimary === unitId) setLocalPrimary("");
    } else {
      next.add(unitId);
      if (next.size === 1) setLocalPrimary(unitId);
    }
    setLocalSelected(next);
  };

  const handleConfirm = () => {
    onUnitsChange(localSelected, localPrimary);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-slate-900 text-lg">Add Units of Interest</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3 flex-shrink-0">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Unit number or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Min Price (AED)</label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={priceRange.min}
                onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Max Price (AED)</label>
              <input
                type="number"
                placeholder="e.g. 5000000"
                value={priceRange.max}
                onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Units List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading units…</div>
          ) : filteredUnits.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No units found</div>
          ) : (
            <div className="space-y-2">
              {filteredUnits.map((u) => {
                const checked = localSelected.has(u.id);
                const isOnHold = u.status === "ON_HOLD";
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isOnHold ? "border-orange-200 bg-orange-50 hover:bg-orange-100" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnit(u.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{u.unitNumber}</span>
                        {localPrimary === u.id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            Primary ★
                          </span>
                        )}
                        {isOnHold && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            On Hold
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {u.type.replace(/_/g, " ")} · Floor {u.floor}
                        {u.project?.name && ` · ${u.project.name}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-blue-600 flex-shrink-0">
                      AED {u.price.toLocaleString()}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Primary unit selector */}
        {localSelected.size > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-blue-50 text-xs text-blue-700 flex-shrink-0">
            <p className="font-medium mb-2">Selected: {localSelected.size} unit(s)</p>
            <p>Click a unit to mark it as primary interest (★)</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50"
          >
            Confirm ({localSelected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
