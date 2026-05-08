import { useNavigate } from "react-router-dom";
import { Unit } from "../types";

interface Props {
  unit: Unit;
}

const STAGE_TONE: Record<string, string> = {
  RESERVATION_PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  RESERVATION_CONFIRMED:  "bg-amber-50 text-amber-700 border-amber-200",
  SPA_PENDING:            "bg-blue-50 text-blue-700 border-blue-200",
  SPA_SENT:               "bg-blue-50 text-blue-700 border-blue-200",
  SPA_SIGNED:             "bg-violet-50 text-violet-700 border-violet-200",
  OQOOD_PENDING:          "bg-violet-50 text-violet-700 border-violet-200",
  OQOOD_REGISTERED:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  INSTALLMENTS_ACTIVE:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  HANDOVER_PENDING:       "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPLETED:              "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED:              "bg-red-50 text-red-700 border-red-200",
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
    const tone  = STAGE_TONE[activeDeal.stage] ?? "bg-slate-100 text-slate-700 border-slate-200";
    return (
      <div className="bg-white rounded-lg border-l-4 border-violet-500 border border-slate-200 px-5 py-3.5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Active deal</span>
          <span className="font-mono text-xs font-semibold text-slate-700">{activeDeal.dealNumber}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={() => navigate(`/leads/${activeDeal.lead.id}`)}
          className="text-sm font-semibold text-slate-800 hover:text-blue-700 truncate"
          title="Open lead profile"
        >
          {buyer}
        </button>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`}>
          {activeDeal.stage.replace(/_/g, " ")}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900">
            AED {activeDeal.salePrice.toLocaleString("en-AE")}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/deals/${activeDeal.id}`)}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-md transition-colors"
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
      <div className={`bg-white rounded-lg border-l-4 border border-slate-200 px-5 py-3.5 flex items-center gap-4 flex-wrap ${urgent ? "border-l-red-500" : "border-l-amber-500"}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Reserved</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={() => navigate(`/leads/${activeReservation.lead.id}`)}
          className="text-sm font-semibold text-slate-800 hover:text-blue-700 truncate"
        >
          {buyer}
        </button>
        {activeReservation.lead.phone && (
          <span className="text-xs text-slate-500">{activeReservation.lead.phone}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className={`text-xs font-semibold ${urgent ? "text-red-600" : "text-slate-700"}`}>
            {days > 0 ? `${days}d remaining` : "Expired"}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/leads/${activeReservation.lead.id}`)}
            className="px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-md transition-colors"
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
      <div className="bg-white rounded-lg border-l-4 border-l-blue-400 border border-slate-200 px-5 py-3.5 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
          {interestCount} interested {interestCount === 1 ? "lead" : "leads"}
        </span>
        {primary && (
          <>
            <div className="h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => navigate(`/leads/${primary.lead.id}`)}
              className="text-sm font-semibold text-slate-800 hover:text-blue-700 truncate"
            >
              {primary.lead.firstName} {primary.lead.lastName}
              {primary.isPrimary && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Primary</span>}
            </button>
          </>
        )}
        {unit.status === "AVAILABLE" && (
          <button
            type="button"
            onClick={() => navigate(`/deals?unitId=${unit.id}`)}
            className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors"
          >
            + Create deal
          </button>
        )}
      </div>
    );
  }

  if (unit.status === "AVAILABLE") {
    return (
      <div className="bg-white rounded-lg border border-dashed border-slate-300 px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">No active deal, reservation, or interested leads yet</p>
        <button
          type="button"
          onClick={() => navigate(`/deals?unitId=${unit.id}`)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors"
        >
          + Create deal
        </button>
      </div>
    );
  }

  return null;
}
