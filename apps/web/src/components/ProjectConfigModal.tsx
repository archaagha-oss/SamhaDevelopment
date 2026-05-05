import { useState, useEffect } from "react";
import axios from "axios";

interface Props {
  projectId: string;
  onClose: () => void;
}

const DEFAULTS = { dldPercent: 4, adminFee: 5000, reservationDays: 7, oqoodDays: 90, vatPercent: 0, agencyFeePercent: 2, unitsPerFloor: 8 };

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-0.5";
const hint = "text-xs text-slate-400 mt-0.5";

export default function ProjectConfigModal({ projectId, onClose }: Props) {
  const [form, setForm] = useState({
    dldPercent: DEFAULTS.dldPercent.toString(),
    adminFee: DEFAULTS.adminFee.toString(),
    reservationDays: DEFAULTS.reservationDays.toString(),
    oqoodDays: DEFAULTS.oqoodDays.toString(),
    vatPercent: DEFAULTS.vatPercent.toString(),
    agencyFeePercent: DEFAULTS.agencyFeePercent.toString(),
    unitsPerFloor: DEFAULTS.unitsPerFloor.toString(),
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`/api/projects/${projectId}/config`)
      .then((r) => {
        const c = r.data;
        setForm({
          dldPercent: c.dldPercent?.toString() ?? DEFAULTS.dldPercent.toString(),
          adminFee: c.adminFee?.toString() ?? DEFAULTS.adminFee.toString(),
          reservationDays: c.reservationDays?.toString() ?? DEFAULTS.reservationDays.toString(),
          oqoodDays: c.oqoodDays?.toString() ?? DEFAULTS.oqoodDays.toString(),
          vatPercent: c.vatPercent?.toString() ?? DEFAULTS.vatPercent.toString(),
          agencyFeePercent: c.agencyFeePercent?.toString() ?? DEFAULTS.agencyFeePercent.toString(),
          unitsPerFloor: c.unitsPerFloor?.toString() ?? DEFAULTS.unitsPerFloor.toString(),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const set = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setSaved(false);
    try {
      await axios.patch(`/api/projects/${projectId}/config`, {
        dldPercent: parseFloat(form.dldPercent),
        adminFee: parseFloat(form.adminFee),
        reservationDays: parseInt(form.reservationDays),
        oqoodDays: parseInt(form.oqoodDays),
        vatPercent: parseFloat(form.vatPercent),
        agencyFeePercent: parseFloat(form.agencyFeePercent),
        unitsPerFloor: parseInt(form.unitsPerFloor),
      });
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save configuration");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Project Configuration</h2>
            <p className="text-xs text-slate-400 mt-0.5">Affects future deals — does not retroactively change existing ones</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>DLD %</label>
                <input type="number" min="0" max="100" step="0.1" value={form.dldPercent} onChange={(e) => set("dldPercent", e.target.value)} className={inp} />
                <p className={hint}>Dubai Land Dept fee on net price</p>
              </div>
              <div>
                <label className={lbl}>Admin Fee (AED)</label>
                <input type="number" min="0" value={form.adminFee} onChange={(e) => set("adminFee", e.target.value)} className={inp} />
                <p className={hint}>Fixed fee per deal</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Reservation Days</label>
                <input type="number" min="1" value={form.reservationDays} onChange={(e) => set("reservationDays", e.target.value)} className={inp} />
                <p className={hint}>Days a reservation holds the unit</p>
              </div>
              <div>
                <label className={lbl}>OQOOD Days</label>
                <input type="number" min="1" value={form.oqoodDays} onChange={(e) => set("oqoodDays", e.target.value)} className={inp} />
                <p className={hint}>Deadline for OQOOD registration</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>VAT %</label>
                <input type="number" min="0" max="100" step="0.1" value={form.vatPercent} onChange={(e) => set("vatPercent", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Agency Fee %</label>
                <input type="number" min="0" max="100" step="0.1" value={form.agencyFeePercent} onChange={(e) => set("agencyFeePercent", e.target.value)} className={inp} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="max-w-[160px]">
                <label className={lbl}>Units Per Floor</label>
                <input type="number" min="1" max="100" value={form.unitsPerFloor} onChange={(e) => set("unitsPerFloor", e.target.value)} className={inp} />
                <p className={hint}>Default number of units when adding a full floor</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {saved && <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">Configuration saved successfully.</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">
                {saved ? "Close" : "Cancel"}
              </button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                {submitting ? "Saving…" : "Save Config"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
