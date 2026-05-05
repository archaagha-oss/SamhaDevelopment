import { useState, useEffect } from "react";
import axios from "axios";

interface AvailableUnit {
  id: string;
  unitNumber: string;
  type: string;
  floor: number;
  askingPrice: number;
  status: string;
  project?: { name: string };
}

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName?: string;
  onSuccess?: () => void;
}

function fmtAED(amount: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReservationModal({
  open,
  onClose,
  leadId,
  leadName,
  onSuccess,
}: ReservationModalProps) {
  const [units, setUnits]               = useState<AvailableUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [notes, setNotes]               = useState("");
  const [fetchingUnits, setFetchingUnits] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  // Reset & fetch AVAILABLE units whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setSelectedUnitId("");
    setNotes("");
    setError("");
    setFetchingUnits(true);
    axios
      .get("/api/units", { params: { status: "AVAILABLE", limit: 200 } })
      .then((res) => setUnits(res.data.data ?? res.data ?? []))
      .catch(() => setUnits([]))
      .finally(() => setFetchingUnits(false));
  }, [open]);

  if (!open) return null;

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;

  const handleSubmit = async () => {
    if (!selectedUnitId) {
      setError("Please select a unit.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/reservations", {
        unitId: selectedUnitId,
        leadId,
        notes: notes.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create reservation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-semibold text-base">Reserve Unit</h2>
            {leadName && (
              <p className="text-slate-500 text-xs mt-0.5">for {leadName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Unit selector */}
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1.5">
              Available Unit <span className="text-red-400">*</span>
            </label>

            {fetchingUnits ? (
              <p className="text-slate-500 text-sm py-2">Loading available units…</p>
            ) : units.length === 0 ? (
              <p className="text-amber-400 text-sm py-2">
                No available units at this time.
              </p>
            ) : (
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select a unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unitNumber}
                    {u.floor != null ? ` — Floor ${u.floor}` : ""}
                    {u.type ? ` — ${u.type}` : ""}
                    {" — "}
                    {fmtAED(u.askingPrice)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected unit preview card */}
          {selectedUnit && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold text-sm">
                  Unit {selectedUnit.unitNumber}
                </p>
                {selectedUnit.project?.name && (
                  <span className="text-xs text-slate-500">
                    {selectedUnit.project.name}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-slate-500 mb-0.5">Type</p>
                  <p className="text-slate-200 font-medium">{selectedUnit.type || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Floor</p>
                  <p className="text-slate-200 font-medium">{selectedUnit.floor ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Asking Price</p>
                  <p className="text-emerald-400 font-semibold">
                    {fmtAED(selectedUnit.askingPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1.5">
              Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for reservation, special requirements, client preferences…"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition-colors"
            />
          </div>

          {/* Expiry notice */}
          <div className="flex items-start gap-2.5 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5">
            <span className="text-amber-400 mt-0.5 flex-shrink-0">⏱</span>
            <p>
              The unit will be temporarily locked as{" "}
              <span className="text-amber-300 font-medium">RESERVED</span>. Reservations
              expire automatically based on the project configuration (typically 7–14
              days). You can convert this reservation into a deal at any time.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedUnitId || fetchingUnits || units.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Reserving…" : "Reserve Unit"}
          </button>
        </div>
      </div>
    </div>
  );
}
