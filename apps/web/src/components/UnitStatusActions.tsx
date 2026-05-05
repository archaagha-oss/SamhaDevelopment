import { useState } from "react";
import { Unit } from "../types";
import { useChangeStatus } from "../hooks/useUpdateUnit";
import { ApiError, ErrorType } from "../types/errors";

interface Props {
  unit: Unit;
  onError: (e: ApiError) => void;
}

const DEAL_OWNED = ["ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  NOT_RELEASED: { label: "Not Released",  color: "bg-gray-100 text-gray-700 border-gray-200" },
  AVAILABLE:    { label: "Available",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ON_HOLD:      { label: "On Hold",       color: "bg-orange-100 text-orange-700 border-orange-200" },
  RESERVED:     { label: "Reserved",      color: "bg-amber-100 text-amber-700 border-amber-200" },
  BOOKED:       { label: "Booked",        color: "bg-violet-100 text-violet-700 border-violet-200" },
  SOLD:         { label: "Sold",          color: "bg-red-100 text-red-700 border-red-200" },
  BLOCKED:      { label: "Blocked",       color: "bg-slate-200 text-slate-600 border-slate-300" },
  HANDED_OVER:  { label: "Handed Over",   color: "bg-teal-100 text-teal-700 border-teal-200" },
};

export default function UnitStatusActions({ unit, onError }: Props) {
  const changeStatus = useChangeStatus(unit.id);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  const display = STATUS_DISPLAY[unit.status] || STATUS_DISPLAY.AVAILABLE;
  const isDealOwned = DEAL_OWNED.includes(unit.status);

  const doChange = async (newStatus: string) => {
    try {
      await changeStatus.mutateAsync(newStatus);
      setShowBlockForm(false);
      setBlockReason("");
    } catch (err: any) {
      onError({
        type: ErrorType.CONFLICT,
        message: err.message || "Status change failed",
        code: 409,
      });
    }
  };

  const handleBlock = async () => {
    if (!blockReason.trim()) return;
    await doChange("BLOCKED");
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Status</p>

      {/* Current status badge */}
      <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-semibold mb-4 ${display.color}`}>
        {display.label}
      </div>

      {isDealOwned ? (
        <div className={`text-xs rounded-lg px-3 py-2 border ${unit.status === "ON_HOLD" ? "bg-orange-50 border-orange-100 text-orange-700" : "bg-slate-50 border-slate-100 text-slate-500"}`}>
          <span className="font-medium">{unit.status === "ON_HOLD" ? "On Hold — Offer Pending" : "Managed by deal system"}</span>
          {unit.status === "ON_HOLD" && unit.holdExpiresAt ? (
            <p className="mt-0.5">Hold expires {new Date(unit.holdExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</p>
          ) : (
            <p className="mt-0.5">Status changes are controlled by the active deal.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* NOT_RELEASED actions */}
          {unit.status === "NOT_RELEASED" && (
            <>
              <button
                onClick={() => doChange("AVAILABLE")}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Release to Market
              </button>
              <button
                onClick={() => setShowBlockForm(true)}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Block Unit
              </button>
            </>
          )}

          {/* AVAILABLE actions */}
          {unit.status === "AVAILABLE" && (
            <button
              onClick={() => setShowBlockForm(true)}
              disabled={changeStatus.isPending}
              className="w-full px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Block Unit
            </button>
          )}

          {/* BLOCKED actions */}
          {unit.status === "BLOCKED" && (
            <>
              <button
                onClick={() => doChange("AVAILABLE")}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Unblock — Make Available
              </button>
              <button
                onClick={() => doChange("NOT_RELEASED")}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Unlist (Not Released)
              </button>
            </>
          )}

          {/* Block reason form */}
          {showBlockForm && (
            <div className="mt-2 space-y-2 border-t border-slate-100 pt-3">
              <label className="text-xs font-semibold text-slate-600">Block reason (required)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Pending legal review..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBlock}
                  disabled={!blockReason.trim() || changeStatus.isPending}
                  className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {changeStatus.isPending ? "Blocking…" : "Confirm Block"}
                </button>
                <button
                  onClick={() => { setShowBlockForm(false); setBlockReason(""); }}
                  className="px-3 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
