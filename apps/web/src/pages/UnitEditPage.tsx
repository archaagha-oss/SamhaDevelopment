import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";
import { extractApiError } from "@/lib/apiError";

// UnitEditPage — handles both create and edit:
//   /projects/:projectId/units/new                 → create
//   /projects/:projectId/units/:unitId/edit        → edit
//
// Replaces UnitFormModal. Pattern matches MemberEditPage / DealEditPage /
// LeadEditPage from earlier Phase C migrations.

interface Unit {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  area: number;
  basePrice?: number;
  price: number;
  view: string;
  status: string;
  projectId?: string;
  parkingSpaces?: number | null;
  internalArea?: number | null;
  externalArea?: number | null;
  // SPA particulars
  areaSqft?: number | null;
  ratePerSqft?: number | null;
  smartHome?: boolean | null;
  anticipatedCompletionDate?: string | null;
  // _count.deals is used to decide whether unitNumber is still editable.
  // Server adds it to GET /:id. Zero deals (active OR cancelled) = identity
  // still mutable so a typo at creation can be fixed without delete+recreate.
  _count?: { deals: number };
}

const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];
// Once a unit has an active deal, only floor and view are editable.
const LOCKED_STATUSES = ["RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];

const inp =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const BLANK = {
  unitNumber: "", floor: "", type: "STUDIO", area: "", price: "", view: "SEA",
  parkingSpaces: "", internalArea: "", externalArea: "",
  areaSqft: "", ratePerSqft: "", smartHome: "" as "" | "yes" | "no",
  anticipatedCompletionDate: "",
};

export default function UnitEditPage() {
  const { projectId, unitId } = useParams<{ projectId: string; unitId?: string }>();
  const navigate = useNavigate();
  const isEdit = !!unitId;

  const [projectName, setProjectName] = useState<string>("");
  const [unit,        setUnit]        = useState<Unit | null>(null);
  const [loading,     setLoading]     = useState(isEdit);
  const [loadError,   setLoadError]   = useState(false);

  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Load project name (used in subtitle/crumbs) + the unit (edit mode only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tasks: Promise<unknown>[] = [];
        if (projectId) {
          tasks.push(
            axios.get(`/api/projects/${projectId}`)
              .then((r) => { if (!cancelled) setProjectName(r.data?.name ?? ""); })
              .catch(() => {}),
          );
        }
        if (isEdit && unitId) {
          tasks.push(
            axios.get(`/api/units/${unitId}`)
              .then((r) => {
                if (cancelled) return;
                const u = r.data as Unit;
                setUnit(u);
                setForm({
                  unitNumber:                u.unitNumber ?? "",
                  floor:                     u.floor != null ? String(u.floor) : "",
                  type:                      u.type ?? "STUDIO",
                  area:                      u.area != null ? String(u.area) : "",
                  price:                     u.price != null ? String(u.price) : "",
                  view:                      u.view ?? "SEA",
                  parkingSpaces:             u.parkingSpaces != null ? String(u.parkingSpaces) : "",
                  internalArea:              u.internalArea != null ? String(u.internalArea) : "",
                  externalArea:              u.externalArea != null ? String(u.externalArea) : "",
                  areaSqft:                  u.areaSqft != null ? String(u.areaSqft) : "",
                  ratePerSqft:               u.ratePerSqft != null ? String(u.ratePerSqft) : "",
                  smartHome:                 u.smartHome === true ? "yes" : u.smartHome === false ? "no" : "",
                  anticipatedCompletionDate: u.anticipatedCompletionDate ? u.anticipatedCompletionDate.slice(0, 10) : "",
                });
              })
              .catch(() => { if (!cancelled) setLoadError(true); }),
          );
        }
        await Promise.all(tasks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, isEdit, unitId]);

  const set = (k: keyof typeof BLANK, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isLocked = !!unit && LOCKED_STATUSES.includes(unit.status);
  // unitNumber is locked once the unit has any deal history (active or
  // cancelled). Before that, the operator can fix typos in place.
  const unitNumberLocked = isEdit && !!unit && (unit._count?.deals ?? 0) > 0;
  const cancelTo = isEdit && projectId && unitId
    ? `/projects/${projectId}/units/${unitId}`
    : projectId
      ? `/projects/${projectId}`
      : "/units";

  async function submit() {
    if (!projectId) {
      setError("Project context missing.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        floor: parseInt(form.floor, 10),
        type: form.type,
        area: parseFloat(form.area),
        price: parseFloat(form.price),
        view: form.view,
      };
      if (form.parkingSpaces) payload.parkingSpaces = parseInt(form.parkingSpaces, 10);
      if (form.internalArea)  payload.internalArea  = parseFloat(form.internalArea);
      if (form.externalArea)  payload.externalArea  = parseFloat(form.externalArea);
      if (form.areaSqft)      payload.areaSqft      = parseFloat(form.areaSqft);
      if (form.ratePerSqft)   payload.ratePerSqft   = parseFloat(form.ratePerSqft);
      if (form.smartHome === "yes") payload.smartHome = true;
      if (form.smartHome === "no")  payload.smartHome = false;
      if (form.anticipatedCompletionDate) payload.anticipatedCompletionDate = form.anticipatedCompletionDate;

      if (isEdit && unitId) {
        // Include unitNumber only when changed AND still editable. Sending
        // it unchanged would trigger no-op writes; sending it when locked
        // would be rejected by the server with UNIT_NUMBER_LOCKED.
        if (!unitNumberLocked && form.unitNumber && form.unitNumber !== unit?.unitNumber) {
          payload.unitNumber = form.unitNumber;
        }
        await axios.patch(`/api/units/${unitId}`, payload);
        toast.success(`Unit ${unit?.unitNumber ?? unitId.slice(0, 6)} updated`);
        navigate(`/projects/${projectId}/units/${unitId}`);
      } else {
        payload.projectId = projectId;
        payload.unitNumber = form.unitNumber;
        const r = await axios.post("/api/units", payload);
        const newId = r.data?.id;
        toast.success("Unit created");
        navigate(newId ? `/projects/${projectId}/units/${newId}` : `/projects/${projectId}`);
      }
    } catch (err: any) {
      setError(extractApiError(err, "Failed to save unit"));
    } finally {
      setSubmitting(false);
    }
  }

  // Derived crumbs
  const crumbs = isEdit && unit
    ? [
        { label: "Home", path: "/" },
        { label: "Projects", path: "/projects" },
        ...(projectName ? [{ label: projectName, path: `/projects/${projectId}` }] : []),
        { label: `Unit ${unit.unitNumber}`, path: `/projects/${projectId}/units/${unitId}` },
        { label: "Edit" },
      ]
    : [
        { label: "Home", path: "/" },
        { label: "Projects", path: "/projects" },
        ...(projectName ? [{ label: projectName, path: `/projects/${projectId}` }] : []),
        { label: "New unit" },
      ];

  if (loading) return <DetailPageLoading crumbs={crumbs} title={isEdit ? "Loading unit…" : "Create unit"} />;

  if (isEdit && (loadError || !unit)) {
    return (
      <DetailPageNotFound
        crumbs={crumbs}
        title="Unit not found"
        message="This unit could not be loaded. It may have been deleted."
        backLabel="Back to project"
        onBack={() => navigate(projectId ? `/projects/${projectId}` : "/units")}
      />
    );
  }

  // Live sqft conversion display
  const sqftFromSqm = Math.round(parseFloat(form.area || "0") * 10.764);

  return (
    <DetailPageLayout
      crumbs={crumbs}
      title={isEdit ? `Edit unit ${unit?.unitNumber ?? ""}` : "Create unit"}
      subtitle={
        isEdit
          ? `${projectName ? `${projectName} · ` : ""}status ${unit?.status.replace(/_/g, " ").toLowerCase()}`
          : projectName ? `Adding to ${projectName}` : "Add a new unit to the project."
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate(cancelTo)}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create unit"}
          </button>
        </>
      }
      main={
        <>
          {isLocked && (
            <div className="bg-warning-soft border border-warning/30 rounded-lg px-4 py-2.5 text-xs text-warning">
              This unit has an active deal — type, area, price, suite area, and balcony area are locked. Only floor and view can be edited.
            </div>
          )}

          {/* Identity */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Unit Number{!isEdit && " *"}</label>
                <input
                  required={!isEdit}
                  value={form.unitNumber}
                  onChange={(e) => set("unitNumber", e.target.value)}
                  placeholder="e.g. 3-02"
                  disabled={unitNumberLocked}
                  className={inp}
                />
                {isEdit && unitNumberLocked && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Locked — a deal references this unit. Typos can no longer be fixed in place.
                  </p>
                )}
                {isEdit && !unitNumberLocked && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Editable until the first deal is created on this unit.
                  </p>
                )}
              </div>
              <div>
                <label className={lbl}>Floor *</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={form.floor}
                  onChange={(e) => set("floor", e.target.value)}
                  className={inp}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Type *</label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  disabled={isLocked}
                  className={inp}
                >
                  {UNIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>View *</label>
                <select
                  required
                  value={form.view}
                  onChange={(e) => set("view", e.target.value)}
                  className={inp}
                >
                  {UNIT_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing & area */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pricing & area</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Area (sqm) *</label>
                <input
                  required type="number" min={1} step={0.1}
                  value={form.area}
                  onChange={(e) => set("area", e.target.value)}
                  placeholder="e.g. 85"
                  disabled={isLocked}
                  className={inp}
                />
                {form.area && (
                  <p className="text-xs text-primary font-medium mt-1 tabular-nums">
                    = {sqftFromSqm.toLocaleString()} sqft
                  </p>
                )}
              </div>
              <div>
                <label className={lbl}>Price *</label>
                <input
                  required type="number" min={1}
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="e.g. 1200000"
                  disabled={isLocked}
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* Physical details */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Physical details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Parking Spaces</label>
                <input
                  type="number" min={0}
                  value={form.parkingSpaces}
                  onChange={(e) => set("parkingSpaces", e.target.value)}
                  className={inp}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Suite Area (sqm)</label>
                <input
                  type="number" min={0} step={0.1}
                  value={form.internalArea}
                  onChange={(e) => set("internalArea", e.target.value)}
                  disabled={isLocked}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Balcony Area (sqm)</label>
                <input
                  type="number" min={0} step={0.1}
                  value={form.externalArea}
                  onChange={(e) => set("externalArea", e.target.value)}
                  disabled={isLocked}
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* SPA particulars */}
          <details
            className="bg-card rounded-xl border border-border"
            open={isEdit && !!(unit?.areaSqft || unit?.ratePerSqft || unit?.smartHome != null || unit?.anticipatedCompletionDate)}
          >
            <summary className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
              SPA particulars
            </summary>
            <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Total Area (sqft)</label>
                  <input
                    type="number" min={0} step={0.01}
                    value={form.areaSqft}
                    onChange={(e) => set("areaSqft", e.target.value)}
                    disabled={isLocked}
                    placeholder="e.g. 424.96"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Rate per sqft</label>
                  <input
                    type="number" min={0} step={0.01}
                    value={form.ratePerSqft}
                    onChange={(e) => set("ratePerSqft", e.target.value)}
                    disabled={isLocked}
                    placeholder="e.g. 1548.38"
                    className={inp}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Smart Home</label>
                  <select
                    value={form.smartHome}
                    onChange={(e) => set("smartHome", e.target.value)}
                    className={inp}
                  >
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Anticipated Completion</label>
                  <input
                    type="date"
                    value={form.anticipatedCompletionDate}
                    onChange={(e) => set("anticipatedCompletionDate", e.target.value)}
                    className={inp}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Overrides project handover date for this unit's SPA.
                  </p>
                </div>
              </div>
            </div>
          </details>

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
