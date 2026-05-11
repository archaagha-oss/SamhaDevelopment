import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Check, DollarSign } from "lucide-react";
import { formatDirham } from "@/lib/money";

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
  RESERVATION_PENDING: { bg: "bg-muted/50", border: "border-border", text: "text-foreground" },
  RESERVATION_CONFIRMED: { bg: "bg-info-soft", border: "border-primary/40", text: "text-primary" },
  SPA_PENDING: { bg: "bg-warning-soft", border: "border-warning/30", text: "text-warning" },
  SPA_SENT: { bg: "bg-warning-soft", border: "border-warning/30", text: "text-warning" },
  SPA_SIGNED: { bg: "bg-stage-active", border: "border-accent-2/30", text: "text-accent-2" },
  OQOOD_PENDING: { bg: "bg-warning-soft", border: "border-warning/30", text: "text-warning" },
  OQOOD_REGISTERED: { bg: "bg-chart-5/10", border: "border-chart-5/30", text: "text-chart-5" },
  INSTALLMENTS_ACTIVE: { bg: "bg-stage-active", border: "border-accent-2/30", text: "text-accent-2" },
  HANDOVER_PENDING: { bg: "bg-success-soft", border: "border-success/30", text: "text-success" },
  COMPLETED: { bg: "bg-success-soft", border: "border-success/30", text: "text-success" },
  CANCELLED: { bg: "bg-destructive-soft", border: "border-destructive/30", text: "text-destructive" },
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
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("kanban-collapsed-stages");
    return saved ? JSON.parse(saved) : {};
  });

  const toggleStageCollapse = (stage: string) => {
    setCollapsedStages((prev) => {
      const updated = { ...prev, [stage]: !prev[stage] };
      localStorage.setItem("kanban-collapsed-stages", JSON.stringify(updated));
      return updated;
    });
  };

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
        <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
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
          const isCollapsed = collapsedStages[stage] ?? false;

          return (
            <div
              key={stage}
              className={`flex-shrink-0 ${isCollapsed ? "w-20" : "w-80"} ${colors.bg} rounded-xl border-2 ${colors.border} flex flex-col transition-all duration-200`}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className={`flex-1 ${isCollapsed ? "hidden" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold text-sm ${colors.text}`}>{stage.replace(/_/g, " ")}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                      {stageDealCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stageDealCount === 0
                      ? "No deals"
                      : stageDealCount === 1
                      ? "1 deal"
                      : `${stageDealCount} deals`}
                  </p>
                </div>
                {isCollapsed && (
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
                      {stageDealCount}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => toggleStageCollapse(stage)}
                  title={isCollapsed ? "Expand" : "Collapse"}
                  className={`text-xs font-semibold ${colors.text} hover:opacity-70 transition-opacity ml-2`}
                >
                  {isCollapsed ? "▶" : "◀"}
                </button>
              </div>

              {/* Drop zone */}
              {!isCollapsed && (
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
                className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-thin"
              >
                {dealsByStage[stage].length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-foreground/80 text-sm">
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
                        className={`p-3 bg-card rounded-lg border-2 border-border cursor-move transition-all ${
                          isDragging ? "opacity-50 scale-95" : ""
                        } ${updatingDeal === deal.id ? "opacity-75 pointer-events-none" : ""} hover:shadow-md hover:border-primary/40 group`}
                      >
                        {/* Deal header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs text-muted-foreground truncate">{deal.dealNumber}</p>
                            <p className="font-semibold text-sm text-foreground group-hover:text-primary truncate">
                              {deal.lead.firstName} {deal.lead.lastName}
                            </p>
                          </div>
                          {updatingDeal === deal.id && (
                            <div className="w-4 h-4 border-2 border-primary/40 border-t-transparent rounded-full animate-spin ml-2" />
                          )}
                        </div>

                        {/* Unit info */}
                        <div className="mb-2 pb-2 border-b border-border">
                          <p className="text-xs font-medium text-foreground">
                            Unit: {deal.unit.unitNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">{deal.unit.type}</p>
                        </div>

                        {/* Price & discount */}
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold">{formatDirham(deal.salePrice)}</span>
                            {deal.discount > 0 && (
                              <span className="text-success ml-1">-{deal.discount.toLocaleString()}</span>
                            )}
                          </p>
                        </div>

                        {/* Payment progress */}
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-neutral-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
                          </div>
                        </div>

                        {/* Commission status */}
                        {deal.commission && (
                          <div className="text-xs">
                            {deal.commission.status === "PENDING_APPROVAL" && (
                              <span className="text-warning font-semibold">⏳ Approval Pending</span>
                            )}
                            {deal.commission.status === "APPROVED" && (
                              <span className="text-primary font-semibold inline-flex items-center gap-1"><Check className="size-3" /> Approved</span>
                            )}
                            {deal.commission.status === "PAID" && (
                              <span className="text-success font-semibold inline-flex items-center gap-1"><DollarSign className="size-3" /> Paid</span>
                            )}
                            {deal.commission.status === "NOT_DUE" && (
                              <span className="text-muted-foreground">— Not due</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
