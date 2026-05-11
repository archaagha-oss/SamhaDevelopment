import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Phone,
  Mail,
  MessageCircle,
  Handshake,
  Building2,
  Lock,
  File,
  RefreshCw,
  CheckCircle2,
  Home,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DealTimeline from "./DealTimeline";

interface Activity {
  id: string;
  type: string;
  summary: string;
  activityDate: string;
  createdBy?: string;
}

interface DealActivityPanelProps {
  dealId: string;
  stage: string;
  reservationDate?: string;
  spaSignedDate?: string;
  oqoodRegisteredDate?: string;
  oqoodDeadline?: string;
  completedDate?: string;
  onActivityUpdate?: () => void;
}

const activityIcon = (type: string, summary: string): LucideIcon => {
  if (type === "CALL") return Phone;
  if (type === "EMAIL") return Mail;
  if (type === "WHATSAPP") return MessageCircle;
  if (type === "MEETING") return Handshake;
  if (type === "SITE_VISIT") return Building2;
  const s = summary.toLowerCase();
  if (s.includes("reserved")) return Lock;
  if (s.includes("generated") || s.includes("document")) return File;
  if (s.includes("stage changed") || s.includes("→")) return RefreshCw;
  if (s.includes("created")) return CheckCircle2;
  if (s.includes("unit") && (s.includes("assign") || s.includes("changed"))) return Home;
  return FileText;
};

const timeAgo = (dateStr: string): string => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Today ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
  if (diff < 172800) return `Yesterday ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
  return new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};

export default function DealActivityPanel({
  dealId,
  stage,
  reservationDate,
  spaSignedDate,
  oqoodRegisteredDate,
  oqoodDeadline,
  completedDate,
}: DealActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "activity">("timeline");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      setActivityLoading(true);
      const response = await axios.get(`/api/deals/${dealId}/activities`);
      setActivities(response.data.data || []);
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setActivityLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex gap-4 px-6 py-3">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`text-sm font-medium pb-3 border-b-2 transition ${
              activeTab === "timeline"
                ? "text-primary border-primary/40"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`text-sm font-medium pb-3 border-b-2 transition ${
              activeTab === "activity"
                ? "text-primary border-primary/40"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            Activity ({activities.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "timeline" && (
          <DealTimeline
            stage={stage}
            reservationDate={reservationDate}
            spaSignedDate={spaSignedDate}
            oqoodRegisteredDate={oqoodRegisteredDate}
            oqoodDeadline={oqoodDeadline}
            completedDate={completedDate}
          />
        )}

        {activeTab === "activity" && (
          <div className="divide-y divide-border">
            {activityLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!activityLoading && activities.length === 0 && (
              <div className="px-6 py-8 text-center text-muted-foreground">
                <p className="text-sm">No activities yet</p>
              </div>
            )}

            {!activityLoading && activities.map((activity) => (
              <div key={activity.id} className="px-6 py-4 hover:bg-muted/50 transition">
                <div className="flex items-start gap-3">
                  {(() => {
                    const Icon = activityIcon(activity.type, activity.summary);
                    return <Icon className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground break-words">{activity.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(activity.activityDate)}
                      {activity.createdBy && <span> · {activity.createdBy}</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
