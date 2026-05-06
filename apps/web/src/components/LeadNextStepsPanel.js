import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diff = daysSince(dateStr);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `in ${diff} days`;

  return date.toLocaleDateString("en-AE", { month: "short", day: "numeric" });
}

export default function LeadNextStepsPanel({ leadId, lead = {}, tasks = [], deals = [], interests = [] }) {
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [recommendedUnits, setRecommendedUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Load recommended units based on lead's budget
  useEffect(() => {
    if (!lead.budget) return;

    setLoadingUnits(true);
    const minBudget = lead.budget * 0.8;
    const maxBudget = lead.budget * 1.2;

    axios
      .get("/api/units", {
        params: {
          minPrice: minBudget,
          maxPrice: maxBudget,
          status: "AVAILABLE",
          limit: "3",
        },
      })
      .then((res) => setRecommendedUnits(res.data.data || []))
      .catch(() => setRecommendedUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [lead.budget]);

  const completeTask = async (taskId) => {
    setCompletingTaskId(taskId);
    try {
      await axios.patch(`/api/tasks/${taskId}/complete`);
      toast.success("Task completed!");
      // Remove from local state
      // Caller should refresh
    } catch (error) {
      toast.error("Failed to complete task");
    } finally {
      setCompletingTaskId(null);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const overdueTasks = pendingTasks.filter(
    (t) => new Date(t.dueDate) < new Date()
  );
  const upcomingTasks = pendingTasks.filter(
    (t) => new Date(t.dueDate) >= new Date()
  );

  const daysSinceLastContact = lead.lastContactedAt
    ? daysSince(lead.lastContactedAt)
    : null;
  const needsFollowUp =
    daysSinceLastContact !== null && daysSinceLastContact >= 7;

  return _jsxs("div", {
    className: "bg-slate-50 rounded-lg p-4 space-y-4",
    children: [
      // Header
      _jsxs("div", {
        className: "flex items-center gap-2 mb-2",
        children: [
          _jsx("span", { className: "text-lg", children: "⭐" }),
          _jsx("h3", {
            className: "font-semibold text-slate-900 text-sm",
            children: "Next Steps",
          }),
        ],
      }),

      // Overdue tasks (red)
      overdueTasks.length > 0 && _jsxs("div", {
        className: "bg-red-50 border border-red-200 rounded-lg p-3 space-y-2",
        children: [
          _jsx("p", {
            className: "text-xs font-semibold text-red-700 uppercase tracking-wide",
            children: `⚠️ ${overdueTasks.length} overdue`,
          }),
          overdueTasks.map((task) =>
            _jsxs("div", {
              className: "flex items-start gap-2.5",
              children: [
                _jsx("input", {
                  type: "checkbox",
                  checked: false,
                  onChange: () => completeTask(task.id),
                  disabled: completingTaskId === task.id,
                  className: "mt-1 w-4 h-4 rounded cursor-pointer",
                }),
                _jsxs("div", {
                  className: "flex-1",
                  children: [
                    _jsx("p", {
                      className: "text-sm font-medium text-red-900",
                      children: task.title,
                    }),
                    _jsx("p", {
                      className: "text-xs text-red-700",
                      children: `Due ${daysSince(task.dueDate)} days ago`,
                    }),
                  ],
                }),
              ],
            }, task.id)
          ),
        ],
      }),

      // Upcoming tasks (normal)
      upcomingTasks.length > 0 && _jsxs("div", {
        className: "bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2",
        children: [
          _jsx("p", {
            className: "text-xs font-semibold text-blue-700 uppercase tracking-wide",
            children: `📋 ${upcomingTasks.length} upcoming`,
          }),
          upcomingTasks.map((task) =>
            _jsxs("div", {
              className: "flex items-start gap-2.5",
              children: [
                _jsx("input", {
                  type: "checkbox",
                  checked: false,
                  onChange: () => completeTask(task.id),
                  disabled: completingTaskId === task.id,
                  className: "mt-1 w-4 h-4 rounded cursor-pointer",
                }),
                _jsxs("div", {
                  className: "flex-1",
                  children: [
                    _jsx("p", {
                      className: "text-sm font-medium text-blue-900",
                      children: task.title,
                    }),
                    _jsx("p", {
                      className: "text-xs text-blue-700",
                      children: `Due ${formatDate(task.dueDate)}`,
                    }),
                  ],
                }),
              ],
            }, task.id)
          ),
        ],
      }),

      // Recommended actions
      _jsx("div", {
        className: "bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2",
        children: _jsxs("div", {
          children: [
            _jsx("p", {
              className: "text-xs font-semibold text-amber-700 uppercase tracking-wide",
              children: "💡 Suggested Actions",
            }),
            _jsxs("ul", {
              className: "space-y-1.5 text-xs text-amber-800 mt-1.5",
              children: [
                // Follow-up needed
                needsFollowUp && _jsxs("li", {
                  className: "flex gap-2",
                  children: [
                    _jsx("span", { children: "•" }),
                    _jsx("span", {
                      children: `No contact for ${daysSinceLastContact} days → Schedule call or meeting`,
                    }),
                  ],
                }),

                // Matching units
                recommendedUnits.length > 0 && _jsxs("li", {
                  className: "flex gap-2",
                  children: [
                    _jsx("span", { children: "•" }),
                    _jsx("span", {
                      children: `${recommendedUnits.length} new units match budget ${lead.budget ? `${new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                        minimumFractionDigits: 0,
                      }).format(lead.budget)}` : ""}`,
                    }),
                  ],
                }),

                // Deal payment overdue
                deals.some((d) => d.payments?.some((p) => p.status === "OVERDUE")) && _jsxs("li", {
                  className: "flex gap-2",
                  children: [
                    _jsx("span", { children: "•" }),
                    _jsx("span", { children: "Payment overdue on active deal → Send reminder" }),
                  ],
                }),

                // No recent activities
                !lead.lastContactedAt && _jsxs("li", {
                  className: "flex gap-2",
                  children: [
                    _jsx("span", { children: "•" }),
                    _jsx("span", { children: "First contact needed → Call or WhatsApp today" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),

      // Interested units count
      interests.length > 0 && _jsx("div", {
        className: "text-xs text-slate-600 pt-2 border-t border-slate-200",
        children: _jsxs("span", {
          children: [
            "🎯 ",
            interests.length,
            " unit",
            interests.length !== 1 ? "s" : "",
            " in wishlist",
          ],
        }),
      }),
    ],
  });
}
