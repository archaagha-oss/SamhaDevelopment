import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

interface Deal {
  id: string;
  dealNumber: string;
  lead: { firstName: string; lastName: string };
  unit: { unitNumber: string; type: string };
  stage: string;
  salePrice: number;
  discount: number;
  payments?: { status: string; amount: number }[];
  commission?: { status: string; amount: number };
}

const STAGES = [
  "RESERVATION_PENDING",
  "RESERVATION_CONFIRMED",
  "SPA_PENDING",
  "SPA_SENT",
  "SPA_SIGNED",
  "OQOOD_PENDING",
  "OQOOD_REGISTERED",
  "INSTALLMENTS_ACTIVE",
  "HANDOVER_PENDING",
  "COMPLETED",
  "CANCELLED",
];

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  RESERVATION_PENDING: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  RESERVATION_CONFIRMED: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  SPA_PENDING: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  SPA_SENT: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  SPA_SIGNED: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  OQOOD_PENDING: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  OQOOD_REGISTERED: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
  INSTALLMENTS_ACTIVE: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
  HANDOVER_PENDING: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  COMPLETED: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  CANCELLED: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
};

interface Props {
  deals: Deal[];
  isLoading: boolean;
  selectedStage: string | null;
  onViewDeal: (id: string) => void;
  onNavigate: (path: string) => void;
}

export default function DealsKanban({ deals, isLoading, selectedStage, onViewDeal, onNavigate }: Props) {
  const queryClient = useQueryClient();
  const [draggingDeal, setDraggingDeal] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [updatingDeal, setUpdatingDeal] = useState<string | null>(null);

  // Determine which stages to display
  const visibleStages = useMemo(() => {
    return selectedStage ? [selectedStage] : STAGES;
  }, [selectedStage]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    STAGES.forEach((stage) => {
      grouped[stage] = deals.filter((d) => d.stage === stage);
    });
    return grouped;
  }, [deals]);

  // Calculate payment progress
  const paymentProgress = (deal: Deal) => {
    if (!deal.payments?.length) return 0;
    return Math.round(
      (deal.payments.filter((p) => p.status === "PAID").length / deal.payments.length) * 100
    );
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, deal: Deal) => {
    setDraggingDeal(deal.id);
    setDragSource(deal.stage);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("dealId", deal.id);
  };

  // Handle drag over column
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStage: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");

    if (!dealId || !dragSource || dragSource === targetStage) {
      setDraggingDeal(null);
      setDragSource(null);
      return;
    }

    setUpdatingDeal(dealId);
    try {
      await axios.patch(`/api/deals/${dealId}/stage`, { newStage: targetStage });
      toast.success(`Deal moved to ${targetStage.replace(/_/g, " ")}`);
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to move deal";
      toast.error(errorMsg);
    } finally {
      setUpdatingDeal(null);
      setDraggingDeal(null);
      setDragSource(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalDeals = deals.length;

  return (
    <div className="flex-1 overflow-x-auto scrollbar-thin">
      <div className="inline-flex gap-4 p-4 h-full min-w-full">
        {visibleStages.map((stage) => {
          const stageDealCount = dealsByStage[stage].length;
          const colors = STAGE_COLORS[stage];

          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-80 ${colors.bg} rounded-xl border-2 ${colors.border} flex flex-col`}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`font-semibold text-sm ${colors.text}`}>{stage.replace(/_/g, " ")}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                    {stageDealCount}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {stageDealCount === 0
                    ? "No deals"
                    : stageDealCount === 1
                    ? "1 deal"
                    : `${stageDealCount} deals`}
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
                className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-thin"
              >
                {dealsByStage[stage].length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-slate-300 text-sm">
                    Drop deals here
                  </div>
                ) : (
                  dealsByStage[stage].map((deal) => {
                    const pct = paymentProgress(deal);
                    const isDragging = draggingDeal === deal.id;

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal)}
                        onClick={() => onViewDeal(deal.id)}
                        className={`p-3 bg-white rounded-lg border-2 border-slate-200 cursor-move transition-all ${
                          isDragging ? "opacity-50 scale-95" : ""
                        } ${updatingDeal === deal.id ? "opacity-75 pointer-events-none" : ""} hover:shadow-md hover:border-blue-400 group`}
                      >
                        {/* Deal header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs text-slate-400 truncate">{deal.dealNumber}</p>
                            <p className="font-semibold text-sm text-slate-800 group-hover:text-blue-600 truncate">
                              {deal.lead.firstName} {deal.lead.lastName}
                            </p>
                          </div>
                          {updatingDeal === deal.id && (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />
                          )}
                        </div>

                        {/* Unit info */}
                        <div className="mb-2 pb-2 border-b border-slate-100">
                          <p className="text-xs font-medium text-slate-700">
                            Unit: {deal.unit.unitNumber}
                          </p>
                          <p className="text-xs text-slate-400">{deal.unit.type}</p>
                        </div>

                        {/* Price & discount */}
                        <div className="mb-2">
                          <p className="text-xs text-slate-600">
                            <span className="font-semibold">AED {deal.salePrice.toLocaleString()}</span>
                            {deal.discount > 0 && (
                              <span className="text-emerald-600 ml-1">-{deal.discount.toLocaleString()}</span>
                            )}
                          </p>
                        </div>

                        {/* Payment progress */}
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{pct}%</span>
                          </div>
                        </div>

                        {/* Commission status */}
                        {deal.commission && (
                          <div className="text-xs">
                            {deal.commission.status === "PENDING_APPROVAL" && (
                              <span className="text-amber-600 font-semibold">⏳ Approval Pending</span>
                            )}
                            {deal.commission.status === "APPROVED" && (
                              <span className="text-blue-600 font-semibold">✓ Approved</span>
                            )}
                            {deal.commission.status === "PAID" && (
                              <span className="text-emerald-600 font-semibold">💰 Paid</span>
                            )}
                            {deal.commission.status === "NOT_DUE" && (
                              <span className="text-slate-400">— Not due</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
