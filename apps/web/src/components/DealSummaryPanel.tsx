import React, { useMemo } from "react";
import { formatAED } from "../lib/format";

interface DealSummaryPanelProps {
  deal: {
    id: string;
    dealNumber: string;
    stage: string;
    salePrice: number;
    lead: { id: string; firstName: string; lastName: string };
    unit: { id: string; unitNumber: string; type: string; floor: number; area: number };
    brokerCompany?: { id: string; name: string } | null;
    brokerAgent?: { id: string; name: string } | null;
    assignedAgent?: { id: string; name: string } | null;
    createdAt?: string;
    payments?: Array<{ id: string; amount: number; status: string }>;
  };
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  primaryActionColor?: string;
}

const STAGE_COLORS: Record<string, string> = {
  RESERVATION_PENDING: "bg-muted text-foreground",
  RESERVATION_CONFIRMED: "bg-info-soft text-primary",
  SPA_PENDING: "bg-warning-soft text-warning",
  SPA_SENT: "bg-warning-soft text-warning",
  SPA_SIGNED: "bg-stage-active text-stage-active-foreground",
  OQOOD_PENDING: "bg-warning-soft text-warning",
  OQOOD_REGISTERED: "bg-chart-5/15 text-chart-5",
  INSTALLMENTS_ACTIVE: "bg-stage-active text-stage-active-foreground",
  HANDOVER_PENDING: "bg-success-soft text-success",
  COMPLETED: "bg-success-soft text-success",
  CANCELLED: "bg-destructive-soft text-destructive",
};

/**
 * DealSummaryPanel - Right column (40%) of deal detail layout
 * 
 * Displays:
 * - Deal summary: buyer, unit, price, broker, start date
 * - Stage badge (color-coded)
 * - Payment progress bar
 * - Payment milestones table
 * - Documents section
 * - Primary action button (sticky)
 */
export default function DealSummaryPanel({
  deal,
  onPrimaryAction,
  primaryActionLabel = "Proceed",
  primaryActionColor = "bg-primary hover:bg-primary/90",
}: DealSummaryPanelProps): JSX.Element {
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-AE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calculate payment progress
  const paymentProgress = useMemo(() => {
    if (!deal.payments || deal.payments.length === 0) {
      return { paid: 0, total: deal.salePrice, percentage: 0 };
    }

    const paid = deal.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      paid,
      total: deal.salePrice,
      percentage: Math.round((paid / deal.salePrice) * 100),
    };
  }, [deal.payments, deal.salePrice]);

  const stageColor = STAGE_COLORS[deal.stage] || "bg-muted text-foreground";

  return (
    <div className="flex flex-col h-full bg-muted/50 border-l border-border">
      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-card border-b border-border p-6 space-y-4">
        {/* Deal Number & Stage */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Deal Number</p>
            <p className="text-lg font-bold text-foreground">{deal.dealNumber}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${stageColor}`}>
            {deal.stage.replace(/_/g, " ")}
          </span>
        </div>

        {/* Summary Grid */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buyer:</span>
            <span className="font-medium text-foreground">
              {deal.lead.firstName} {deal.lead.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unit:</span>
            <span className="font-medium text-foreground">{deal.unit.unitNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sale Price:</span>
            <span className="font-bold text-foreground">
              AED {deal.salePrice.toLocaleString()}
            </span>
          </div>
          {deal.brokerCompany && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Broker:</span>
              <span className="font-medium text-foreground">{deal.brokerCompany.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started:</span>
            <span className="font-medium text-foreground">
              {formatDate(deal.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Payment Progress */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Payment Progress</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatAED(paymentProgress.paid)} of {formatAED(paymentProgress.total)}
              </span>
              <span className="font-medium text-foreground">{paymentProgress.percentage}%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-success h-full transition-all duration-300"
                style={{ width: `${paymentProgress.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Payment Milestones */}
        {deal.payments && deal.payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Payment Milestones</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deal.payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`p-3 rounded-lg border text-sm ${
                    payment.status === "PAID"
                      ? "bg-success-soft border-success/30"
                      : "bg-warning-soft border-warning/30"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-medium">
                      AED {payment.amount.toLocaleString()}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        payment.status === "PAID"
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Primary Action Button */}
      <div className="flex-shrink-0 bg-card border-t border-border p-6">
        <button
          onClick={onPrimaryAction}
          className={`w-full px-4 py-3 text-white rounded-lg font-medium transition ${primaryActionColor}`}
        >
          {primaryActionLabel}
        </button>
      </div>
    </div>
  );
}
