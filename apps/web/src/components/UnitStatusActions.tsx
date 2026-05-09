import { useState } from "react";
import { toast } from "sonner";
import { Unit } from "../types";
import { useChangeStatus } from "../hooks/useUpdateUnit";
import { ApiError, ErrorType } from "../types/errors";

interface Props {
  unit: Unit;
  onError: (e: ApiError) => void;
}

const DEAL_OWNED = ["ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  NOT_RELEASED: { label: "Not Released",  color: "bg-muted text-foreground border-border" },
  AVAILABLE:    { label: "Available",     color: "bg-success-soft text-success border-success/30" },
  ON_HOLD:      { label: "On Hold",       color: "bg-warning-soft text-warning border-warning/30" },
  RESERVED:     { label: "Reserved",      color: "bg-warning-soft text-warning border-warning/30" },
  BOOKED:       { label: "Booked",        color: "bg-stage-active text-stage-active-foreground border-accent-2/30" },
  SOLD:         { label: "Sold",          color: "bg-destructive-soft text-destructive border-destructive/30" },
  BLOCKED:      { label: "Blocked",       color: "bg-neutral-200 text-muted-foreground border-border" },
  HANDED_OVER:  { label: "Handed Over",   color: "bg-chart-5/15 text-chart-5 border-chart-5/30" },
};

type FormMode = "RELEASE" | "BLOCK" | "UNBLOCK" | "UNLIST" | null;

interface FormConfig {
  title: string;
  helper: string;
  placeholder: string;
  newStatus: string;
  confirmLabel: string;
  confirmTone: string;
  destructive?: boolean;
}

const FORM_CONFIG: Record<Exclude<FormMode, null>, FormConfig> = {
  RELEASE: {
    title:        "Release to market",
    helper:       "Adds this unit to the public inventory. Sales agents will be able to reserve and book it.",
    placeholder:  "e.g. Phase 1 launch — released after final pricing review",
    newStatus:    "AVAILABLE",
    confirmLabel: "Release unit",
    confirmTone:  "bg-success hover:bg-success/90",
  },
  UNBLOCK: {
    title:        "Unblock unit",
    helper:       "Returns the unit to available inventory.",
    placeholder:  "e.g. Legal review cleared, unit may be sold",
    newStatus:    "AVAILABLE",
    confirmLabel: "Unblock unit",
    confirmTone:  "bg-success hover:bg-success/90",
  },
  BLOCK: {
    title:        "Block unit",
    helper:       "Removes the unit from available inventory until unblocked.",
    placeholder:  "e.g. Pending legal review, structural inspection requested",
    newStatus:    "BLOCKED",
    confirmLabel: "Block unit",
    confirmTone:  "bg-warning hover:bg-warning/90",
    destructive:  true,
  },
  UNLIST: {
    title:        "Unlist (move to Not Released)",
    helper:       "Pulls the unit out of the released pool. Useful for soft-launch reshuffles.",
    placeholder:  "e.g. Holding back for next release wave",
    newStatus:    "NOT_RELEASED",
    confirmLabel: "Unlist unit",
    confirmTone:  "bg-neutral-700 hover:bg-neutral-600",
  },
};

export default function UnitStatusActions({ unit, onError }: Props) {
  const changeStatus = useChangeStatus(unit.id);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [reason, setReason]     = useState("");

  const display      = STATUS_DISPLAY[unit.status] || STATUS_DISPLAY.AVAILABLE;
  const isDealOwned  = DEAL_OWNED.includes(unit.status);

  const closeForm = () => { setFormMode(null); setReason(""); };

  // ─── Undo: revert the just-applied status change ───
  const undo = async (originalStatus: string, reasonHint: string) => {
    try {
      await changeStatus.mutateAsync({ newStatus: originalStatus, reason: `Undo: ${reasonHint}` });
      toast.success("Reverted");
    } catch (err: any) {
      toast.error(err?.message || "Could not undo — see audit log");
    }
  };

  const submitForm = async () => {
    if (!formMode) return;
    const cfg            = FORM_CONFIG[formMode];
    const trimmedReason  = reason.trim();
    if (!trimmedReason) return; // button is disabled but defend anyway
    const previousStatus = unit.status;
    try {
      await changeStatus.mutateAsync({ newStatus: cfg.newStatus, reason: trimmedReason });
      closeForm();
      // 30-second undo toast
      toast(`${cfg.confirmLabel.replace("unit", "").trim()} — ${unit.unitNumber}`, {
        description: `Status changed to ${STATUS_DISPLAY[cfg.newStatus]?.label ?? cfg.newStatus}.`,
        duration: 30_000,
        action: {
          label: "Undo",
          onClick: () => undo(previousStatus, trimmedReason),
        },
      });
    } catch (err: any) {
      onError({
        type:    ErrorType.CONFLICT,
        message: err?.message || "Status change failed",
        code:    409,
      });
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status</p>

      {/* Current status badge */}
      <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-semibold mb-4 ${display.color}`}>
        {display.label}
      </div>

      {isDealOwned ? (
        <div className={`text-xs rounded-lg px-3 py-2 border ${unit.status === "ON_HOLD" ? "bg-warning-soft border-warning/30 text-warning" : "bg-muted/50 border-border text-muted-foreground"}`}>
          <span className="font-medium">{unit.status === "ON_HOLD" ? "On Hold — Offer Pending" : "Managed by deal system"}</span>
          {unit.status === "ON_HOLD" && unit.holdExpiresAt ? (
            <p className="mt-0.5">Hold expires {new Date(unit.holdExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</p>
          ) : (
            <p className="mt-0.5">Status changes are controlled by the active deal.</p>
          )}
        </div>
      ) : !formMode ? (
        <div className="space-y-2">
          {/* NOT_RELEASED actions */}
          {unit.status === "NOT_RELEASED" && (
            <>
              <button
                onClick={() => { setFormMode("RELEASE"); setReason(""); }}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 bg-success hover:bg-success/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Release to market →
              </button>
              <button
                onClick={() => { setFormMode("BLOCK"); setReason(""); }}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 border border-border hover:bg-muted/50 text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Block unit
              </button>
            </>
          )}

          {/* AVAILABLE actions */}
          {unit.status === "AVAILABLE" && (
            <button
              onClick={() => { setFormMode("BLOCK"); setReason(""); }}
              disabled={changeStatus.isPending}
              className="w-full px-3 py-2 border border-warning/30 bg-warning-soft hover:bg-warning-soft text-warning-soft-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Block unit
            </button>
          )}

          {/* BLOCKED actions */}
          {unit.status === "BLOCKED" && (
            <>
              <button
                onClick={() => { setFormMode("UNBLOCK"); setReason(""); }}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 bg-success hover:bg-success/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Unblock — make available
              </button>
              <button
                onClick={() => { setFormMode("UNLIST"); setReason(""); }}
                disabled={changeStatus.isPending}
                className="w-full px-3 py-2 border border-border hover:bg-muted/50 text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Unlist (Not Released)
              </button>
            </>
          )}
        </div>
      ) : (
        // Confirmation + reason form (replaces the action buttons until cancelled)
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{FORM_CONFIG[formMode].title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{FORM_CONFIG[formMode].helper}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Reason (required for audit)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={FORM_CONFIG[formMode].placeholder}
              rows={2}
              autoFocus
              className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-ring resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitForm}
              disabled={!reason.trim() || changeStatus.isPending}
              className={`flex-1 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${FORM_CONFIG[formMode].confirmTone}`}
            >
              {changeStatus.isPending ? "Working…" : FORM_CONFIG[formMode].confirmLabel}
            </button>
            <button
              onClick={closeForm}
              disabled={changeStatus.isPending}
              className="px-3 py-2 border border-border text-sm rounded-lg hover:bg-muted/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
