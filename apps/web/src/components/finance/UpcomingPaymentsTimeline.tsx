import React, { useState } from "react";
import { UpcomingPayment } from "../../hooks/useFinanceDashboard";

interface UpcomingPaymentsTimelineProps {
  data: UpcomingPayment[];
  onNavigateDeal: (dealId: string) => void;
}

/**
 * UpcomingPaymentsTimeline - Timeline visualization of upcoming due dates
 * Shows payments organized by date over next 30 days
 *
 * Features:
 * - Expandable date groups
 * - Sorted chronologically
 * - Total amount per date
 * - Deal-specific drill-down
 * - Responsive design
 */
export default function UpcomingPaymentsTimeline({
  data,
  onNavigateDeal,
}: UpcomingPaymentsTimelineProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    new Set(data.slice(0, 3).map((item) => item.date))
  );

  const toggleDate = (date: string) => {
    const newSet = new Set(expandedDates);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setExpandedDates(newSet);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Determine relative day label
    let label = "";
    if (date.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      label = "Tomorrow";
    } else {
      label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }

    return label;
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil;
  };

  const getUrgencyColor = (daysUntil: number) => {
    if (daysUntil <= 3) return "border-l-red-500 bg-red-50";
    if (daysUntil <= 7) return "border-l-amber-500 bg-amber-50";
    return "border-l-blue-500 bg-blue-50";
  };

  const getUrgencyBadge = (daysUntil: number) => {
    if (daysUntil <= 0) return "bg-red-100 text-red-700";
    if (daysUntil <= 3) return "bg-red-100 text-red-700";
    if (daysUntil <= 7) return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-600">✓ No upcoming payments due in the next 30 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const isExpanded = expandedDates.has(item.date);
        const daysUntil = getDaysUntil(item.date);

        return (
          <div
            key={item.date}
            className={`border-l-4 rounded-lg p-4 transition-all cursor-pointer ${getUrgencyColor(daysUntil)} ${
              isExpanded ? "ring-2 ring-blue-200" : ""
            }`}
            onClick={() => toggleDate(item.date)}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">{formatDate(item.date)}</h4>
                <p className="text-xs text-slate-600">
                  {item.count} payments · AED {(item.totalAmount / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getUrgencyBadge(daysUntil)}`}>
                  {daysUntil}d
                </span>
                <span className={`text-xl transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="mt-4 space-y-2 border-t border-current border-opacity-20 pt-4">
                {item.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-2 bg-white rounded hover:shadow-sm transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{payment.dealNumber}</p>
                      <p className="text-xs text-slate-600">{payment.leadName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{payment.milestoneLabel}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="font-semibold text-slate-900 text-right whitespace-nowrap">
                        AED {payment.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateDeal(payment.id); // Assuming payment.id contains dealId
                        }}
                        className="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="border-t border-slate-200 pt-4 mt-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 rounded p-3">
            <p className="text-xs text-slate-600">Due Dates</p>
            <p className="text-lg font-bold text-slate-900">{data.length}</p>
          </div>
          <div className="bg-slate-50 rounded p-3">
            <p className="text-xs text-slate-600">Total Payments</p>
            <p className="text-lg font-bold text-slate-900">
              {data.reduce((sum, item) => sum + item.count, 0)}
            </p>
          </div>
          <div className="bg-slate-50 rounded p-3">
            <p className="text-xs text-slate-600">Total Due</p>
            <p className="text-lg font-bold text-slate-900">
              AED {(data.reduce((sum, item) => sum + item.totalAmount, 0) / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
