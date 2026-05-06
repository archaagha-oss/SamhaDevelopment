import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAgents } from "../hooks/useAgents";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "OFFER_SENT", "SITE_VISIT", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];
const SOURCES = ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"];

export default function LeadSearchFilters({ onChange, onClear }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agents = [] } = useAgents();

  // Filter state
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedStages, setSelectedStages] = useState(
    searchParams.get("stages") ? searchParams.get("stages").split(",") : []
  );
  const [selectedSources, setSelectedSources] = useState(
    searchParams.get("sources") ? searchParams.get("sources").split(",") : []
  );
  const [budgetMin, setBudgetMin] = useState(searchParams.get("budgetMin") || "");
  const [budgetMax, setBudgetMax] = useState(searchParams.get("budgetMax") || "");
  const [daysMin, setDaysMin] = useState(searchParams.get("daysMin") || "");
  const [daysMax, setDaysMax] = useState(searchParams.get("daysMax") || "");
  const [assignedAgentId, setAssignedAgentId] = useState(searchParams.get("agent") || "");

  // Build filters object
  const buildFilters = () => ({
    search,
    stages: selectedStages,
    sources: selectedSources,
    budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
    budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
    daysMin: daysMin ? parseInt(daysMin) : undefined,
    daysMax: daysMax ? parseInt(daysMax) : undefined,
    assignedAgentId: assignedAgentId || undefined,
  });

  // Notify parent when filters change
  useEffect(() => {
    const filters = buildFilters();
    onChange?.(filters);

    // Update URL
    const params = {};
    if (search) params.search = search;
    if (selectedStages.length > 0) params.stages = selectedStages.join(",");
    if (selectedSources.length > 0) params.sources = selectedSources.join(",");
    if (budgetMin) params.budgetMin = budgetMin;
    if (budgetMax) params.budgetMax = budgetMax;
    if (daysMin) params.daysMin = daysMin;
    if (daysMax) params.daysMax = daysMax;
    if (assignedAgentId) params.agent = assignedAgentId;

    setSearchParams(params, { replace: true });
  }, [search, selectedStages, selectedSources, budgetMin, budgetMax, daysMin, daysMax, assignedAgentId]);

  const handleStageToggle = (stage) => {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  const handleSourceToggle = (source) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const handleReset = () => {
    setSearch("");
    setSelectedStages([]);
    setSelectedSources([]);
    setBudgetMin("");
    setBudgetMax("");
    setDaysMin("");
    setDaysMax("");
    setAssignedAgentId("");
    setSearchParams({});
    onClear?.();
  };

  const activeCount = [
    search,
    selectedStages.length > 0,
    selectedSources.length > 0,
    budgetMin,
    budgetMax,
    daysMin,
    daysMax,
    assignedAgentId,
  ].filter(Boolean).length;

  return _jsxs("div", {
    className: "w-64 bg-white border-r border-slate-200 flex flex-col max-h-screen overflow-y-auto",
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
            placeholder: "Search name, phone...",
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
          // Stages
          _jsxs("div", {
            children: [
              _jsx("label", {
                className: "block text-sm font-medium text-slate-700 mb-2",
                children: "Lead Stage",
              }),
              _jsx("div", {
                className: "space-y-1.5",
                children: STAGES.map((stage) =>
                  _jsxs("label", {
                    className: "flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded",
                    children: [
                      _jsx("input", {
                        type: "checkbox",
                        checked: selectedStages.includes(stage),
                        onChange: () => handleStageToggle(stage),
                        className: "w-4 h-4 rounded border-slate-300 text-blue-600",
                      }),
                      _jsx("span", {
                        className: "text-sm text-slate-700",
                        children: stage.replace(/_/g, " "),
                      }),
                    ],
                  }, stage)
                ),
              }),
            ],
          }),

          // Budget
          _jsxs("div", {
            children: [
              _jsx("label", {
                className: "block text-sm font-medium text-slate-700 mb-2",
                children: "Budget Range (AED)",
              }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx("input", {
                    type: "number",
                    placeholder: "Min",
                    value: budgetMin,
                    onChange: (e) => setBudgetMin(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                  _jsx("input", {
                    type: "number",
                    placeholder: "Max",
                    value: budgetMax,
                    onChange: (e) => setBudgetMax(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                ],
              }),
            ],
          }),

          // Days in stage
          _jsxs("div", {
            children: [
              _jsx("label", {
                className: "block text-sm font-medium text-slate-700 mb-2",
                children: "Days in Current Stage",
              }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx("input", {
                    type: "number",
                    placeholder: "Min",
                    value: daysMin,
                    onChange: (e) => setDaysMin(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                  _jsx("input", {
                    type: "number",
                    placeholder: "Max",
                    value: daysMax,
                    onChange: (e) => setDaysMax(e.target.value),
                    className: "flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400",
                  }),
                ],
              }),
            ],
          }),

          // Assigned agent
          _jsxs("div", {
            children: [
              _jsx("label", {
                className: "block text-sm font-medium text-slate-700 mb-2",
                children: "Assigned Agent",
              }),
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

          // Sources
          _jsxs("div", {
            children: [
              _jsx("label", {
                className: "block text-sm font-medium text-slate-700 mb-2",
                children: "Source",
              }),
              _jsx("div", {
                className: "space-y-1.5",
                children: SOURCES.map((source) =>
                  _jsxs("label", {
                    className: "flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded",
                    children: [
                      _jsx("input", {
                        type: "checkbox",
                        checked: selectedSources.includes(source),
                        onChange: () => handleSourceToggle(source),
                        className: "w-4 h-4 rounded border-slate-300 text-blue-600",
                      }),
                      _jsx("span", {
                        className: "text-sm text-slate-700",
                        children: source,
                      }),
                    ],
                  }, source)
                ),
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
