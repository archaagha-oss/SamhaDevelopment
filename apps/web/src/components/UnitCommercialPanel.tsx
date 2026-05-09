import { useNavigate } from "react-router-dom";
import { Unit } from "../types";
import { formatAED } from "../lib/format";

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
        <div className="bg-card rounded-lg border border-accent-2/30 p-5">
          <p className="text-xs font-semibold text-accent-2 uppercase tracking-wide mb-3">Active Deal</p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Deal #</span>
              <span className="text-xs font-mono font-semibold text-foreground">{activeDeal.dealNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Buyer</span>
              <span className="text-xs font-semibold text-foreground">
                {activeDeal.lead.firstName} {activeDeal.lead.lastName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Stage</span>
              <span className="text-xs font-semibold text-primary bg-info-soft px-2 py-0.5 rounded-full">
                {DEAL_STAGE_LABELS[activeDeal.stage] || activeDeal.stage}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Sale Price</span>
              <span className="text-xs font-bold text-foreground">
                {formatAED(activeDeal.salePrice)}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/deals/${activeDeal.id}`)}
            className="w-full px-3 py-2 bg-accent-2 hover:bg-accent-2/90 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Open Deal
          </button>
        </div>
      )}

      {/* Active Reservation */}
      {activeReservation && (
        <div className="bg-card rounded-lg border border-warning/30 p-5">
          <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-3">Reservation</p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Reserved by</span>
              <span className="text-xs font-semibold text-foreground">
                {activeReservation.lead.firstName} {activeReservation.lead.lastName}
              </span>
            </div>
            {activeReservation.lead.phone && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Phone</span>
                <span className="text-xs text-foreground">{activeReservation.lead.phone}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Expires</span>
              <span className={`text-xs font-semibold ${daysUntil(activeReservation.expiresAt) <= 2 ? "text-destructive" : "text-foreground"}`}>
                {daysUntil(activeReservation.expiresAt) > 0
                  ? `${daysUntil(activeReservation.expiresAt)}d remaining`
                  : "Expired"}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/leads/${activeReservation.lead.id}`)}
            className="w-full px-3 py-2 border border-warning/30 bg-warning-soft hover:bg-warning-soft text-warning-soft-foreground text-xs font-semibold rounded-lg transition-colors"
          >
            View Lead Profile
          </button>
        </div>
      )}

      {/* Interested Leads */}
      {interests.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Interested Leads
              <span className="ml-2 bg-info-soft text-primary px-1.5 py-0.5 rounded-full text-xs font-bold">
                {interests.length}
              </span>
            </p>
          </div>
          <div className="space-y-2">
            {interests.slice(0, 4).map((interest) => (
              <button
                key={interest.leadId}
                onClick={() => navigate(`/leads/${interest.leadId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-info-soft text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {interest.lead.firstName[0]}{interest.lead.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {interest.lead.firstName} {interest.lead.lastName}
                    {interest.isPrimary && (
                      <span className="ml-1.5 text-[10px] bg-success-soft text-success px-1 py-0.5 rounded font-bold">Primary</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{interest.lead.stage?.replace(/_/g, " ")}</p>
                </div>
              </button>
            ))}
            {interests.length > 4 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{interests.length - 4} more</p>
            )}
          </div>

          {/* Create Deal CTA if unit is available */}
          {unit.status === "AVAILABLE" && (
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => navigate(`/deals?unitId=${unit.id}`)}
                className="w-full px-3 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Create Deal
              </button>
            </div>
          )}
        </div>
      )}

      {/* No context but available: CTA to create deal */}
      {!activeDeal && !activeReservation && interests.length === 0 && unit.status === "AVAILABLE" && (
        <div className="bg-card rounded-lg border border-dashed border-border p-5 text-center">
          <p className="text-xs text-muted-foreground mb-2">No active deal or leads yet</p>
          <button
            onClick={() => navigate(`/deals?unitId=${unit.id}`)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            + Create Deal
          </button>
        </div>
      )}
    </div>
  );
}
