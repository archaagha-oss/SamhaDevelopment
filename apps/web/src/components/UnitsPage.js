import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import UnitsTable from "./UnitsTable";
import UnitSearchFilters from "./UnitSearchFilters";
import { toast } from "sonner";

export default function UnitsPage() {
  const [view, setView] = useState("table"); // table, kanban, gallery
  const [filters, setFilters] = useState({});
  const [units, setUnits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Fetch units with filters
  const fetchUnits = useCallback(async (filterObj = {}) => {
    setLoading(true);
    try {
      const params = {
        page: "1",
        limit: "200",
      };

      if (filterObj.search) params.search = filterObj.search;
      if (filterObj.projectId) params.projectId = filterObj.projectId;
      if (filterObj.priceMin) params.minPrice = filterObj.priceMin;
      if (filterObj.priceMax) params.maxPrice = filterObj.priceMax;
      if (filterObj.floorMin) params.minFloor = filterObj.floorMin;
      if (filterObj.floorMax) params.maxFloor = filterObj.floorMax;
      if (filterObj.areaMin) params.minArea = filterObj.areaMin;
      if (filterObj.areaMax) params.maxArea = filterObj.areaMax;
      if (filterObj.types?.length > 0) params.type = filterObj.types[0];
      if (filterObj.views?.length > 0) params.view = filterObj.views[0];
      if (filterObj.status?.length > 0) params.status = filterObj.status[0];
      if (filterObj.assignedAgentId) params.assignedAgentId = filterObj.assignedAgentId;

      const res = await axios.get("/api/units", { params });
      setUnits(Array.isArray(res.data.data) ? res.data.data : []);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load units");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch projects for filter
  useEffect(() => {
    axios.get("/api/projects").then((res) => {
      setProjects(Array.isArray(res.data.data) ? res.data.data : res.data || []);
    });
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchUnits(filters);
  }, [filters, fetchUnits]);

  return _jsxs("div", {
    className: "flex h-full bg-white",
    children: [
      // Left sidebar - Filters
      _jsx(UnitSearchFilters, {
        projects,
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
                        children: "Units",
                      }),
                      _jsxs("p", {
                        className: "text-slate-400 text-xs mt-0.5",
                        children: [total, " units total"],
                      }),
                    ],
                  }),
                ],
              }),
              // View tabs
              _jsxs("div", {
                className: "flex gap-2 border-b border-slate-200 -mb-4",
                children: [
                  ["table", "kanban", "gallery"].map((v) =>
                    _jsx("button", {
                      onClick: () => setView(v),
                      className: `px-4 py-2 text-sm font-medium transition-colors ${
                        view === v
                          ? "border-b-2 border-blue-600 text-blue-600"
                          : "text-slate-600 hover:text-slate-900"
                      }`,
                      children: {
                        table: "📋 Table",
                        kanban: "🏗️ Kanban",
                        gallery: "🖼️ Gallery",
                      }[v],
                    }, v)
                  ),
                ],
              }),
            ],
          }),

          // Content area
          _jsxs("div", {
            className: "flex-1 overflow-hidden",
            children: [
              // Table view
              view === "table" && _jsx("div", {
                className: "w-full h-full overflow-hidden",
                children: _jsx(UnitsTable, {
                  units,
                  loading,
                  projectMap: projects.reduce((m, p) => ({ ...m, [p.id]: p.name }), {}),
                  onRefresh: () => fetchUnits(filters),
                }),
              }),

              // Kanban view (by status)
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
                ) : units.length === 0 ? (
                  _jsx("div", {
                    className:
                      "flex items-center justify-center h-full text-center",
                    children: _jsxs("div", {
                      children: [
                        _jsx("p", { className: "text-2xl mb-2", children: "📭" }),
                        _jsx("p", {
                          className: "text-slate-500",
                          children: "No units found",
                        }),
                      ],
                    }),
                  })
                ) : (
                  _jsx("div", {
                    className: "flex gap-4 h-full min-w-max",
                    children: [
                      "AVAILABLE",
                      "ON_HOLD",
                      "RESERVED",
                      "BOOKED",
                      "SOLD",
                      "HANDED_OVER",
                      "BLOCKED",
                    ].map((status) => {
                      const statusUnits = units.filter(
                        (u) => u.status === status
                      );
                      return _jsxs("div", {
                        className:
                          "w-72 flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden",
                        children: [
                          _jsxs("div", {
                            className:
                              "flex items-center justify-between px-4 py-3 bg-slate-100 text-slate-700",
                            children: [
                              _jsx("span", {
                                className: "text-xs font-semibold",
                                children: status.replace(/_/g, " "),
                              }),
                              _jsx("span", {
                                className: "text-xs font-bold opacity-70",
                                children: statusUnits.length,
                              }),
                            ],
                          }),
                          _jsx("div", {
                            className: "flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2",
                            children:
                              statusUnits.length === 0 ? (
                                _jsx("div", {
                                  className: "py-8 text-center",
                                  children: _jsx("p", {
                                    className: "text-slate-400 text-xs",
                                    children: "No units",
                                  }),
                                })
                              ) : (
                                statusUnits.map((unit) =>
                                  _jsxs("div", {
                                    className:
                                      "bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all",
                                    children: [
                                      _jsx("p", {
                                        className:
                                          "text-sm font-semibold text-slate-800",
                                        children: unit.unitNumber,
                                      }),
                                      _jsx("p", {
                                        className: "text-xs text-slate-500",
                                        children: projects.find(
                                          (p) => p.id === unit.projectId
                                        )?.name,
                                      }),
                                      _jsx("p", {
                                        className: "text-xs text-slate-600 mt-1",
                                        children: `AED ${unit.price.toLocaleString()}`,
                                      }),
                                    ],
                                  }, unit.id)
                                )
                              ),
                          }),
                        ],
                      }, status);
                    }),
                  })
                ),
              }),

              // Gallery view
              view === "gallery" && _jsx("div", {
                className: "flex-1 overflow-y-auto p-4",
                children: loading ? (
                  _jsx("div", {
                    className: "flex items-center justify-center h-full",
                    children: _jsx("div", {
                      className:
                        "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin",
                    }),
                  })
                ) : units.length === 0 ? (
                  _jsx("div", {
                    className:
                      "flex items-center justify-center h-full text-center",
                    children: _jsxs("div", {
                      children: [
                        _jsx("p", { className: "text-2xl mb-2", children: "📭" }),
                        _jsx("p", {
                          className: "text-slate-500",
                          children: "No units found",
                        }),
                      ],
                    }),
                  })
                ) : (
                  _jsx("div", {
                    className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",
                    children: units.map((unit) =>
                      _jsxs("div", {
                        className:
                          "bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer",
                        children: [
                          _jsx("div", {
                            className:
                              "w-full h-40 bg-slate-200 flex items-center justify-center text-2xl",
                            children: unit.images?.length > 0 ? (
                              _jsx("img", {
                                src: unit.images[0].url,
                                alt: unit.unitNumber,
                                className: "w-full h-full object-cover",
                              })
                            ) : (
                              "📷"
                            ),
                          }),
                          _jsxs("div", {
                            className: "p-3",
                            children: [
                              _jsx("p", {
                                className: "font-semibold text-slate-900 text-sm",
                                children: unit.unitNumber,
                              }),
                              _jsx("p", {
                                className: "text-xs text-slate-500 mb-2",
                                children: `AED ${unit.price.toLocaleString()}`,
                              }),
                              _jsx("span", {
                                className:
                                  "inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded",
                                children: unit.status.replace(/_/g, " "),
                              }),
                            ],
                          }),
                        ],
                      }, unit.id)
                    ),
                  })
                ),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
