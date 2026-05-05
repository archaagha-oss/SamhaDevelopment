import { useNavigate } from "react-router-dom";
import { Unit } from "../types";

interface Props {
  unit: Unit;
}

const DEAL_STAGE_LABELS: Record<string, string> = {
  ENQUIRY: "Enquiry", QUALIFICATION: "Qualification", SITE_VISIT: "Site Visit",
  NEGOTIATION: "Negotiation", OFFER_SENT: "Offer Sent", ACCEPTED: "Accepted",
  PENDING: "Pending", COMPLETED: "Completed", LOST: "Lost",
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function UnitCommercialPanel({ unit }: Props) {
  const navigate = useNavigate();
  const activeDeal = unit.deals?.[0];
  const activeReservation = unit.reservations?.[0];
  const interests = unit.interests ?? [];

  const hasCommercialContext = activeDeal || activeReservation || interests.length > 0;

  if (!hasCommercialContext && unit.status === "NOT_RELEASED") return null;

  return (
    <div className="space-y-3">
      {/* Active Deal */}
      {activeDeal && (
        <div className="bg-white rounded-lg border border-violet-200 p-5">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">Active Deal</p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Deal #</span>
              <span className="text-xs font-mono font-semibold text-slate-800">{activeDeal.dealNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Buyer</span>
              <span className="text-xs font-semibold text-slate-800">
                {activeDeal.lead.firstName} {activeDeal.lead.lastName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Stage</span>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {DEAL_STAGE_LABELS[activeDeal.stage] || activeDeal.stage}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Sale Price</span>
              <span className="text-xs font-bold text-slate-900">
                AED {activeDeal.salePrice.toLocaleString("en-AE")}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/deals/${activeDeal.id}`)}
            className="w-full px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Open Deal
          </button>
        </div>
      )}

      {/* Active Reservation */}
      {activeReservation && (
        <div className="bg-white rounded-lg border border-amber-200 p-5">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Reservation</p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Reserved by</span>
              <span className="text-xs font-semibold text-slate-800">
                {activeReservation.lead.firstName} {activeReservation.lead.lastName}
              </span>
            </div>
            {activeReservation.lead.phone && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Phone</span>
                <span className="text-xs text-slate-700">{activeReservation.lead.phone}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Expires</span>
              <span className={`text-xs font-semibold ${daysUntil(activeReservation.expiresAt) <= 2 ? "text-red-600" : "text-slate-800"}`}>
                {daysUntil(activeReservation.expiresAt) > 0
                  ? `${daysUntil(activeReservation.expiresAt)}d remaining`
                  : "Expired"}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/leads/${activeReservation.lead.id}`)}
            className="w-full px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg transition-colors"
          >
            View Lead Profile
          </button>
        </div>
      )}

      {/* Interested Leads */}
      {interests.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Interested Leads
              <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {interests.length}
              </span>
            </p>
          </div>
          <div className="space-y-2">
            {interests.slice(0, 4).map((interest) => (
              <button
                key={interest.leadId}
                onClick={() => navigate(`/leads/${interest.leadId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {interest.lead.firstName[0]}{interest.lead.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {interest.lead.firstName} {interest.lead.lastName}
                    {interest.isPrimary && (
                      <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">Primary</span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400">{interest.lead.stage?.replace(/_/g, " ")}</p>
                </div>
              </button>
            ))}
            {interests.length > 4 && (
              <p className="text-xs text-slate-400 text-center pt-1">+{interests.length - 4} more</p>
            )}
          </div>

          {/* Create Deal CTA if unit is available */}
          {unit.status === "AVAILABLE" && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => navigate(`/deals?unitId=${unit.id}`)}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Create Deal
              </button>
            </div>
          )}
        </div>
      )}

      {/* No context but available: CTA to create deal */}
      {!activeDeal && !activeReservation && interests.length === 0 && unit.status === "AVAILABLE" && (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-5 text-center">
          <p className="text-xs text-slate-400 mb-2">No active deal or leads yet</p>
          <button
            onClick={() => navigate(`/deals?unitId=${unit.id}`)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            + Create Deal
          </button>
        </div>
      )}
    </div>
  );
}
