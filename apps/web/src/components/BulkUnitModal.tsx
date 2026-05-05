import { useState, useEffect } from "react";
import axios from "axios";

interface Props {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface UnitRow {
  suffix: number;     // position on floor, e.g. 1 → "5-01"
  type: string;
  view: string;
  area: string;
  price: string;
  include: boolean;   // can deselect individual units
}

const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];

const inp = "border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:outline-none focus:border-blue-400 w-full";

function buildRows(count: number, defaultType: string, defaultView: string, defaultArea: string, defaultPrice: string): UnitRow[] {
  return Array.from({ length: count }, (_, i) => ({
    suffix: i + 1,
    type: defaultType,
    view: defaultView,
    area: defaultArea,
    price: defaultPrice,
    include: true,
  }));
}

export default function BulkUnitModal({ projectId, onClose, onCreated }: Props) {
  const [floor, setFloor] = useState("");
  const [defaultType, setDefaultType] = useState("TWO_BR");
  const [defaultView, setDefaultView] = useState("SEA");
  const [defaultArea, setDefaultArea] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [configCount, setConfigCount] = useState(8);
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [step, setStep] = useState<"config" | "layout" | "result">("config");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; units: any[] } | null>(null);

  // Load defaults from project config
  useEffect(() => {
    axios.get(`/api/projects/${projectId}/config`)
      .then((r) => {
        setConfigCount(r.data.unitsPerFloor ?? 8);
        setDefaultType(r.data.defaultUnitType ?? "STUDIO");
        setDefaultView(r.data.defaultView ?? "GARDEN");
        setDefaultArea((r.data.defaultArea ?? "").toString());
        if (r.data.defaultPrice) setDefaultPrice(r.data.defaultPrice.toString());
      })
      .catch(() => {});
  }, [projectId]);

  const goToLayout = (e: React.FormEvent) => {
    e.preventDefault();
    setRows(buildRows(configCount, defaultType, defaultView, defaultArea, defaultPrice));
    setStep("layout");
    setError(null);
  };

  const updateRow = (idx: number, field: keyof UnitRow, value: string | boolean) =>
    setRows((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  // Apply a column value to all included rows
  const applyToAll = (field: "type" | "view" | "area" | "price", value: string) =>
    setRows((r) => r.map((row) => row.include ? { ...row, [field]: value } : row));

  const handleSubmit = async () => {
    const toCreate = rows.filter((r) => r.include);
    if (toCreate.length === 0) return;

    const floorNum = parseInt(floor);
    if (!floorNum) { setError("Invalid floor number"); return; }

    // Validate all rows have valid area and price
    for (const row of toCreate) {
      if (!row.area || parseFloat(row.area) <= 0) { setError(`Unit ${floorNum}-${String(row.suffix).padStart(2, "0")}: area must be > 0`); return; }
      if (!row.price || parseFloat(row.price) <= 0) { setError(`Unit ${floorNum}-${String(row.suffix).padStart(2, "0")}: price must be > 0`); return; }
    }

    setSubmitting(true);
    setError(null);
    try {
      // Single transactional bulk request — all or none
      const r = await axios.post("/api/units/bulk", {
        projectId,
        units: toCreate.map((row) => ({
          unitNumber: `${floorNum}-${String(row.suffix).padStart(2, "0")}`,
          floor: floorNum,
          type: row.type,
          view: row.view,
          area: parseFloat(row.area),
          price: parseFloat(row.price),
        })),
      });
      setResult({ created: r.data.created, skipped: r.data.skipped, units: r.data.units });
      setStep("result");
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create units. Check values and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeRows = rows.filter((r) => r.include).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900">Add Floor</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === "config" && "Set floor number and shared defaults"}
              {step === "layout" && `Customize each unit — ${activeRows} of ${rows.length} selected`}
              {step === "result" && "Units created"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {/* Step 1 — Config */}
        {step === "config" && (
          <form onSubmit={goToLayout} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Floor Number *</label>
                <input
                  required type="number" min="0"
                  value={floor} onChange={(e) => setFloor(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Units on this floor</label>
                <input
                  type="number" min="1" max="100"
                  value={configCount} onChange={(e) => setConfigCount(parseInt(e.target.value) || 8)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                />
                <p className="text-xs text-slate-400 mt-0.5">Default from Project Config — adjust per floor</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Shared defaults — you can override per unit in the next step</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default Type</label>
                  <select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400">
                    {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default View</label>
                  <select value={defaultView} onChange={(e) => setDefaultView(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400">
                    {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default Area (sqm) *  <span className="text-blue-500 font-normal">shown as sqft</span></label>
                  <input required type="number" min="1" step="0.1" value={defaultArea} onChange={(e) => setDefaultArea(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default Price (AED) *</label>
                  <input required type="number" min="1" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)}
                    placeholder="e.g. 1200000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm">
                Configure Units →
              </button>
            </div>
          </form>
        )}

        {/* Step 2 — Per-unit layout */}
        {step === "layout" && (
          <>
            {/* "Apply to all" row */}
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold w-16 shrink-0">Apply all:</span>
                <select onChange={(e) => applyToAll("type", e.target.value)} defaultValue=""
                  className="border border-slate-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none">
                  <option value="" disabled>Set type…</option>
                  {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
                <select onChange={(e) => applyToAll("view", e.target.value)} defaultValue=""
                  className="border border-slate-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none">
                  <option value="" disabled>Set view…</option>
                  {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="ml-auto text-slate-400">{activeRows} units will be created</span>
              </div>
            </div>

            {/* Unit rows */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 w-8"></th>
                    <th className="px-3 py-2 text-left text-slate-500 w-20">Unit No.</th>
                    <th className="px-3 py-2 text-left text-slate-500">Type</th>
                    <th className="px-3 py-2 text-left text-slate-500">View</th>
                    <th className="px-3 py-2 text-left text-slate-500 w-24">Area (sqm)</th>
                    <th className="px-3 py-2 text-left text-slate-500 w-28">Price (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, idx) => (
                    <tr key={idx} className={row.include ? "" : "opacity-40"}>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={row.include}
                          onChange={(e) => updateRow(idx, "include", e.target.checked)}
                          className="rounded" />
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold text-slate-700">
                        {floor}-{String(row.suffix).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-1.5">
                        <select value={row.type} disabled={!row.include}
                          onChange={(e) => updateRow(idx, "type", e.target.value)} className={inp}>
                          {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select value={row.view} disabled={!row.include}
                          onChange={(e) => updateRow(idx, "view", e.target.value)} className={inp}>
                          {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min="1" step="0.1" value={row.area} disabled={!row.include}
                          onChange={(e) => updateRow(idx, "area", e.target.value)} className={inp} />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min="1" value={row.price} disabled={!row.include}
                          onChange={(e) => updateRow(idx, "price", e.target.value)} className={inp} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p className="mx-6 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setStep("config")} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">← Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || activeRows === 0}
                className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {submitting ? "Creating…" : `Create ${activeRows} Unit${activeRows !== 1 ? "s" : ""} on Floor ${floor}`}
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Result */}
        {step === "result" && result && (
          <div className="px-6 py-6 space-y-4">
            <div className="flex gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 flex-1 text-center">
                <p className="text-3xl font-bold text-emerald-700">{result.created}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">Units Created</p>
              </div>
              {result.skipped > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 flex-1 text-center">
                  <p className="text-3xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600 font-medium mt-1">Skipped (already existed)</p>
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-700 text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
