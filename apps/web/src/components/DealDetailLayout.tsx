import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import DealActivityPanel from "./DealActivityPanel";
import DealDetailContent from "./DealDetailContent";
import DealSummaryPanel from "./DealSummaryPanel";
import Breadcrumbs from "./Breadcrumbs";

interface Deal {
  id: string;
  dealNumber: string;
  stage: string;
  salePrice: number;
  discount: number;
  lead: { id: string; firstName: string; lastName: string; phone: string; email?: string };
  unit: { id: string; unitNumber: string; type: string; floor: number; area: number };
  brokerCompany?: { id: string; name: string } | null;
  brokerAgent?: { id: string; name: string } | null;
  reservationDate?: string;
  spaSignedDate?: string;
  oqoodRegisteredDate?: string;
  oqoodDeadline?: string;
  completedDate?: string;
  payments?: Array<{ id: string; amount: number; status: string }>;
  createdAt?: string;
}

interface Props {
  dealId?: string;
  onBack?: () => void;
}

/**
 * DealDetailLayout - Two-column responsive layout wrapper for deal details
 * 
 * Left column (60% desktop): Timeline + Activity
 * Right column (40% desktop): Summary + Payment Progress (sticky)
 * Mobile: Stacked vertically with tabs
 * 
 * This is a refactored layout of the full deal cockpit with improved UX
 */
export default function DealDetailLayout({ dealId: dealIdProp, onBack }: Props) {
  const params = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const dealId = dealIdProp ?? params.dealId ?? "";
  const handleBack = onBack ?? (() => navigate("/deals"));

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useLegacyLayout, setUseLegacyLayout] = useState(false);

  useEffect(() => {
    loadDeal();
  }, [dealId]);

  const loadDeal = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/deals/${dealId}`);
      setDeal(response.data.data || null);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to load deal";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (!deal) return;

    try {
      // Example: Handle stage advancement
      const nextStages: Record<string, string> = {
        RESERVATION_PENDING: "RESERVATION_CONFIRMED",
        RESERVATION_CONFIRMED: "SPA_PENDING",
        SPA_PENDING: "SPA_SENT",
        SPA_SENT: "SPA_SIGNED",
        SPA_SIGNED: "OQOOD_PENDING",
        OQOOD_PENDING: "OQOOD_REGISTERED",
        OQOOD_REGISTERED: "INSTALLMENTS_ACTIVE",
        INSTALLMENTS_ACTIVE: "HANDOVER_PENDING",
        HANDOVER_PENDING: "COMPLETED",
      };

      const nextStage = nextStages[deal.stage];
      if (!nextStage) {
        toast.info("No next stage available");
        return;
      }

      // Navigate to full deal detail page for now (transition placeholder)
      navigate(`/deals/${dealId}`);
      toast.success(`Advanced to ${nextStage.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error("Action failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </button>
        <div className="bg-destructive-soft border border-destructive/30 rounded-xl p-6 text-center">
          <p className="text-destructive font-medium">{error || "Deal not found"}</p>
          <button onClick={handleBack} className="mt-3 text-sm text-destructive underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/50">
      {/* Breadcrumb Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-6 py-4">
        <Breadcrumbs
          crumbs={[
            { label: "Deals", path: "/deals" },
            { label: deal.dealNumber },
          ]}
        />
      </div>

      {/* Three-Column Layout: Responsive */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        {/* Left Column: Timeline + Activity (25% on desktop) */}
        <div className="hidden lg:flex overflow-hidden flex-col border-r border-border">
          <DealActivityPanel
            dealId={dealId}
            stage={deal.stage}
            reservationDate={deal.reservationDate}
            spaSignedDate={deal.spaSignedDate}
            oqoodRegisteredDate={deal.oqoodRegisteredDate}
            oqoodDeadline={deal.oqoodDeadline}
            completedDate={deal.completedDate}
          />
        </div>

        {/* Middle Column: Content (Payments, Documents, Tasks, History) (50% on desktop) */}
        <div className="md:col-span-1 lg:col-span-2 overflow-hidden flex flex-col">
          <DealDetailContent
            dealId={dealId}
            deal={deal}
            onPaymentPaid={() => loadDeal()}
            onTaskCompleted={() => loadDeal()}
          />
        </div>

        {/* Right Column: Summary Panel (25% on desktop, sticky) */}
        <div className="hidden lg:flex flex-col h-full overflow-hidden sticky top-0">
          <DealSummaryPanel
            deal={deal}
            onPrimaryAction={handlePrimaryAction}
            primaryActionLabel="Next step"
            primaryActionColor="bg-primary hover:bg-primary/90"
          />
        </div>

        {/* Mobile: Activity on top (md:hidden) */}
        <div className="lg:hidden overflow-hidden flex flex-col border-b border-border">
          <DealActivityPanel
            dealId={dealId}
            stage={deal.stage}
            reservationDate={deal.reservationDate}
            spaSignedDate={deal.spaSignedDate}
            oqoodRegisteredDate={deal.oqoodRegisteredDate}
            oqoodDeadline={deal.oqoodDeadline}
            completedDate={deal.completedDate}
          />
        </div>
      </div>

      {/* Mobile Summary (visible only on mobile, below layout) */}
      <div className="lg:hidden flex-shrink-0 border-t border-border bg-card">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Deal</p>
              <p className="text-sm font-bold text-foreground">{deal.dealNumber}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {deal.lead.firstName} {deal.lead.lastName}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sale Price: AED {deal.salePrice.toLocaleString()}</span>
            <span>Unit: {deal.unit.unitNumber}</span>
          </div>
          <button
            onClick={handlePrimaryAction}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition"
          >
            Next Step
          </button>
        </div>
      </div>
    </div>
  );
}
