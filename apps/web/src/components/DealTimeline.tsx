import React from "react";
import { Lock, ClipboardList, Sparkles, CheckCircle2, FileText, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TimelineProps {
  stage: string;
  reservationDate?: string;
  spaSignedDate?: string;
  oqoodRegisteredDate?: string;
  oqoodDeadline?: string;
  completedDate?: string;
}

const MILESTONE_ORDER: { key: string; label: string; icon: LucideIcon; stages: string[] }[] = [
  { key: "reservation", label: "Reservation Confirmed", icon: Lock, stages: ["RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT", "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
  { key: "spa", label: "SPA Signed", icon: FileText, stages: ["SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
  { key: "oqood", label: "Oqood Registered", icon: ClipboardList, stages: ["OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
  { key: "handover", label: "Handover", icon: Sparkles, stages: ["HANDOVER_PENDING", "COMPLETED"] },
  { key: "completed", label: "Deal Completed", icon: CheckCircle2, stages: ["COMPLETED"] },
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

          let dotColor = "bg-neutral-300";
          let lineColor = "bg-neutral-200";
          let labelColor = "text-muted-foreground";

          if (isCompleted) {
            dotColor = "bg-success";
            lineColor = "bg-success/30";
            labelColor = "text-foreground";
          } else if (isActive) {
            dotColor = "bg-primary animate-pulse";
            lineColor = "bg-info/30";
            labelColor = "text-foreground font-semibold";
          } else if (isCancelled) {
            dotColor = "bg-destructive/50";
            lineColor = "bg-destructive/30";
            labelColor = "text-destructive";
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
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(dateStr)}</p>
                )}
                {milestone.key === "oqood" && daysRemaining !== null && (
                  <p className={`text-xs mt-1 font-medium ${isOqoodUrgent ? "text-destructive" : "text-muted-foreground"}`}>
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
        <div className="mt-6 px-4 py-3 bg-destructive-soft border border-destructive/30 rounded-lg">
          <p className="text-sm text-destructive font-medium">Deal has been cancelled</p>
        </div>
      )}

      {/* Oqood deadline alert */}
      {isOqoodUrgent && stage !== "COMPLETED" && stage !== "CANCELLED" && (
        <div className="mt-6 px-4 py-3 bg-warning-soft border border-warning/30 rounded-lg">
          <p className="text-sm text-warning-soft-foreground font-medium inline-flex items-center gap-2">
            <Clock className="size-4 text-warning" />
            <span>{daysRemaining} days until Oqood registration deadline</span>
          </p>
        </div>
      )}
    </div>
  );
}
