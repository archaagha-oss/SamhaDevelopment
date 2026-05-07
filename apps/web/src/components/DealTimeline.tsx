import React from "react";

interface TimelineProps {
  stage: string;
  reservationDate?: string;
  spaSignedDate?: string;
  oqoodRegisteredDate?: string;
  oqoodDeadline?: string;
  completedDate?: string;
}

const MILESTONE_ORDER = [
  { key: "reservation", label: "Reservation Confirmed", icon: "🔒", stages: ["RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT", "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
  { key: "spa", label: "SPA Signed", icon: "✍️", stages: ["SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
  { key: "oqood", label: "Oqood Registered", icon: "📋", stages: ["OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
  { key: "handover", label: "Handover", icon: "🎉", stages: ["HANDOVER_PENDING", "COMPLETED"] },
  { key: "completed", label: "Deal Completed", icon: "✅", stages: ["COMPLETED"] },
];

export default function DealTimeline({ stage, reservationDate, spaSignedDate, oqoodRegisteredDate, oqoodDeadline, completedDate }: TimelineProps) {
  const getStatus = (milestone: typeof MILESTONE_ORDER[0]) => {
    if (milestone.stages.includes(stage)) return "active";
    if (stage === "CANCELLED") return "cancelled";
    const currentIdx = MILESTONE_ORDER.findIndex((m) => m.stages.includes(stage));
    const milestoneIdx = MILESTONE_ORDER.indexOf(milestone);
    return milestoneIdx < currentIdx ? "completed" : "pending";
  };

  const getDate = (key: string) => {
    switch (key) {
      case "reservation": return reservationDate;
      case "spa": return spaSignedDate;
      case "oqood": return oqoodRegisteredDate;
      case "completed": return completedDate;
      default: return undefined;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getDaysRemaining = () => {
    if (!oqoodDeadline) return null;
    const deadline = new Date(oqoodDeadline);
    const today = new Date();
    const days = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return null;
    return days;
  };

  const daysRemaining = getDaysRemaining();
  const isOqoodUrgent = daysRemaining !== null && daysRemaining <= 30;

  return (
    <div className="px-5 py-6 space-y-6">
      {/* Timeline visualization */}
      <div className="space-y-4">
        {MILESTONE_ORDER.map((milestone, idx) => {
          const status = getStatus(milestone);
          const dateStr = getDate(milestone.key);
          const isCompleted = status === "completed";
          const isActive = status === "active";
          const isCancelled = status === "cancelled";

          let dotColor = "bg-slate-300";
          let lineColor = "bg-slate-200";
          let labelColor = "text-slate-500";

          if (isCompleted) {
            dotColor = "bg-emerald-500";
            lineColor = "bg-emerald-200";
            labelColor = "text-slate-700";
          } else if (isActive) {
            dotColor = "bg-blue-500 animate-pulse";
            lineColor = "bg-blue-200";
            labelColor = "text-slate-800 font-semibold";
          } else if (isCancelled) {
            dotColor = "bg-red-300";
            lineColor = "bg-red-200";
            labelColor = "text-red-600";
          }

          return (
            <div key={milestone.key} className="flex gap-4">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                {/* Dot */}
                <div className={`w-4 h-4 rounded-full ${dotColor} shadow-sm transition-all`} />
                {/* Line to next */}
                {idx < MILESTONE_ORDER.length - 1 && (
                  <div className={`w-1 h-12 ${lineColor} transition-colors`} />
                )}
              </div>

              {/* Content column */}
              <div className="flex-1 pb-6">
                <p className={`text-sm ${labelColor} transition-colors`}>{milestone.label}</p>
                {dateStr && dateStr !== "—" && (
                  <p className="text-xs text-slate-500 mt-1">{formatDate(dateStr)}</p>
                )}
                {milestone.key === "oqood" && daysRemaining !== null && (
                  <p className={`text-xs mt-1 font-medium ${isOqoodUrgent ? "text-red-600" : "text-slate-500"}`}>
                    {daysRemaining} days remaining
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancellation notice */}
      {stage === "CANCELLED" && (
        <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">Deal has been cancelled</p>
        </div>
      )}

      {/* Oqood deadline alert */}
      {isOqoodUrgent && stage !== "COMPLETED" && stage !== "CANCELLED" && (
        <div className="mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium">
            ⏰ {daysRemaining} days until Oqood registration deadline
          </p>
        </div>
      )}
    </div>
  );
}
