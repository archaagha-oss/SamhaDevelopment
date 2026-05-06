import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import QuickLeadModal from "./QuickLeadModal";
import ConfirmDialog from "./ConfirmDialog";
import LeadSearchFilters from "./LeadSearchFilters";
import LeadTableView from "./LeadTableView";
import LeadActivityFeedView from "./LeadActivityFeedView";
import EmptyState from "./EmptyState";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "OFFER_SENT", "SITE_VISIT", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];
const STAGE_STYLE = {
  NEW: { header: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  CONTACTED: { header: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  QUALIFIED: { header: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  OFFER_SENT: { header: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  SITE_VISIT: { header: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500" },
  NEGOTIATING: { header: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  CLOSED_WON: { header: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  CLOSED_LOST: { header: "bg-red-50 text-red-700", dot: "bg-red-500" },
};
const SOURCE_COLORS = {
  DIRECT: "bg-blue-100 text-blue-700",
  BROKER: "bg-purple-100 text-purple-700",
  WEBSITE: "bg-cyan-100 text-cyan-700",
  REFERRAL: "bg-emerald-100 text-emerald-700",
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function LeadsPageV2({ onViewLead } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState("kanban"); // kanban, table, activity
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({});
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [stageFilter, setStageFilter] = useState("");

  // Fetch leads
  const fetchLeads = useCallback(async (filterObj = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: "1",
        limit: "200",
        ...filterObj,
      };

      // Convert filters to API params
      if (filterObj.search) params.search = filterObj.search;
      if (filterObj.stages?.length > 0) params.stage = filterObj.stages[0]; // API takes single stage
      if (filterObj.budgetMin) params.budgetMin = filterObj.budgetMin;
      if (filterObj.budgetMax) params.budgetMax = filterObj.budgetMax;
      if (filterObj.assignedAgentId) params.assignedAgentId = filterObj.assignedAgentId;
      if (stageFilter) params.stage = stageFilter;

      const res = await axios.get("/api/leads", { params });
      const data = res.data.data || [];
      setAllLeads(Array.isArray(data) ? data : []);
      setTotal(res.data.pagination?.total || data.length);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  // Fetch activities for activity feed
  const [activities, setActivities] = useState([]);
  useEffect(() => {
    if (view === "activity") {
      axios
        .get("/api/activities", { params: { limit: 500 } })
        .then((res) => setActivities(res.data || []))
        .catch(() => setActivities([]));
    }
  }, [view]);

  // Refetch when filters change
  useEffect(() => {
    fetchLeads(filters);
  }, [filters, fetchLeads]);

  const handleDeleteLead = async (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;

    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await axios.delete(`/api/leads/${id}`);
      fetchLeads(filters);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreated = () => {
    fetchLeads(filters);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    toast.success("Lead created");
  };

  const byStage = (stage) =>
    allLeads.filter((l) => l.stage === stage);

  // Build lead map for activity feed
  const leadMap = {};
  allLeads.forEach((l) => {
    leadMap[l.id] = `${l.firstName} ${l.lastName}`;
  });

  return _jsxs("div", {
    className: "flex h-full bg-white",
    children: [
      // Left sidebar - Filters
      _jsx(LeadSearchFilters, {
        onChange: setFilters,
        onClear: () => setFilters({}),
      }),

      // Main content
      _jsxs("div", {
        className: "flex-1 flex flex-col overflow-hidden",
        children: [
          // Header
          _jsxs("div", {
            className: "px-6 py-4 border-b border-slate-200 flex-shrink-0",
            children: [
              _jsxs("div", {
                className: "flex items-center justify-between mb-3",
                children: [
                  _jsxs("div", {
                    children: [
                      _jsx("h1", {
                        className: "text-lg font-bold text-slate-900",
                        children: "Leads Pipeline",
                      }),
                      _jsxs("p", {
                        className: "text-slate-400 text-xs mt-0.5",
                        children: [total, " leads total"],
                      }),
                    ],
                  }),
                  _jsx("button", {
                    onClick: () => setShowForm(true),
                    className:
                      "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5",
                    children: [
                      _jsx("span", { className: "text-base leading-none", children: "+" }),
                      " New Lead",
                    ],
                  }),
                ],
              }),
              // View tabs
              _jsxs("div", {
                className: "flex gap-2 border-b border-slate-200 -mb-4",
                children: [
                  ["kanban", "table", "activity"].map((v) =>
                    _jsx("button", {
                      onClick: () => setView(v),
                      className: `px-4 py-2 text-sm font-medium transition-colors ${
                        view === v
                          ? "border-b-2 border-blue-600 text-blue-600"
                          : "text-slate-600 hover:text-slate-900"
                      }`,
                      children: {
                        kanban: "📊 Kanban",
                        table: "📋 Table",
                        activity: "📈 Activity Feed",
                      }[v],
                    }, v)
                  ),
                ],
              }),
            ],
          }),

          // Content area
          _jsxs("div", {
            className: "flex-1 overflow-hidden flex",
            children: [
              // Kanban view
              view === "kanban" && _jsx("div", {
                className: "flex-1 overflow-x-auto scrollbar-thin p-4",
                children: loading ? (
                  _jsx("div", {
                    className: "flex items-center justify-center h-full",
                    children: _jsx("div", {
                      className:
                        "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin",
                    }),
                  })
                ) : allLeads.length === 0 ? (
                  _jsx(EmptyState, {
                    icon: "📭",
                    title: "No leads found",
                    description: "Try adjusting your filters",
                  })
                ) : (
                  _jsx("div", {
                    className: "flex gap-4 h-full min-w-max",
                    children: STAGES.map((stage) => {
                      const leads = byStage(stage);
                      const style = STAGE_STYLE[stage];
                      return _jsxs("div", {
                        className:
                          "w-72 flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden",
                        children: [
                          _jsxs("div", {
                            className: `flex items-center justify-between px-4 py-3 ${style.header}`,
                            children: [
                              _jsxs("div", {
                                className: "flex items-center gap-2",
                                children: [
                                  _jsx("div", {
                                    className: `w-2 h-2 rounded-full ${style.dot}`,
                                  }),
                                  _jsx("span", {
                                    className: "text-xs font-semibold",
                                    children: stage.replace(/_/g, " "),
                                  }),
                                ],
                              }),
                              _jsx("span", {
                                className: "text-xs font-bold opacity-70",
                                children: leads.length,
                              }),
                            ],
                          }),
                          _jsx("div", {
                            className: "flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2",
                            children:
                              leads.length === 0 ? (
                                _jsx("div", {
                                  className: "py-8 text-center",
                                  children: _jsx("p", {
                                    className: "text-slate-400 text-xs",
                                    children: "No leads",
                                  }),
                                })
                              ) : (
                                leads.map((lead) =>
                                  _jsxs("div", {
                                    onClick: () =>
                                      onViewLead
                                        ? onViewLead(lead.id)
                                        : navigate(`/leads/${lead.id}`),
                                    className:
                                      "bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all",
                                    children: [
                                      _jsxs("p", {
                                        className:
                                          "text-sm font-semibold text-slate-800",
                                        children: [
                                          lead.firstName,
                                          " ",
                                          lead.lastName,
                                        ],
                                      }),
                                      _jsx("p", {
                                        className: "text-xs text-slate-500",
                                        children: lead.phone,
                                      }),
                                      lead.budget && _jsx("p", {
                                        className: "text-xs text-slate-600 mt-1",
                                        children: `Budget: AED ${lead.budget.toLocaleString()}`,
                                      }),
                                      lead.interests?.length > 0 && _jsx("p", {
                                        className: "text-xs text-slate-500 mt-1",
                                        children: lead.interests
                                          .slice(0, 2)
                                          .map((i) => i.unit.unitNumber)
                                          .join(", "),
                                      }),
                                    ],
                                  }, lead.id)
                                )
                              ),
                          }),
                        ],
                      }, stage);
                    }),
                  })
                ),
              }),

              // Table view
              view === "table" && _jsx(LeadTableView, {
                leads: allLeads,
                loading,
                pagination: { page: 1, limit: 200, total },
              }),

              // Activity feed view
              view === "activity" && _jsx(LeadActivityFeedView, {
                activities,
                leads: leadMap,
                loading,
              }),
            ],
          }),
        ],
      }),

      // Modals
      showForm && _jsx(QuickLeadModal, {
        onClose: () => setShowForm(false),
        onCreated: handleCreated,
      }),
      _jsx(ConfirmDialog, {
        open: !!confirmDeleteId,
        title: "Delete Lead",
        message: "Delete this lead? This cannot be undone.",
        confirmLabel: "Delete",
        variant: "danger",
        onConfirm: confirmDelete,
        onCancel: () => setConfirmDeleteId(null),
      }),
    ],
  });
}
