import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { formatDirham } from "@/lib/money";
import { DetailPageLayout, DetailPageNotFound } from "../components/layout";

// UnitsBulkPage — 4-step wizard for bulk-creating a floor of units at
// /projects/:projectId/units/bulk. Replaces BulkUnitModal.
//
// Steps: config → layout → preview → result.

interface UnitRow {
  suffix: number;     // position on floor, e.g. 1 → "5-01"
  type: string;
  view: string;
  area: string;
  price: string;
  include: boolean;
}

const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];

const inp = "border border-border rounded px-2 py-1 text-sm bg-muted/50 focus:outline-none focus:border-ring w-full";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const STEP_LABELS = ["Configure", "Layout", "Preview", "Result"] as const;
type Step = "config" | "layout" | "preview" | "result";
const STEP_INDEX: Record<Step, number> = { config: 0, layout: 1, preview: 2, result: 3 };

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

export default function UnitsBulkPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState<string>("");

  const [floor,        setFloor]        = useState("");
  const [defaultType,  setDefaultType]  = useState("TWO_BR");
  const [defaultView,  setDefaultView]  = useState("SEA");
  const [defaultArea,  setDefaultArea]  = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [configCount,  setConfigCount]  = useState(8);

  const [rows,       setRows]       = useState<UnitRow[]>([]);
  const [step,       setStep]       = useState<Step>("config");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [result,     setResult]     = useState<{ created: number; skipped: number } | null>(null);

  // Numeric apply-all UI state
  const [bulkPriceMode, setBulkPriceMode] = useState<"SET" | "PERCENT" | "DELTA">("SET");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkAreaMode, setBulkAreaMode]     = useState<"SET" | "PERCENT" | "DELTA">("SET");
  const [bulkAreaValue, setBulkAreaValue]   = useState("");

  useEffect(() => {
    if (!projectId) return;
    axios.get(`/api/projects/${projectId}`).then((r) => setProjectName(r.data?.name ?? "")).catch(() => {});
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

  const goToLayout = () => {
    setRows(buildRows(configCount, defaultType, defaultView, defaultArea, defaultPrice));
    setStep("layout");
    setError(null);
  };

  const updateRow = (idx: number, field: keyof UnitRow, value: string | boolean) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
    if (error) setError(null);
  };

  const applyToAll = (field: "type" | "view", value: string, label?: string) => {
    if (!value) return;
    const count = rows.filter((r) => r.include).length;
    setRows((r) => r.map((row) => (row.include ? { ...row, [field]: value } : row)));
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
    const floorNum = parseInt(floor, 10);
    if (!floorNum) { setError("Invalid floor number — go back to step 1"); return; }
    for (const row of toCreate) {
      const unitName = `${floorNum}-${String(row.suffix).padStart(2, "0")}`;
      if (!row.area  || parseFloat(row.area)  <= 0) { setError(`Unit ${unitName}: area must be greater than 0`);  return; }
      if (!row.price || parseFloat(row.price) <= 0) { setError(`Unit ${unitName}: price must be greater than 0`); return; }
    }
    setError(null);
    setStep("preview");
  };

  const submit = async () => {
    if (!projectId) return;
    const toCreate = rows.filter((r) => r.include);
    const floorNum = parseInt(floor, 10);
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
      setResult({ created: r.data.created, skipped: r.data.skipped });
      setStep("result");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create units. Check values and try again.");
      setStep("layout");
    } finally {
      setSubmitting(false);
    }
  };

  const activeRows = rows.filter((r) => r.include).length;
  const floorNum = parseInt(floor, 10) || 0;

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

  const projectCrumbs = [
    { label: "Home", path: "/" },
    { label: "Projects", path: "/projects" },
    ...(projectName ? [{ label: projectName, path: `/projects/${projectId}` }] : []),
  ];

  if (!projectId) {
    return (
      <DetailPageNotFound
        crumbs={[{ label: "Home", path: "/" }, { label: "Projects", path: "/projects" }]}
        title="Project required"
        message="Bulk unit creation needs a project. Pick a project from /projects first."
        backLabel="Back to projects"
        onBack={() => navigate("/projects")}
      />
    );
  }

  const stepIdx = STEP_INDEX[step];

  // Action buttons depend on step
  const actions = (
    <>
      <button
        type="button"
        onClick={() => navigate(`/projects/${projectId}`)}
        disabled={submitting}
        className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
      >
        {step === "result" ? "Close" : "Cancel"}
      </button>
      {step === "config" && (
        <button
          type="button"
          onClick={goToLayout}
          disabled={!floor || !defaultArea || !defaultPrice}
          className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
        >
          Configure units →
        </button>
      )}
      {step === "layout" && (
        <>
          <button
            type="button"
            onClick={() => setStep("config")}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={validateAndPreview}
            disabled={activeRows === 0}
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            Preview {activeRows} unit{activeRows !== 1 ? "s" : ""} →
          </button>
        </>
      )}
      {step === "preview" && (
        <>
          <button
            type="button"
            onClick={() => setStep("layout")}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            ← Back to edit
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-xs font-medium bg-success hover:bg-success/90 text-success-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating…" : `Create ${previewSummary.count} unit${previewSummary.count !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
      {step === "result" && (
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}`)}
          className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
        >
          Done
        </button>
      )}
    </>
  );

  return (
    <DetailPageLayout
      crumbs={[...projectCrumbs, { label: "Bulk add units" }]}
      title="Add a floor of units"
      subtitle={
        step === "config"  ? "Step 1 of 3 — set floor number and shared defaults" :
        step === "layout"  ? `Step 2 of 3 — customise each unit (${activeRows} of ${rows.length} selected)` :
        step === "preview" ? `Step 3 of 3 — review before creating ${activeRows} unit${activeRows !== 1 ? "s" : ""}` :
                             "Done"
      }
      actions={actions}
      hero={
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-0">
            {STEP_LABELS.map((label, i) => {
              const done    = i < stepIdx;
              const current = i === stepIdx;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                      done    ? "bg-primary border-primary text-primary-foreground" :
                      current ? "bg-background border-primary text-primary" :
                                "bg-muted border-border text-muted-foreground"
                    }`}>
                      {done ? <Check className="size-4" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold whitespace-nowrap ${
                      current ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"
                    }`}>
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < stepIdx ? "bg-primary/70" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      }
      main={
        <>
          {/* Step 1 — Config */}
          {step === "config" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Floor Number *</label>
                  <input
                    required type="number" min={0}
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className={lbl}>Units on this floor</label>
                  <input
                    type="number" min={1} max={100}
                    value={configCount}
                    onChange={(e) => setConfigCount(parseInt(e.target.value, 10) || 8)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Default from project config — adjust per floor.</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Shared defaults (override per unit in next step)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Default Type</label>
                    <select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring">
                      {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Default View</label>
                    <select value={defaultView} onChange={(e) => setDefaultView(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring">
                      {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Default Area (sqm) *</label>
                    <input
                      required type="number" min={1} step={0.1}
                      value={defaultArea}
                      onChange={(e) => setDefaultArea(e.target.value)}
                      placeholder="e.g. 85"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Default Price *</label>
                    <input
                      required type="number" min={1}
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                      placeholder="e.g. 1200000"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Layout */}
          {step === "layout" && (
            <>
              {/* Apply-to-all toolbar */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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

                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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

              {/* Per-unit table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-8"></th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20">Unit No.</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">View</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-28">Area (sqm)</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row, idx) => (
                        <tr key={idx} className={row.include ? "" : "opacity-40"}>
                          <td className="px-3 py-1.5">
                            <input type="checkbox" checked={row.include}
                              onChange={(e) => updateRow(idx, "include", e.target.checked)}
                              className="rounded accent-primary" />
                          </td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-foreground tabular-nums">
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
                            <input type="number" min={1} step={0.1} value={row.area} disabled={!row.include}
                              onChange={(e) => updateRow(idx, "area", e.target.value)} className={inp} />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" min={1} value={row.price} disabled={!row.include}
                              onChange={(e) => updateRow(idx, "price", e.target.value)} className={inp} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Preview */}
          {step === "preview" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-info-soft rounded-xl p-4">
                  <p className="text-3xl font-bold text-primary tabular-nums">{previewSummary.count}</p>
                  <p className="text-xs text-primary font-medium mt-1">Units to create on F{floorNum}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {Math.round(previewSummary.totalArea).toLocaleString("en-AE")}
                    <span className="text-sm font-medium text-muted-foreground ml-1">sqm</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Total area</p>
                </div>
                <div className="bg-success-soft rounded-xl p-4">
                  <p className="text-2xl font-bold text-success tabular-nums">
                    {formatDirham(previewSummary.totalPrice / 1_000_000, { decimals: 2 })}M
                  </p>
                  <p className="text-xs text-success font-medium mt-1">Combined list price</p>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1.5">Mix by type</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(previewSummary.byType).map(([t, c]) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-stage-active text-stage-active-foreground border border-accent-2/30">
                          {t.replace(/_/g, " ")} <span className="font-bold ml-1 tabular-nums">{c}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1.5">Mix by view</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(previewSummary.byView).map(([v, c]) => (
                        <span key={v} className="px-2 py-0.5 rounded-full bg-warning-soft text-warning border border-warning/30">
                          {v} <span className="font-bold ml-1 tabular-nums">{c}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <p className="px-5 py-3 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Units to be created — atomic (all or nothing)
                </p>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">Unit No.</th>
                        <th className="px-3 py-1.5 text-left font-semibold">Type</th>
                        <th className="px-3 py-1.5 text-left font-semibold">View</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Area</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.filter((r) => r.include).map((r) => (
                        <tr key={r.suffix}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-foreground tabular-nums">{floorNum}-{String(r.suffix).padStart(2, "0")}</td>
                          <td className="px-3 py-1.5 text-foreground">{r.type.replace(/_/g, " ")}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.view}</td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{r.area} sqm</td>
                          <td className="px-3 py-1.5 text-right text-foreground font-medium tabular-nums">{Number(r.price).toLocaleString("en-AE")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Step 4 — Result */}
          {step === "result" && result && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="bg-success-soft rounded-xl p-5 flex-1 text-center">
                  <p className="text-3xl font-bold text-success tabular-nums">{result.created}</p>
                  <p className="text-xs text-success font-medium mt-1 uppercase tracking-wide">Units created</p>
                </div>
                {result.skipped > 0 && (
                  <div className="bg-warning-soft rounded-xl p-5 flex-1 text-center">
                    <p className="text-3xl font-bold text-warning tabular-nums">{result.skipped}</p>
                    <p className="text-xs text-warning font-medium mt-1 uppercase tracking-wide">Skipped (already existed)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </>
      }
    />
  );
}
