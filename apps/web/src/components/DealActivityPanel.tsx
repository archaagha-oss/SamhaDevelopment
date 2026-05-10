import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import DealTimeline from "./DealTimeline";
import ActivityTimeline, { type ActivityTimelineEntry } from "./ActivityTimeline";

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

/**
 * Side-by-side panel on the deal detail page with two tabs:
 *   - Timeline: stage-progression milestones (reservation → SPA → Oqood → handover)
 *     rendered by <DealTimeline>
 *   - Activity: chronological feed of all activities on the deal (calls,
 *     emails, WhatsApp, system events…) rendered by the canonical
 *     <ActivityTimeline> shared with the lead profile and deal detail
 *     screens. Previously this tab had its own row renderer with a
 *     different icon set / time-ago helper / sort order; collapsing it
 *     onto ActivityTimeline means inbound emails, delivery-status badges,
 *     and bubble layout match across surfaces.
 */
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
  const [activities, setActivities] = useState<ActivityTimelineEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      setActivityLoading(true);
      // GET /api/deals/:id/activities returns a plain array (not { data: [...] }),
      // matching the lead-activities endpoint shape. Earlier this code read
      // `response.data.data` which silently resolved to undefined, so the
      // Activity tab always rendered empty regardless of how many activities
      // a deal had. Caught while collapsing onto ActivityTimeline.
      const response = await axios.get<ActivityTimelineEntry[]>(`/api/deals/${dealId}/activities`);
      setActivities(Array.isArray(response.data) ? response.data : []);
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
            className={`text-sm font-medium pb-3 border-b-2 transition rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "timeline"
                ? "text-primary border-primary/40"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`text-sm font-medium pb-3 border-b-2 transition rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ActivityTimeline
              activities={activities}
              emptyMessage="No activities yet"
            />
          )
        )}
      </div>
    </div>
  );
}
