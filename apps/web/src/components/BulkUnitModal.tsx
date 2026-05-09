import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";

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

const inp = "border border-border rounded px-2 py-1 text-sm bg-muted/50 focus:outline-none focus:border-ring w-full";

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

type Step = "config" | "layout" | "preview" | "result";

export default function BulkUnitModal({ projectId, onClose, onCreated }: Props) {
  const [floor, setFloor] = useState("");
  const [defaultType, setDefaultType] = useState("TWO_BR");
  const [defaultView, setDefaultView] = useState("SEA");
  const [defaultArea, setDefaultArea] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [configCount, setConfigCount] = useState(8);
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [step, setStep] = useState<Step>("config");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; units: any[] } | null>(null);

  // Numeric apply-all UI state
  const [bulkPriceMode, setBulkPriceMode] = useState<"SET" | "PERCENT" | "DELTA">("SET");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkAreaMode, setBulkAreaMode]     = useState<"SET" | "PERCENT" | "DELTA">("SET");
  const [bulkAreaValue, setBulkAreaValue]   = useState("");

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

  const updateRow = (idx: number, field: keyof UnitRow, value: string | boolean) => {
    setRows((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    if (error) setError(null); // clear validation error as soon as user edits anything
  };

  // Apply a column value to all included rows
  const applyToAll = (field: "type" | "view", value: string, label?: string) => {
    if (!value) return;
    const count = rows.filter((r) => r.include).length;
    setRows((r) => r.map((row) => row.include ? { ...row, [field]: value } : row));
    toast.success(`Set ${label ?? field} to ${value.replace(/_/g, " ")} on ${count} unit${count !== 1 ? "s" : ""}`);
    if (error) setError(null);
  };

  const applyNumericAll = (field: "area" | "price", mode: "SET" | "PERCENT" | "DELTA", rawValue: string) => {
    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) {
      toast.error("Enter a number first");
      return;
    }
    let count = 0;
    setRows((r) => r.map((row) => {
      if (!row.include) return row;
      const current = parseFloat(row[field] || "0");
      let next: number;
      if (mode === "SET")          next = value;
      else if (mode === "PERCENT") next = current * (1 + value / 100);
      else                         next = current + value;
      if (next <= 0) return row;
      count += 1;
      return { ...row, [field]: String(field === "area" ? Math.round(next * 10) / 10 : Math.round(next)) };
    }));
    const verb = mode === "SET" ? `set to ${value}` :
                 mode === "PERCENT" ? `${value >= 0 ? "+" : ""}${value}%` :
                 `${value >= 0 ? "+" : ""}${value}`;
    toast.success(`${field === "area" ? "Area" : "Price"} ${verb} on ${count} unit${count !== 1 ? "s" : ""}`);
    if (error) setError(null);
  };

  const validateAndPreview = () => {
    const toCreate = rows.filter((r) => r.include);
    if (toCreate.length === 0) { setError("Select at least one unit to create"); return; }
    const floorNum = parseInt(floor);
    if (!floorNum) { setError("Invalid floor number — go back to step 1"); return; }
    for (const row of toCreate) {
      if (!row.area  || parseFloat(row.area)  <= 0) { setError(`Unit ${floorNum}-${String(row.suffix).padStart(2, "0")}: area must be greater than 0`);  return; }
      if (!row.price || parseFloat(row.price) <= 0) { setError(`Unit ${floorNum}-${String(row.suffix).padStart(2, "0")}: price must be greater than 0`); return; }
    }
    setError(null);
    setStep("preview");
  };

  const handleSubmit = async () => {
    const toCreate = rows.filter((r) => r.include);
    const floorNum = parseInt(floor);
    setSubmitting(true);
    setError(null);
    try {
      const r = await axios.post("/api/units/bulk", {
        projectId,
        units: toCreate.map((row) => ({
          unitNumber: `${floorNum}-${String(row.suffix).padStart(2, "0")}`,
          floor: floorNum,
          type:  row.type,
          view:  row.view,
          area:  parseFloat(row.area),
          price: parseFloat(row.price),
        })),
      });
      setResult({ created: r.data.created, skipped: r.data.skipped, units: r.data.units });
      setStep("result");
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create units. Check values and try again.");
      setStep("layout");
    } finally {
      setSubmitting(false);
    }
  };

  const activeRows = rows.filter((r) => r.include).length;
  const floorNum = parseInt(floor) || 0;

  // Preview-step aggregations
  const previewSummary = useMemo(() => {
    const inc = rows.filter((r) => r.include);
    const byType: Record<string, number> = {};
    const byView: Record<string, number> = {};
    let totalArea = 0, totalPrice = 0;
    inc.forEach((r) => {
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      byView[r.view] = (byView[r.view] ?? 0) + 1;
      totalArea += parseFloat(r.area || "0");
      totalPrice += parseFloat(r.price || "0");
    });
    return { count: inc.length, byType, byView, totalArea, totalPrice };
  }, [rows]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-bold text-foreground">Add Floor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "config"  && "Step 1 of 3 — Set floor number and shared defaults"}
              {step === "layout"  && `Step 2 of 3 — Customise each unit · ${activeRows} of ${rows.length} selected`}
              {step === "preview" && `Step 3 of 3 — Review before creating ${activeRows} unit${activeRows !== 1 ? "s" : ""}`}
              {step === "result"  && "Done"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none" aria-label="Close">×</button>
        </div>

        {/* Step 1 — Config */}
        {step === "config" && (
          <form onSubmit={goToLayout} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Floor Number *</label>
                <input
                  required type="number" min="0"
                  value={floor} onChange={(e) => setFloor(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Units on this floor</label>
                <input
                  type="number" min="1" max="100"
                  value={configCount} onChange={(e) => setConfigCount(parseInt(e.target.value) || 8)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
                <p className="text-xs text-muted-foreground mt-0.5">Default from Project Config — adjust per floor</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Shared defaults — you can override per unit in the next step</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Default Type</label>
                  <select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring">
                    {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Default View</label>
                  <select value={defaultView} onChange={(e) => setDefaultView(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring">
                    {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Default Area (sqm) *</label>
                  <input required type="number" min="1" step="0.1" value={defaultArea} onChange={(e) => setDefaultArea(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Default Price (AED) *</label>
                  <input required type="number" min="1" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)}
                    placeholder="e.g. 1200000"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm">
                Configure Units →
              </button>
            </div>
          </form>
        )}

        {/* Step 2 — Per-unit layout */}
        {step === "layout" && (
          <>
            {/* "Apply to all" — categorical */}
            <div className="px-6 py-2 bg-muted/50 border-b border-border flex-shrink-0 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold w-20 shrink-0">Apply all:</span>
                <select onChange={(e) => { applyToAll("type", e.target.value, "Type"); e.currentTarget.value = ""; }} defaultValue=""
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card focus:outline-none">
                  <option value="" disabled>Set type…</option>
                  {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
                <select onChange={(e) => { applyToAll("view", e.target.value, "View"); e.currentTarget.value = ""; }} defaultValue=""
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card focus:outline-none">
                  <option value="" disabled>Set view…</option>
                  {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="ml-auto text-muted-foreground">{activeRows} units will be created</span>
              </div>

              {/* "Apply to all" — numeric */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold w-20 shrink-0">Price:</span>
                <select value={bulkPriceMode} onChange={(e) => setBulkPriceMode(e.target.value as any)}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card focus:outline-none">
                  <option value="SET">Set to</option>
                  <option value="PERCENT">% change</option>
                  <option value="DELTA">+/− AED</option>
                </select>
                <input type="number" value={bulkPriceValue} onChange={(e) => setBulkPriceValue(e.target.value)}
                  placeholder={bulkPriceMode === "PERCENT" ? "e.g. 5 or -3" : bulkPriceMode === "DELTA" ? "e.g. 50000" : "e.g. 1200000"}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card focus:outline-none w-32" />
                <button type="button" onClick={() => applyNumericAll("price", bulkPriceMode, bulkPriceValue)}
                  className="px-2 py-1 text-xs font-semibold bg-info-soft text-primary rounded hover:bg-info-soft">
                  Apply
                </button>

                <span className="font-semibold w-12 shrink-0 ml-3">Area:</span>
                <select value={bulkAreaMode} onChange={(e) => setBulkAreaMode(e.target.value as any)}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card focus:outline-none">
                  <option value="SET">Set to</option>
                  <option value="PERCENT">% change</option>
                  <option value="DELTA">+/− sqm</option>
                </select>
                <input type="number" value={bulkAreaValue} onChange={(e) => setBulkAreaValue(e.target.value)}
                  placeholder={bulkAreaMode === "PERCENT" ? "e.g. 5" : "e.g. 85"}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card focus:outline-none w-24" />
                <button type="button" onClick={() => applyNumericAll("area", bulkAreaMode, bulkAreaValue)}
                  className="px-2 py-1 text-xs font-semibold bg-info-soft text-primary rounded hover:bg-info-soft">
                  Apply
                </button>
              </div>
            </div>

            {/* Unit rows */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground w-8"></th>
                    <th className="px-3 py-2 text-left text-muted-foreground w-20">Unit No.</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">View</th>
                    <th className="px-3 py-2 text-left text-muted-foreground w-28">Area (sqm)</th>
                    <th className="px-3 py-2 text-left text-muted-foreground w-32">Price (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr key={idx} className={row.include ? "" : "opacity-40"}>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={row.include}
                          onChange={(e) => updateRow(idx, "include", e.target.checked)}
                          className="rounded" />
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold text-foreground">
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

            {error && <p className="mx-6 my-2 text-sm text-destructive bg-destructive-soft border border-destructive/30 px-3 py-2 rounded-lg">{error}</p>}

            <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={() => setStep("config")} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">← Back</button>
              <button
                onClick={validateAndPreview}
                disabled={activeRows === 0}
                className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50"
              >
                Preview {activeRows} unit{activeRows !== 1 ? "s" : ""} →
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Preview before submit */}
        {step === "preview" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-info-soft rounded-xl p-4">
                  <p className="text-3xl font-bold text-primary">{previewSummary.count}</p>
                  <p className="text-xs text-primary font-medium mt-1">Units to create on F{floorNum}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">
                    {Math.round(previewSummary.totalArea).toLocaleString("en-AE")}
                    <span className="text-sm font-medium text-muted-foreground ml-1">sqm</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Total area</p>
                </div>
                <div className="bg-success-soft rounded-xl p-4">
                  <p className="text-2xl font-bold text-success">
                    AED {(previewSummary.totalPrice / 1_000_000).toLocaleString("en-AE", { maximumFractionDigits: 2 })}M
                  </p>
                  <p className="text-xs text-success font-medium mt-1">Combined list price</p>
                </div>
              </div>

              {/* Type / view chips */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-muted-foreground mb-1.5">Mix by type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(previewSummary.byType).map(([t, c]) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-stage-active text-stage-active-foreground border border-accent-2/30">
                        {t.replace(/_/g, " ")} <span className="font-bold ml-1">{c}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground mb-1.5">Mix by view</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(previewSummary.byView).map(([v, c]) => (
                      <span key={v} className="px-2 py-0.5 rounded-full bg-warning-soft text-warning border border-warning/30">
                        {v} <span className="font-bold ml-1">{c}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Unit list */}
              <div>
                <p className="font-semibold text-muted-foreground text-xs mb-2">Units to be created (atomic — all or nothing)</p>
                <div className="bg-muted/50 border border-border rounded-lg max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">Unit No.</th>
                        <th className="px-3 py-1.5 text-left font-semibold">Type</th>
                        <th className="px-3 py-1.5 text-left font-semibold">View</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Area</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Price (AED)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.filter((r) => r.include).map((r) => (
                        <tr key={r.suffix}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-foreground">{floorNum}-{String(r.suffix).padStart(2, "0")}</td>
                          <td className="px-3 py-1.5 text-foreground">{r.type.replace(/_/g, " ")}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.view}</td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground">{r.area} sqm</td>
                          <td className="px-3 py-1.5 text-right text-foreground font-medium">{Number(r.price).toLocaleString("en-AE")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && <p className="text-sm text-destructive bg-destructive-soft border border-destructive/30 px-3 py-2 rounded-lg">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setStep("layout")}
                disabled={submitting}
                className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm"
              >
                ← Back to edit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50"
              >
                {submitting ? "Creating…" : `Create ${previewSummary.count} unit${previewSummary.count !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}

        {/* Step 4 — Result */}
        {step === "result" && result && (
          <div className="px-6 py-6 space-y-4">
            <div className="flex gap-4">
              <div className="bg-success-soft rounded-xl p-4 flex-1 text-center">
                <p className="text-3xl font-bold text-success">{result.created}</p>
                <p className="text-xs text-success font-medium mt-1">Units Created</p>
              </div>
              {result.skipped > 0 && (
                <div className="bg-warning-soft rounded-xl p-4 flex-1 text-center">
                  <p className="text-3xl font-bold text-warning">{result.skipped}</p>
                  <p className="text-xs text-warning font-medium mt-1">Skipped (already existed)</p>
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-muted text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
