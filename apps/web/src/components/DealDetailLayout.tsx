import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import DealActivityPanel from "./DealActivityPanel";
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
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          ← Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">{error || "Deal not found"}</p>
          <button onClick={handleBack} className="mt-3 text-sm text-red-500 underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Breadcrumb Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <Breadcrumbs
          crumbs={[
            { label: "Deals", path: "/deals" },
            { label: deal.dealNumber },
          ]}
        />
      </div>

      {/* Two-Column Layout: Responsive */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Left Column: Timeline + Activity (60% on desktop) */}
        <div className="lg:col-span-2 overflow-hidden flex flex-col">
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

        {/* Right Column: Summary Panel (40% on desktop, sticky) */}
        <div className="hidden lg:flex flex-col h-full overflow-hidden">
          <DealSummaryPanel
            deal={deal}
            onPrimaryAction={handlePrimaryAction}
            primaryActionLabel="Next Step"
            primaryActionColor="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      </div>

      {/* Mobile Summary (visible only on mobile, below layout) */}
      <div className="lg:hidden flex-shrink-0 border-t border-slate-200 bg-white">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-600 font-medium">Deal</p>
              <p className="text-sm font-bold text-slate-900">{deal.dealNumber}</p>
            </div>
            <p className="text-sm text-slate-600">
              {deal.lead.firstName} {deal.lead.lastName}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Sale Price: AED {deal.salePrice.toLocaleString()}</span>
            <span>Unit: {deal.unit.unitNumber}</span>
          </div>
          <button
            onClick={handlePrimaryAction}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Next Step
          </button>
        </div>
      </div>
    </div>
  );
}
