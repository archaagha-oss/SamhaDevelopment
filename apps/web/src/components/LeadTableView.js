import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatCurrency(value) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diff = daysSince(dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString("en-AE", { month: "short", day: "numeric" });
}

export default function LeadTableView({ leads = [], loading = false, pagination = {} }) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return _jsx("span", { className: "text-slate-300", children: "⇅" });
    return sortOrder === "asc" ? _jsx("span", { children: "▲" }) : _jsx("span", { children: "▼" });
  };

  const Header = ({ label, column, className = "text-left" }) =>
    _jsxs("button", {
      onClick: () => handleSort(column),
      className: `px-4 py-3 font-medium text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 ${className}`,
      children: [label, _jsx(SortIcon, { column })],
    });

  if (loading) {
    return _jsx("div", {
      className: "flex items-center justify-center py-16",
      children: _jsx("div", {
        className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin",
      }),
    });
  }

  if (leads.length === 0) {
    return _jsx("div", {
      className: "flex flex-col items-center justify-center py-16 text-slate-500",
      children: _jsx("p", { children: "No leads found. Try adjusting your filters." }),
    });
  }

  return _jsxs("div", {
    className: "flex-1 overflow-x-auto",
    children: [
      _jsxs("table", {
        className: "w-full border-collapse",
        children: [
          _jsx("thead", {
            className: "bg-slate-50 border-t border-b border-slate-200 sticky top-0",
            children: _jsxs("tr", {
              children: [
                _jsx(Header, { label: "Name", column: "name" }),
                _jsx(Header, { label: "Phone", column: "phone" }),
                _jsx(Header, { label: "Budget", column: "budget", className: "text-right" }),
                _jsx(Header, { label: "Stage", column: "stage" }),
                _jsx(Header, { label: "Days in Stage", column: "stage_days", className: "text-right" }),
                _jsx(Header, { label: "Agent", column: "agent" }),
                _jsx(Header, { label: "Last Activity", column: "last_activity" }),
              ],
            }),
          }),
          _jsx("tbody", {
            children: leads.map((lead) => {
              const daysSinceStageChange = lead.createdAt ? daysSince(lead.createdAt) : 0;
              return _jsxs("tr", {
                onClick: () => navigate(`/leads/${lead.id}`),
                className: "border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors",
                children: [
                  _jsxs("td", {
                    className: "px-4 py-3",
                    children: [
                      _jsxs("div", {
                        className: "flex flex-col",
                        children: [
                          _jsx("span", {
                            className: "font-medium text-slate-900",
                            children: `${lead.firstName} ${lead.lastName}`,
                          }),
                          _jsx("span", {
                            className: "text-xs text-slate-400",
                            children: lead.source,
                          }),
                        ],
                      }),
                    ],
                  }),
                  _jsx("td", {
                    className: "px-4 py-3 text-sm text-slate-600",
                    children: lead.phone,
                  }),
                  _jsx("td", {
                    className: "px-4 py-3 text-sm text-right font-medium",
                    children: formatCurrency(lead.budget),
                  }),
                  _jsx("td", {
                    className: "px-4 py-3",
                    children: _jsx("span", {
                      className: `text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_COLORS[lead.stage] || "bg-gray-100"}`,
                      children: lead.stage.replace(/_/g, " "),
                    }),
                  }),
                  _jsx("td", {
                    className: "px-4 py-3 text-sm text-right text-slate-600",
                    children: daysSinceStageChange ? `${daysSinceStageChange}d` : "—",
                  }),
                  _jsx("td", {
                    className: "px-4 py-3 text-sm text-slate-600",
                    children: lead.assignedAgent?.name || "—",
                  }),
                  _jsx("td", {
                    className: "px-4 py-3 text-sm text-slate-600",
                    children: formatDate(lead.lastContactedAt),
                  }),
                ],
              });
            }),
          }),
        ],
      }),
      pagination.total > 0 && _jsxs("div", {
        className: "px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600",
        children: [
          _jsx("span", {
            children: `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(
              pagination.page * pagination.limit,
              pagination.total
            )} of ${pagination.total} leads`,
          }),
        ],
      }),
    ],
  });
}
