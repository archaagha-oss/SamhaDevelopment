import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const ACTIVITY_ICONS = {
  CALL: "📞",
  EMAIL: "✉️",
  WHATSAPP: "💬",
  MEETING: "🤝",
  SITE_VISIT: "🏢",
  NOTE: "📝",
  STAGE_CHANGE: "📊",
};

const STAGE_COLORS = {
  NEW: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-indigo-100 text-indigo-700",
  OFFER_SENT: "bg-violet-100 text-violet-700",
  SITE_VISIT: "bg-cyan-100 text-cyan-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  CLOSED_WON: "bg-emerald-100 text-emerald-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;

  return date.toLocaleDateString("en-AE", {
    month: "short",
    day: "numeric",
    year: new Date().getFullYear() !== date.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDate(activities) {
  const groups = {};

  activities.forEach((activity) => {
    const date = new Date(activity.activityDate).toLocaleDateString("en-AE");
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
  });

  return Object.entries(groups).sort(([dateA], [dateB]) =>
    new Date(dateB).getTime() - new Date(dateA).getTime()
  );
}

export default function LeadActivityFeedView({ activities = [], leads = {}, loading = false }) {
  const navigate = useNavigate();
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedActivityType, setSelectedActivityType] = useState(null);

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    if (selectedLeadId) {
      filtered = filtered.filter((a) => a.leadId === selectedLeadId);
    }

    if (selectedActivityType) {
      filtered = filtered.filter((a) => a.type === selectedActivityType);
    }

    return filtered.sort((a, b) =>
      new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime()
    );
  }, [activities, selectedLeadId, selectedActivityType]);

  const groupedActivities = groupByDate(filteredActivities);
  const activityTypes = Array.from(new Set(activities.map((a) => a.type)));

  if (loading) {
    return _jsx("div", {
      className: "flex items-center justify-center py-16",
      children: _jsx("div", {
        className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin",
      }),
    });
  }

  return _jsxs("div", {
    className: "flex-1 flex flex-col",
    children: [
      // Filters
      _jsxs("div", {
        className: "px-6 py-4 border-b border-slate-200 space-y-3",
        children: [
          _jsxs("div", {
            className: "flex gap-2 flex-wrap",
            children: [
              _jsxs("select", {
                value: selectedLeadId || "",
                onChange: (e) => setSelectedLeadId(e.target.value || null),
                className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-blue-400",
                children: [
                  _jsx("option", { value: "", children: "All leads" }),
                  Object.entries(leads).map(([id, name]) =>
                    _jsx("option", { value: id, children: name }, id)
                  ),
                ],
              }),
              _jsxs("select", {
                value: selectedActivityType || "",
                onChange: (e) => setSelectedActivityType(e.target.value || null),
                className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-blue-400",
                children: [
                  _jsx("option", { value: "", children: "All activity types" }),
                  activityTypes.map((type) =>
                    _jsx("option", { value: type, children: type.replace(/_/g, " ") }, type)
                  ),
                ],
              }),
            ],
          }),
          _jsx("p", {
            className: "text-xs text-slate-500",
            children: `${filteredActivities.length} activities`,
          }),
        ],
      }),

      // Activity feed
      _jsx("div", {
        className: "flex-1 overflow-y-auto px-6 py-4 space-y-6",
        children:
          groupedActivities.length === 0
            ? _jsx("div", {
                className: "flex flex-col items-center justify-center py-12 text-slate-500",
                children: _jsx("p", { children: "No activities found." }),
              })
            : groupedActivities.map(([date, dateActivities]) =>
                _jsxs("div", {
                  children: [
                    _jsx("h3", {
                      className: "text-sm font-semibold text-slate-600 mb-3",
                      children: date,
                    }),
                    _jsx("div", {
                      className: "space-y-2.5",
                      children: dateActivities.map((activity) => {
                        const lead = activity.lead || leads[activity.leadId];
                        return _jsxs("div", {
                          onClick: () => navigate(`/leads/${activity.leadId}`),
                          className: "flex gap-3.5 p-3 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-colors border border-slate-100/50",
                          children: [
                            _jsx("div", {
                              className: "text-lg flex-shrink-0 mt-0.5",
                              children: ACTIVITY_ICONS[activity.type] || "📝",
                            }),
                            _jsxs("div", {
                              className: "flex-1 min-w-0",
                              children: [
                                _jsxs("div", {
                                  className: "flex items-baseline gap-2 flex-wrap",
                                  children: [
                                    _jsx("span", {
                                      className: "font-medium text-slate-900",
                                      children: lead ? `${lead.firstName} ${lead.lastName}` : "Unknown lead",
                                    }),
                                    _jsx("span", {
                                      className: "text-sm text-slate-500",
                                      children: activity.type.replace(/_/g, " "),
                                    }),
                                  ],
                                }),
                                _jsx("p", {
                                  className: "text-sm text-slate-600 mt-1 line-clamp-2",
                                  children: activity.summary || "—",
                                }),
                                _jsxs("div", {
                                  className: "flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-500",
                                  children: [
                                    _jsx("span", {
                                      children: formatTime(activity.activityDate),
                                    }),
                                    lead && _jsx("span", {
                                      className: `${STAGE_COLORS[lead.stage] || "bg-gray-100"} px-2 py-0.5 rounded text-xs font-medium`,
                                      children: lead.stage.replace(/_/g, " "),
                                    }),
                                    lead && lead.budget && _jsx("span", {
                                      children: `Budget: ${new Intl.NumberFormat("en-AE", {
                                        style: "currency",
                                        currency: "AED",
                                        minimumFractionDigits: 0,
                                      }).format(lead.budget)}`,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        });
                      }),
                    }),
                  ],
                }, date)
              ),
      }),
    ],
  });
}
