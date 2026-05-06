import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAgents } from "../hooks/useAgents";

export default function UnitSearchFilters({ projects = [], onChange, onClear }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agents = [] } = useAgents();

  // Filter state
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [projectId, setProjectId] = useState(searchParams.get("project") || "");
  const [priceMin, setPriceMin] = useState(searchParams.get("priceMin") || "");
  const [priceMax, setPriceMax] = useState(searchParams.get("priceMax") || "");
  const [floorMin, setFloorMin] = useState(searchParams.get("floorMin") || "");
  const [floorMax, setFloorMax] = useState(searchParams.get("floorMax") || "");
  const [areaMin, setAreaMin] = useState(searchParams.get("areaMin") || "");
  const [areaMax, setAreaMax] = useState(searchParams.get("areaMax") || "");
  const [selectedTypes, setSelectedTypes] = useState(
    searchParams.get("types") ? searchParams.get("types").split(",") : []
  );
  const [selectedViews, setSelectedViews] = useState(
    searchParams.get("views") ? searchParams.get("views").split(",") : []
  );
  const [selectedStatus, setSelectedStatus] = useState(
    searchParams.get("status") ? searchParams.get("status").split(",") : []
  );
  const [assignedAgentId, setAssignedAgentId] = useState(searchParams.get("agent") || "");

  const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];
  const VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"];
  const STATUSES = ["AVAILABLE", "ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER", "BLOCKED"];

  // Build filters object
  const buildFilters = () => ({
    search,
    projectId: projectId || undefined,
    priceMin: priceMin ? parseFloat(priceMin) : undefined,
    priceMax: priceMax ? parseFloat(priceMax) : undefined,
    floorMin: floorMin ? parseInt(floorMin) : undefined,
    floorMax: floorMax ? parseInt(floorMax) : undefined,
    areaMin: areaMin ? parseFloat(areaMin) : undefined,
    areaMax: areaMax ? parseFloat(areaMax) : undefined,
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    views: selectedViews.length > 0 ? selectedViews : undefined,
    status: selectedStatus.length > 0 ? selectedStatus : undefined,
    assignedAgentId: assignedAgentId || undefined,
  });

  // Notify parent when filters change
  useEffect(() => {
    const filters = buildFilters();
    onChange?.(filters);

    // Update URL
    const params = {};
    if (search) params.search = search;
    if (projectId) params.project = projectId;
    if (priceMin) params.priceMin = priceMin;
    if (priceMax) params.priceMax = priceMax;
    if (floorMin) params.floorMin = floorMin;
    if (floorMax) params.floorMax = floorMax;
    if (areaMin) params.areaMin = areaMin;
    if (areaMax) params.areaMax = areaMax;
    if (selectedTypes.length > 0) params.types = selectedTypes.join(",");
    if (selectedViews.length > 0) params.views = selectedViews.join(",");
    if (selectedStatus.length > 0) params.status = selectedStatus.join(",");
    if (assignedAgentId) params.agent = assignedAgentId;

    setSearchParams(params, { replace: true });
  }, [
    search, projectId, priceMin, priceMax, floorMin, floorMax, areaMin, areaMax,
    selectedTypes, selectedViews, selectedStatus, assignedAgentId,
  ]);

  const handleTypeToggle = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleViewToggle = (view) => {
    setSelectedViews((prev) =>
      prev.includes(view) ? prev.filter((v) => v !== view) : [...prev, view]
    );
  };

  const handleStatusToggle = (status) => {
    setSelectedStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleReset = () => {
    setSearch("");
    setProjectId("");
    setPriceMin("");
    setPriceMax("");
    setFloorMin("");
    setFloorMax("");
    setAreaMin("");
    setAreaMax("");
    setSelectedTypes([]);
    setSelectedViews([]);
    setSelectedStatus([]);
    setAssignedAgentId("");
    setSearchParams({});
    onClear?.();
  };

  const activeCount = [
    search,
    projectId,
    priceMin || priceMax,
    floorMin || floorMax,
    areaMin || areaMax,
    selectedTypes.length > 0,
    selectedViews.length > 0,
    selectedStatus.length > 0,
    assignedAgentId,
  ].filter(Boolean).length;

  return _jsxs("div", {
    className: "w-72 bg-white border-r border-slate-200 flex flex-col max-h-screen overflow-y-auto",
    children: [
      // Header
      _jsxs("div", {
        className: "px-4 py-4 border-b border-slate-200",
        children: [
          _jsxs("div", {
            className: "flex items-center justify-between mb-3",
            children: [
              _jsx("h3", { className: "font-semibold text-slate-900", children: "Filters" }),
              activeCount > 0 && _jsxs("span", {
                className: "text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full",
                children: [activeCount, " active"],
              }),
            ],
          }),
          _jsx("input", {
            type: "text",
            placeholder: "Search unit number...",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400",
          }),
        ],
      }),

      // Scrollable content
      _jsxs("div", {
        className: "flex-1 overflow-y-auto px-4 py-4 space-y-5",
        children: [
          // Project
          projects.length > 0 && _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Project" }),
              _jsxs("select", {
                value: projectId,
                onChange: (e) => setProjectId(e.target.value),
                className: "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white",
                children: [
                  _jsx("option", { value: "", children: "All projects" }),
                  projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id)),
                ],
              }),
            ],
          }),

          // Price
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Price Range (AED)" }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx("input", {
                    type: "number",
                    placeholder: "Min",
                    value: priceMin,
                    onChange: (e) => setPriceMin(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                  _jsx("input", {
                    type: "number",
                    placeholder: "Max",
                    value: priceMax,
                    onChange: (e) => setPriceMax(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                ],
              }),
            ],
          }),

          // Floor
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Floor Range" }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx("input", {
                    type: "number",
                    placeholder: "Min",
                    value: floorMin,
                    onChange: (e) => setFloorMin(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                  _jsx("input", {
                    type: "number",
                    placeholder: "Max",
                    value: floorMax,
                    onChange: (e) => setFloorMax(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                ],
              }),
            ],
          }),

          // Area
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Area Range (sqm)" }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx("input", {
                    type: "number",
                    placeholder: "Min",
                    value: areaMin,
                    onChange: (e) => setAreaMin(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                  _jsx("input", {
                    type: "number",
                    placeholder: "Max",
                    value: areaMax,
                    onChange: (e) => setAreaMax(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                ],
              }),
            ],
          }),

          // Type
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Unit Type" }),
              _jsx("div", {
                className: "space-y-1.5",
                children: UNIT_TYPES.map((type) =>
                  _jsxs("label", {
                    className: "flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded",
                    children: [
                      _jsx("input", {
                        type: "checkbox",
                        checked: selectedTypes.includes(type),
                        onChange: () => handleTypeToggle(type),
                        className: "w-4 h-4 rounded border-slate-300 text-blue-600",
                      }),
                      _jsx("span", {
                        className: "text-sm text-slate-700",
                        children: type.replace(/_/g, " "),
                      }),
                    ],
                  }, type)
                ),
              }),
            ],
          }),

          // View
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "View" }),
              _jsx("div", {
                className: "space-y-1.5",
                children: VIEWS.map((view) =>
                  _jsxs("label", {
                    className: "flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded",
                    children: [
                      _jsx("input", {
                        type: "checkbox",
                        checked: selectedViews.includes(view),
                        onChange: () => handleViewToggle(view),
                        className: "w-4 h-4 rounded border-slate-300 text-blue-600",
                      }),
                      _jsx("span", {
                        className: "text-sm text-slate-700",
                        children: view,
                      }),
                    ],
                  }, view)
                ),
              }),
            ],
          }),

          // Status
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Status" }),
              _jsx("div", {
                className: "space-y-1.5",
                children: STATUSES.map((status) =>
                  _jsxs("label", {
                    className: "flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded",
                    children: [
                      _jsx("input", {
                        type: "checkbox",
                        checked: selectedStatus.includes(status),
                        onChange: () => handleStatusToggle(status),
                        className: "w-4 h-4 rounded border-slate-300 text-blue-600",
                      }),
                      _jsx("span", {
                        className: "text-sm text-slate-700",
                        children: status.replace(/_/g, " "),
                      }),
                    ],
                  }, status)
                ),
              }),
            ],
          }),

          // Assigned agent
          _jsxs("div", {
            children: [
              _jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Assigned Agent" }),
              _jsxs("select", {
                value: assignedAgentId,
                onChange: (e) => setAssignedAgentId(e.target.value),
                className: "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white",
                children: [
                  _jsx("option", { value: "", children: "All agents" }),
                  agents.map((agent) =>
                    _jsx("option", { value: agent.id, children: agent.name }, agent.id)
                  ),
                ],
              }),
            ],
          }),
        ],
      }),

      // Footer with clear button
      activeCount > 0 && _jsx("div", {
        className: "px-4 py-3 border-t border-slate-200",
        children: _jsx("button", {
          onClick: handleReset,
          className: "w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors",
          children: "Clear All Filters",
        }),
      }),
    ],
  });
}
