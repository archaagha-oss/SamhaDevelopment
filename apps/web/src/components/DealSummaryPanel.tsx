import React, { useMemo } from "react";

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
  RESERVATION_PENDING: "bg-slate-100 text-slate-700",
  RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
  SPA_PENDING: "bg-yellow-100 text-yellow-700",
  SPA_SENT: "bg-yellow-100 text-yellow-700",
  SPA_SIGNED: "bg-violet-100 text-violet-700",
  OQOOD_PENDING: "bg-orange-100 text-orange-700",
  OQOOD_REGISTERED: "bg-teal-100 text-teal-700",
  INSTALLMENTS_ACTIVE: "bg-indigo-100 text-indigo-700",
  HANDOVER_PENDING: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
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
  primaryActionColor = "bg-blue-600 hover:bg-blue-700",
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

  const stageColor = STAGE_COLORS[deal.stage] || "bg-gray-100 text-gray-700";

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 p-6 space-y-4">
        {/* Deal Number & Stage */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-600 font-medium">Deal Number</p>
            <p className="text-lg font-bold text-slate-900">{deal.dealNumber}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${stageColor}`}>
            {deal.stage.replace(/_/g, " ")}
          </span>
        </div>

        {/* Summary Grid */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Buyer:</span>
            <span className="font-medium text-slate-900">
              {deal.lead.firstName} {deal.lead.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Unit:</span>
            <span className="font-medium text-slate-900">{deal.unit.unitNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Sale Price:</span>
            <span className="font-bold text-slate-900">
              AED {deal.salePrice.toLocaleString()}
            </span>
          </div>
          {deal.brokerCompany && (
            <div className="flex justify-between">
              <span className="text-slate-600">Broker:</span>
              <span className="font-medium text-slate-900">{deal.brokerCompany.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Started:</span>
            <span className="font-medium text-slate-900">
              {formatDate(deal.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Payment Progress */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Progress</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                AED {paymentProgress.paid.toLocaleString()} of AED {paymentProgress.total.toLocaleString()}
              </span>
              <span className="font-medium text-slate-900">{paymentProgress.percentage}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${paymentProgress.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Payment Milestones */}
        {deal.payments && deal.payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Milestones</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deal.payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`p-3 rounded-lg border text-sm ${
                    payment.status === "PAID"
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-slate-900 font-medium">
                      AED {payment.amount.toLocaleString()}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        payment.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
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
      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-6">
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
