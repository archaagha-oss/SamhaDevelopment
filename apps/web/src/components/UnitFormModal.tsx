import { useState } from "react";
import axios from "axios";

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
  parkingSpaces?: number | null;
  internalArea?: number | null;
  externalArea?: number | null;
  // SPA particulars
  areaSqft?: number | null;
  ratePerSqft?: number | null;
  smartHome?: boolean | null;
  anticipatedCompletionDate?: string | null;
}

interface Props {
  projectId: string;
  unit?: Unit;
  onClose: () => void;
  onSaved: () => void;
}

const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];
const LOCKED_STATUSES = ["RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";

export default function UnitFormModal({ projectId, unit, onClose, onSaved }: Props) {
  const isEdit = !!unit;
  const isLocked = isEdit && LOCKED_STATUSES.includes(unit!.status);

  const [form, setForm] = useState({
    unitNumber: unit?.unitNumber ?? "",
    floor: unit?.floor?.toString() ?? "",
    type: unit?.type ?? "STUDIO",
    area: unit?.area?.toString() ?? "",
    price: unit?.price?.toString() ?? "",
    view: unit?.view ?? "SEA",
    parkingSpaces: unit?.parkingSpaces?.toString() ?? "",
    internalArea: unit?.internalArea?.toString() ?? "",
    externalArea: unit?.externalArea?.toString() ?? "",
    areaSqft: unit?.areaSqft?.toString() ?? "",
    ratePerSqft: unit?.ratePerSqft?.toString() ?? "",
    smartHome: unit?.smartHome ? "yes" : unit?.smartHome === false ? "no" : "",
    anticipatedCompletionDate: unit?.anticipatedCompletionDate
      ? unit.anticipatedCompletionDate.slice(0, 10)
      : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: any = {
        floor: parseInt(form.floor),
        type: form.type,
        area: parseFloat(form.area),
        price: parseFloat(form.price),
        view: form.view,
      };
      if (form.parkingSpaces) payload.parkingSpaces = parseInt(form.parkingSpaces);
      if (form.internalArea) payload.internalArea = parseFloat(form.internalArea);
      if (form.externalArea) payload.externalArea = parseFloat(form.externalArea);
      if (form.areaSqft) payload.areaSqft = parseFloat(form.areaSqft);
      if (form.ratePerSqft) payload.ratePerSqft = parseFloat(form.ratePerSqft);
      if (form.smartHome === "yes") payload.smartHome = true;
      if (form.smartHome === "no") payload.smartHome = false;
      if (form.anticipatedCompletionDate) payload.anticipatedCompletionDate = form.anticipatedCompletionDate;

      if (!isEdit) {
        payload.projectId = projectId;
        payload.unitNumber = form.unitNumber;
        await axios.post("/api/units", payload);
      } else {
        await axios.patch(`/api/units/${unit!.id}`, payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save unit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{isEdit ? `Edit Unit ${unit!.unitNumber}` : "Add New Unit"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {isLocked && (
          <div className="mx-6 mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            This unit has an active deal — price, type, and area are locked. Only floor and view can be edited.
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Unit Number *</label>
              <input
                required={!isEdit}
                value={form.unitNumber}
                onChange={(e) => set("unitNumber", e.target.value)}
                placeholder="e.g. 3-02"
                disabled={isEdit}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Floor *</label>
              <input
                required
                type="number"
                min="0"
                value={form.floor}
                onChange={(e) => set("floor", e.target.value)}
                className={inp}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type *</label>
              <select
                required
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                disabled={isLocked}
                className={inp}
              >
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
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
                {UNIT_VIEWS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Area (sqm) *</label>
              <input
                required
                type="number"
                min="1"
                step="0.1"
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="e.g. 85"
                disabled={isLocked}
                className={inp}
              />
              <p className="text-xs text-blue-600 font-medium mt-1">
                = {Math.round(parseFloat(form.area || "0") * 10.764).toLocaleString()} sqft
              </p>
            </div>
            <div>
              <label className={lbl}>Price (AED) *</label>
              <input
                required
                type="number"
                min="1"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="e.g. 1200000"
                disabled={isLocked}
                className={inp}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Physical Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Parking Spaces</label>
                <input
                  type="number"
                  min="0"
                  value={form.parkingSpaces}
                  onChange={(e) => set("parkingSpaces", e.target.value)}
                  className={inp}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={lbl}>Suite Area (sqm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.internalArea}
                  onChange={(e) => set("internalArea", e.target.value)}
                  disabled={isLocked}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Balcony Area (sqm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.externalArea}
                  onChange={(e) => set("externalArea", e.target.value)}
                  disabled={isLocked}
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* SPA particulars — area in sqft, rate per sqft, smart home, anticipated date */}
          <details className="border border-slate-200 rounded-lg" open={isEdit}>
            <summary className="px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              SPA particulars
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Total Area (sqft)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.areaSqft}
                    onChange={(e) => set("areaSqft", e.target.value)}
                    disabled={isLocked}
                    placeholder="e.g. 424.96"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Rate per sqft (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.ratePerSqft}
                    onChange={(e) => set("ratePerSqft", e.target.value)}
                    disabled={isLocked}
                    placeholder="e.g. 1548.38"
                    className={inp}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <p className="text-xs text-slate-400 mt-0.5">Overrides project handover date for this unit's SPA</p>
                </div>
              </div>
            </div>
          </details>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
