import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import DealTimeline from "./DealTimeline";
const activityIcon = (type, summary) => {
    if (type === "CALL")
        return "📞";
    if (type === "EMAIL")
        return "✉️";
    if (type === "WHATSAPP")
        return "💬";
    if (type === "MEETING")
        return "🤝";
    if (type === "SITE_VISIT")
        return "🏢";
    const s = summary.toLowerCase();
    if (s.includes("reserved"))
        return "🔒";
    if (s.includes("generated") || s.includes("document"))
        return "📄";
    if (s.includes("stage changed") || s.includes("→"))
        return "🔄";
    if (s.includes("created"))
        return "✅";
    if (s.includes("unit") && (s.includes("assign") || s.includes("changed")))
        return "🏠";
    return "📝";
};
const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)
        return "Just now";
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
        return `Today ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
    if (diff < 172800)
        return `Yesterday ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
    return new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};
export default function DealActivityPanel({ dealId, stage, reservationDate, spaSignedDate, oqoodRegisteredDate, oqoodDeadline, completedDate, }) {
    const [activeTab, setActiveTab] = useState("timeline");
    const [activities, setActivities] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const loadActivities = useCallback(async () => {
        try {
            setActivityLoading(true);
            const response = await axios.get(`/api/deals/${dealId}/activities`);
            setActivities(response.data.data || []);
        }
        catch (error) {
            console.error("Failed to load activities:", error);
        }
        finally {
            setActivityLoading(false);
        }
    }, [dealId]);
    useEffect(() => {
        loadActivities();
    }, [loadActivities]);
    return (_jsxs("div", { className: "flex flex-col h-full bg-white border-r border-slate-200", children: [_jsx("div", { className: "flex-shrink-0 border-b border-slate-200", children: _jsxs("div", { className: "flex gap-4 px-6 py-3", children: [_jsx("button", { onClick: () => setActiveTab("timeline"), className: `text-sm font-medium pb-3 border-b-2 transition ${activeTab === "timeline"
                                ? "text-blue-600 border-blue-600"
                                : "text-slate-600 border-transparent hover:text-slate-900"}`, children: "Timeline" }), _jsxs("button", { onClick: () => setActiveTab("activity"), className: `text-sm font-medium pb-3 border-b-2 transition ${activeTab === "activity"
                                ? "text-blue-600 border-blue-600"
                                : "text-slate-600 border-transparent hover:text-slate-900"}`, children: ["Activity (", activities.length, ")"] })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [activeTab === "timeline" && (_jsx(DealTimeline, { stage: stage, reservationDate: reservationDate, spaSignedDate: spaSignedDate, oqoodRegisteredDate: oqoodRegisteredDate, oqoodDeadline: oqoodDeadline, completedDate: completedDate })), activeTab === "activity" && (_jsxs("div", { className: "divide-y divide-slate-200", children: [activityLoading && (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })), !activityLoading && activities.length === 0 && (_jsx("div", { className: "px-6 py-8 text-center text-slate-500", children: _jsx("p", { className: "text-sm", children: "No activities yet" }) })), !activityLoading && activities.map((activity) => (_jsx("div", { className: "px-6 py-4 hover:bg-slate-50 transition", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "text-lg flex-shrink-0 mt-0.5", children: activityIcon(activity.type, activity.summary) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-slate-900 break-words", children: activity.summary }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [timeAgo(activity.activityDate), activity.createdBy && _jsxs("span", { children: [" \u00B7 ", activity.createdBy] })] })] })] }) }, activity.id)))] }))] })] }));
}
