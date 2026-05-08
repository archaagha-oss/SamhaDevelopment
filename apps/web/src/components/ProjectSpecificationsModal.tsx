import { useEffect, useState } from "react";
import axios from "axios";

interface Props {
  projectId: string;
  onClose: () => void;
}

const SPEC_AREAS = [
  { value: "FOYER", label: "Foyer" },
  { value: "LIVING_AREA", label: "Living Area" },
  { value: "DINING_AREA", label: "Dining Area" },
  { value: "BEDROOM", label: "Bedroom" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "MASTER_BATHROOM", label: "Master Bathroom" },
  { value: "SECONDARY_BATHROOM", label: "Secondary Bathroom" },
  { value: "BALCONY", label: "Balcony" },
  { value: "POWDER_ROOM", label: "Powder Room" },
  { value: "STUDY", label: "Study" },
  { value: "MAID_ROOM", label: "Maid Room" },
  { value: "LAUNDRY", label: "Laundry" },
] as const;

interface Row {
  area: (typeof SPEC_AREAS)[number]["value"];
  floorFinish: string;
  wallFinish: string;
  ceilingFinish: string;
  additionalFinishes: string;
}

const inp =
  "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-0.5";

// SPA Schedule 2 — finishes specification table (per area).
// Bulk PUT: the editor sends the full list and the API replaces in one tx.
export default function ProjectSpecificationsModal({ projectId, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`/api/projects/${projectId}/specifications`)
      .then((r) => {
        const data = (r.data ?? []) as Array<{
          area: Row["area"];
          floorFinish: string | null;
          wallFinish: string | null;
          ceilingFinish: string | null;
          additionalFinishes: string | null;
        }>;
        setRows(
          data.map((d) => ({
            area: d.area,
            floorFinish: d.floorFinish ?? "",
            wallFinish: d.wallFinish ?? "",
            ceilingFinish: d.ceilingFinish ?? "",
            additionalFinishes: d.additionalFinishes ?? "",
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const usedAreas = new Set(rows.map((r) => r.area));
  const availableAreas = SPEC_AREAS.filter((a) => !usedAreas.has(a.value));

  const addRow = (area: Row["area"]) =>
    setRows([
      ...rows,
      { area, floorFinish: "", wallFinish: "", ceilingFinish: "", additionalFinishes: "" },
    ]);

  const removeRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));

  const setField = (idx: number, field: keyof Row, value: string) =>
    setRows(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);
    setSaved(false);
    try {
      await axios.put(`/api/projects/${projectId}/specifications`, {
        specifications: rows.map((r, i) => ({
          area: r.area,
          floorFinish: r.floorFinish || null,
          wallFinish: r.wallFinish || null,
          ceilingFinish: r.ceilingFinish || null,
          additionalFinishes: r.additionalFinishes || null,
          sortOrder: i,
        })),
      });
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save specifications");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">SPA Schedule 2 — Specifications</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Per-area finish breakdown printed on the SPA's draft property specification.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {rows.length === 0 && (
                <p className="text-sm text-slate-400 italic">
                  No specifications yet. Add an area below to start.
                </p>
              )}

              {rows.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold text-slate-600 w-40">Area</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Floor</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Wall</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Ceiling</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Additional</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={`${r.area}-${idx}`} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2 font-medium text-slate-700">
                            {SPEC_AREAS.find((a) => a.value === r.area)?.label ?? r.area}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={r.floorFinish}
                              onChange={(e) => setField(idx, "floorFinish", e.target.value)}
                              placeholder="e.g. Porcelain tiles 600x1200 mm"
                              className={inp}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={r.wallFinish}
                              onChange={(e) => setField(idx, "wallFinish", e.target.value)}
                              placeholder="e.g. Emulsion paint"
                              className={inp}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={r.ceilingFinish}
                              onChange={(e) => setField(idx, "ceilingFinish", e.target.value)}
                              placeholder="e.g. Gypsum + emulsion"
                              className={inp}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={r.additionalFinishes}
                              onChange={(e) => setField(idx, "additionalFinishes", e.target.value)}
                              placeholder="Countertops, cabinets, etc."
                              className={inp}
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => removeRow(idx)}
                              className="text-slate-400 hover:text-red-600 text-lg leading-none"
                              title="Remove area"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {availableAreas.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className={lbl}>Add area:</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addRow(e.target.value as Row["area"]);
                        e.target.value = "";
                      }
                    }}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-slate-50"
                    defaultValue=""
                  >
                    <option value="" disabled>Select an area…</option>
                    {availableAreas.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              {saved && (
                <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                  Specifications saved.
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm"
                >
                  {saved ? "Close" : "Cancel"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save Specifications"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
