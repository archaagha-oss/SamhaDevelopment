import { useNavigate } from "react-router-dom";
import { Unit } from "../types";
import { formatAED } from "../lib/format";

interface Props {
  unit: Unit;
}

const STAGE_TONE: Record<string, string> = {
  RESERVATION_PENDING:    "bg-warning-soft text-warning border-warning/30",
  RESERVATION_CONFIRMED:  "bg-warning-soft text-warning border-warning/30",
  SPA_PENDING:            "bg-info-soft text-primary border-primary/40",
  SPA_SENT:               "bg-info-soft text-primary border-primary/40",
  SPA_SIGNED:             "bg-stage-active text-stage-active-foreground border-accent-2/30",
  OQOOD_PENDING:          "bg-stage-active text-stage-active-foreground border-accent-2/30",
  OQOOD_REGISTERED:       "bg-success-soft text-success border-success/30",
  INSTALLMENTS_ACTIVE:    "bg-success-soft text-success border-success/30",
  HANDOVER_PENDING:       "bg-stage-active text-stage-active-foreground border-accent-2/30",
  COMPLETED:              "bg-muted text-muted-foreground border-border",
  CANCELLED:              "bg-destructive-soft text-destructive border-destructive/30",
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function ActiveDealSummaryCard({ unit }: Props) {
  const navigate = useNavigate();
  const activeDeal        = unit.deals?.[0];
  const activeReservation = unit.reservations?.[0];
  const interestCount     = unit.interests?.length ?? 0;

  if (activeDeal) {
    const buyer = `${activeDeal.lead.firstName} ${activeDeal.lead.lastName}`;
    const tone  = STAGE_TONE[activeDeal.stage] ?? "bg-muted text-foreground border-border";
    return (
      <div className="bg-card rounded-lg border-l-4 border-accent-2/30 border border-border px-5 py-3.5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-2">Active deal</span>
          <span className="font-mono text-xs font-semibold text-foreground">{activeDeal.dealNumber}</span>
        </div>
        <div className="h-4 w-px bg-neutral-200" />
        <button
          type="button"
          onClick={() => navigate(`/leads/${activeDeal.lead.id}`)}
          className="text-sm font-semibold text-foreground hover:text-primary truncate"
          title="Open lead profile"
        >
          {buyer}
        </button>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`}>
          {activeDeal.stage.replace(/_/g, " ")}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">
            {formatAED(activeDeal.salePrice)}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/deals/${activeDeal.id}`)}
            className="px-3 py-1.5 bg-accent-2 hover:bg-accent-2/90 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Open deal →
          </button>
        </div>
      </div>
    );
  }

  if (activeReservation) {
    const days = daysUntil(activeReservation.expiresAt);
    const urgent = days <= 2;
    const buyer  = `${activeReservation.lead.firstName} ${activeReservation.lead.lastName}`;
    return (
      <div className={`bg-card rounded-lg border-l-4 border border-border px-5 py-3.5 flex items-center gap-4 flex-wrap ${urgent ? "border-l-red-500" : "border-l-amber-500"}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">Reserved</span>
        </div>
        <div className="h-4 w-px bg-neutral-200" />
        <button
          type="button"
          onClick={() => navigate(`/leads/${activeReservation.lead.id}`)}
          className="text-sm font-semibold text-foreground hover:text-primary truncate"
        >
          {buyer}
        </button>
        {activeReservation.lead.phone && (
          <span className="text-xs text-muted-foreground">{activeReservation.lead.phone}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className={`text-xs font-semibold ${urgent ? "text-destructive" : "text-foreground"}`}>
            {days > 0 ? `${days}d remaining` : "Expired"}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/leads/${activeReservation.lead.id}`)}
            className="px-3 py-1.5 border border-warning/30 bg-warning-soft hover:bg-warning-soft text-warning-soft-foreground text-xs font-semibold rounded-md transition-colors"
          >
            View lead →
          </button>
        </div>
      </div>
    );
  }

  if (interestCount > 0) {
    const primary = unit.interests?.find((i) => i.isPrimary) ?? unit.interests?.[0];
    return (
      <div className="bg-card rounded-lg border-l-4 border-l-blue-400 border border-border px-5 py-3.5 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          {interestCount} interested {interestCount === 1 ? "lead" : "leads"}
        </span>
        {primary && (
          <>
            <div className="h-4 w-px bg-neutral-200" />
            <button
              type="button"
              onClick={() => navigate(`/leads/${primary.lead.id}`)}
              className="text-sm font-semibold text-foreground hover:text-primary truncate"
            >
              {primary.lead.firstName} {primary.lead.lastName}
              {primary.isPrimary && <span className="ml-2 text-[10px] bg-success-soft text-success px-1.5 py-0.5 rounded font-bold">Primary</span>}
            </button>
          </>
        )}
        {unit.status === "AVAILABLE" && (
          <button
            type="button"
            onClick={() => navigate(`/deals?unitId=${unit.id}`)}
            className="ml-auto px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-md transition-colors"
          >
            + Create deal
          </button>
        )}
      </div>
    );
  }

  if (unit.status === "AVAILABLE") {
    return (
      <div className="bg-card rounded-lg border border-dashed border-border px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">No active deal, reservation, or interested leads yet</p>
        <button
          type="button"
          onClick={() => navigate(`/deals?unitId=${unit.id}`)}
          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-md transition-colors"
        >
          + Create deal
        </button>
      </div>
    );
  }

  return null;
}
