import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { formatDirham } from "@/lib/money";
import { useAgents } from "../hooks/useAgents";
import QuickLeadModal from "./QuickLeadModal";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import { PageContainer, PageHeader } from "./layout";
import { ActiveFilterChips, type ActiveFilterChip } from "./data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Smartphone, Handshake, Globe, Users, MessageCircle, Footprints, Circle,
  LayoutGrid, List as ListIcon, Filter, Search, MoreVertical, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  stage: string;
  source: string;
  budget?: number;
  assignedAgent?: { name: string };
  interests: { unit: { unitNumber: string } }[];
  _count?: { activities: number; tasks: number };
  lastContactedAt?: string | null;
  nextFollowUpDate?: string | null;
}

// Kanban columns. NEW is the inbox (leftmost) so newly-created leads are
// visible by default. CLOSED_WON / CLOSED_LOST are terminal and stay off
// the board — they're reachable via the "More" dropdown for retrospectives.
const ACTIVE_STAGES = ["NEW","CONTACTED","QUALIFIED","VIEWING","PROPOSAL","NEGOTIATING"] as const;
const EXTRA_STAGES  = ["CLOSED_WON","CLOSED_LOST"] as const;

const STAGE_STYLE: Record<string, { header: string; dot: string }> = {
  NEW:         { header: "bg-stage-neutral text-stage-neutral-foreground",     dot: "bg-neutral-400" },
  CONTACTED:   { header: "bg-stage-progress text-stage-progress-foreground",   dot: "bg-brand-500" },
  QUALIFIED:   { header: "bg-stage-active text-stage-active-foreground",       dot: "bg-accent-2" },
  VIEWING:     { header: "bg-stage-info text-stage-info-foreground",           dot: "bg-chart-5" },
  PROPOSAL:    { header: "bg-stage-active text-stage-active-foreground",       dot: "bg-accent-2" },
  NEGOTIATING: { header: "bg-stage-attention text-stage-attention-foreground", dot: "bg-warning" },
  CLOSED_WON:  { header: "bg-stage-success text-stage-success-foreground",     dot: "bg-success" },
  CLOSED_LOST: { header: "bg-stage-danger text-stage-danger-foreground",       dot: "bg-destructive" },
};

const SOURCE_COLORS: Record<string, string> = {
  DIRECT:   "bg-info-soft text-info-soft-foreground",
  BROKER:   "bg-accent-2-soft text-accent-2-soft-foreground",
  WEBSITE:  "bg-chart-5/15 text-chart-5",
  REFERRAL: "bg-success-soft text-success-soft-foreground",
  WHATSAPP: "bg-success-soft text-success-soft-foreground",
  WALK_IN:  "bg-chart-3/15 text-chart-3",
};
const SOURCE_ICON: Record<string, LucideIcon> = {
  DIRECT: Smartphone, BROKER: Handshake, WEBSITE: Globe,
  REFERRAL: Users, WHATSAPP: MessageCircle, WALK_IN: Footprints,
};

function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function isOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

type View = "kanban" | "table";
type Density = "compact" | "comfortable";

interface Props {
  onViewLead?: (id: string) => void;
}

export default function LeadsPage({ onViewLead }: Props = {}) {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const { data: agents = [] } = useAgents();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search,       setSearch]       = useState(searchParams.get("q") || "");
  const [stageFilter,  setStageFilter]  = useState<string>(searchParams.get("stage") || "");
  const [sourceFilter, setSourceFilter] = useState<string>(searchParams.get("source") || "");
  const [agentFilter,  setAgentFilter]  = useState<string>(searchParams.get("agent") || "");
  const [budgetMin,    setBudgetMin]    = useState<string>(searchParams.get("min") || "");
  const [budgetMax,    setBudgetMax]    = useState<string>(searchParams.get("max") || "");
  const [view,         setView]         = useState<View>((searchParams.get("view") as View) || "kanban");
  const [density,      setDensity]      = useState<Density>("compact");
  const [showForm,     setShowForm]     = useState(false);
  const [allLeads,     setAllLeads]     = useState<Lead[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback((q: string, stage: string) => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page: "1", limit: "200" };
    if (q)     params.search = q;
    if (stage) params.stage  = stage;
    axios.get("/api/leads", { params })
      .then((r) => {
        const data = r.data.data ?? r.data;
        setAllLeads(Array.isArray(data) ? data : []);
        setTotal(r.data.pagination?.total ?? (Array.isArray(data) ? data.length : 0));
      })
      .catch((err) => setError(err.response?.data?.error || "Failed to load leads"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLeads(search, stageFilter); }, [fetchLeads]);

  useEffect(() => {
    const p: Record<string, string> = {};
    if (search)       p.q      = search;
    if (stageFilter)  p.stage  = stageFilter;
    if (sourceFilter) p.source = sourceFilter;
    if (agentFilter)  p.agent  = agentFilter;
    if (budgetMin)    p.min    = budgetMin;
    if (budgetMax)    p.max    = budgetMax;
    if (view !== "kanban") p.view = view;
    setSearchParams(p, { replace: true });
  }, [search, stageFilter, sourceFilter, agentFilter, budgetMin, budgetMax, view]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchLeads(val, stageFilter), 350);
  };

  const handleStageFilter = (stage: string) => {
    const next = stageFilter === stage ? "" : stage;
    setStageFilter(next);
    fetchLeads(search, next);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    try {
      await axios.delete(`/api/leads/${id}`);
      fetchLeads(search, stageFilter);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete lead");
    }
  };

  // ── Client-side filter (source / agent / budget) ────────────────────────────
  const visibleLeads = useMemo(() => allLeads.filter((l) => {
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (agentFilter && l.assignedAgent?.name !== agentFilter) return false;
    if (budgetMin && (l.budget ?? 0) < parseFloat(budgetMin)) return false;
    if (budgetMax && (l.budget ?? Infinity) > parseFloat(budgetMax)) return false;
    return true;
  }), [allLeads, sourceFilter, agentFilter, budgetMin, budgetMax]);

  const byStage = (stage: string) => visibleLeads.filter((l) => l.stage === stage);

  // ── KPI strip values ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const openLeads = visibleLeads.filter((l) => !["CLOSED_WON","CLOSED_LOST"].includes(l.stage));
    const openValue = openLeads.reduce((sum, l) => sum + (l.budget ?? 0), 0);
    const wonThisMonth = visibleLeads.filter((l) => {
      if (l.stage !== "CLOSED_WON" || !l.lastContactedAt) return false;
      const d = new Date(l.lastContactedAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const stale = visibleLeads.filter((l) => {
      const days = daysSince(l.lastContactedAt);
      return !["CLOSED_WON","CLOSED_LOST"].includes(l.stage) && days !== null && days > 7;
    }).length;
    return { openValue, openLeads: openLeads.length, wonThisMonth, stale };
  }, [visibleLeads]);

  const handleCreated = () => {
    fetchLeads(search, stageFilter);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const sourceOptions = useMemo(
    () => ["DIRECT", "BROKER", "WEBSITE", "REFERRAL", "WHATSAPP", "WALK_IN"],
    []
  );

  const resetFilters = () => {
    setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax("");
    setSearch(""); setStageFilter("");
    fetchLeads("", "");
  };

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search) chips.push({ key: "search", label: "Search", value: search, onRemove: () => { setSearch(""); fetchLeads("", stageFilter); } });
    if (sourceFilter) chips.push({ key: "source", label: "Source", value: sourceFilter.replace(/_/g, " "), onRemove: () => setSourceFilter("") });
    if (agentFilter) chips.push({ key: "agent", label: "Agent", value: agentFilter, onRemove: () => setAgentFilter("") });
    if (budgetMin || budgetMax) {
      const fmt = (v: string) => (v ? Number(v).toLocaleString() : "");
      const value = budgetMin && budgetMax ? `${fmt(budgetMin)} – ${fmt(budgetMax)}`
        : budgetMin ? `≥ ${fmt(budgetMin)}` : `≤ ${fmt(budgetMax)}`;
      chips.push({ key: "budget", label: "Budget", value, onRemove: () => { setBudgetMin(""); setBudgetMax(""); } });
    }
    return chips;
  }, [search, sourceFilter, agentFilter, budgetMin, budgetMax, stageFilter, fetchLeads]);

  // ── Drag-and-drop: stage change ─────────────────────────────────────────────
  const dropOnStage = async (newStage: string) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;
    const lead = allLeads.find((l) => l.id === id);
    if (!lead || lead.stage === newStage) return;
    // Optimistic update
    setAllLeads((prev) => prev.map((l) => l.id === id ? { ...l, stage: newStage } : l));
    try {
      await axios.patch(`/api/leads/${id}/stage`, { newStage });
      toast.success(`Moved to ${newStage.replace(/_/g, " ")}`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      // Rollback
      setAllLeads((prev) => prev.map((l) => l.id === id ? { ...l, stage: lead.stage } : l));
      toast.error(err.response?.data?.error || "Failed to change stage");
    }
  };

  // ── Bulk selection helpers ──────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(visibleLeads.map((l) => l.id)));

  const bulkReassign = async (agentName: string) => {
    const target = agents.find((a) => a.name === agentName);
    if (!target) return;
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) =>
        axios.patch(`/api/leads/${id}`, { assignedAgentId: target.id })
      ));
      toast.success(`Reassigned ${selectedIds.size} leads to ${agentName}`);
      clearSelection();
      fetchLeads(search, stageFilter);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Bulk reassign failed");
    } finally {
      setBulkBusy(false);
    }
  };
  const bulkChangeStage = async (newStage: string) => {
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) =>
        axios.patch(`/api/leads/${id}/stage`, { newStage })
      ));
      toast.success(`Moved ${selectedIds.size} leads to ${newStage.replace(/_/g, " ")}`);
      clearSelection();
      fetchLeads(search, stageFilter);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Bulk stage change failed");
    } finally {
      setBulkBusy(false);
    }
  };
  const bulkDelete = async () => {
    setConfirmBulkDelete(false);
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => axios.delete(`/api/leads/${id}`)));
      toast.success(`Deleted ${selectedIds.size} leads`);
      clearSelection();
      fetchLeads(search, stageFilter);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const anyAdvancedFilter = !!(sourceFilter || agentFilter || budgetMin || budgetMax);

  // ── Stage chip strip (active 5 + "More" for NEW/CLOSED_*) ───────────────────
  const stageTabs = (
    <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Filter leads by stage">
      {ACTIVE_STAGES.map((s) => {
        const active = stageFilter === s;
        const style = STAGE_STYLE[s];
        return (
          <button
            key={s}
            onClick={() => handleStageFilter(s)}
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
              active ? `${style.header} border-current shadow-sm` : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
            {s.replace(/_/g, " ")}
          </button>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border shrink-0 ${
              EXTRA_STAGES.includes(stageFilter as any)
                ? `${STAGE_STYLE[stageFilter]?.header} border-current shadow-sm`
                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {EXTRA_STAGES.includes(stageFilter as any) ? stageFilter.replace(/_/g, " ") : "More"} ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {EXTRA_STAGES.map((s) => (
            <DropdownMenuItem key={s} onClick={() => handleStageFilter(s)}>
              <span className={`w-2 h-2 rounded-full ${STAGE_STYLE[s].dot} mr-2`} />
              {s.replace(/_/g, " ")}
            </DropdownMenuItem>
          ))}
          {stageFilter && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStageFilter(stageFilter)}>
                Clear stage filter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── Compact filter zone (single row) ────────────────────────────────────────
  const filterZone = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search name or phone…"
          aria-label="Search leads"
          className="w-full h-9 pl-8 pr-3 text-sm border border-input rounded-lg bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium border rounded-lg ${
              anyAdvancedFilter ? "border-primary/40 bg-info-soft text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="size-3.5" />
            Filters
            {anyAdvancedFilter && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {[sourceFilter, agentFilter, budgetMin || budgetMax].filter(Boolean).length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-3 space-y-3">
          <DropdownMenuLabel className="px-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Filters
          </DropdownMenuLabel>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All sources</option>
              {sourceOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Agent</label>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All agents</option>
              {agents.map((a: any) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Budget range</label>
            <div className="flex items-center gap-1.5">
              <input type="number" placeholder="Min" value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                className="h-8 w-full text-sm border border-input rounded-md px-2 bg-card tabular-nums" />
              <span className="text-muted-foreground text-sm">–</span>
              <input type="number" placeholder="Max" value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className="h-8 w-full text-sm border border-input rounded-md px-2 bg-card tabular-nums" />
            </div>
          </div>
          {anyAdvancedFilter && (
            <button
              onClick={() => { setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground border border-border rounded-md py-1.5"
            >
              Clear filters
            </button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setView("kanban")}
          aria-label="Kanban view"
          aria-pressed={view === "kanban"}
          className={`h-9 px-2.5 text-sm inline-flex items-center gap-1 ${
            view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="size-3.5" /> Kanban
        </button>
        <button
          onClick={() => setView("table")}
          aria-label="Table view"
          aria-pressed={view === "table"}
          className={`h-9 px-2.5 text-sm inline-flex items-center gap-1 ${
            view === "table" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListIcon className="size-3.5" /> Table
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-9 px-2.5 text-xs font-medium border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground">
            {density === "compact" ? "Compact" : "Comfortable"} ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDensity("compact")}>Compact</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDensity("comfortable")}>Comfortable</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── KPI strip ───────────────────────────────────────────────────────────────
  const kpiStrip = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Open pipeline</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.openValue ? formatDirham(kpis.openValue) : "—"}</div>
        <div className="text-[11px] text-muted-foreground">{kpis.openLeads} open leads</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Won this month</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.wonThisMonth}</div>
        <div className="text-[11px] text-muted-foreground">leads closed-won</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Stale &gt; 7d</div>
        <div className={`text-lg font-bold tabular-nums ${kpis.stale > 0 ? "text-warning" : "text-foreground"}`}>{kpis.stale}</div>
        <div className="text-[11px] text-muted-foreground">need follow-up</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{total}</div>
        <div className="text-[11px] text-muted-foreground">all leads</div>
      </div>
    </div>
  );

  // ── Lead card (Kanban) ──────────────────────────────────────────────────────
  const renderLeadCard = (lead: Lead) => {
    const daysSinceContact = daysSince(lead.lastContactedAt);
    const followUpOverdue  = isOverdue(lead.nextFollowUpDate);
    const stale            = daysSinceContact !== null && daysSinceContact > 7;
    const selected         = selectedIds.has(lead.id);
    const Icon             = SOURCE_ICON[lead.source] ?? Circle;
    const isComfortable    = density === "comfortable";

    return (
      <div
        key={lead.id}
        draggable
        onDragStart={() => setDraggingId(lead.id)}
        onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
        onClick={(e) => {
          // Don't navigate on checkbox / menu / source-chip clicks
          if ((e.target as HTMLElement).closest("[data-stop-nav]")) return;
          if (onViewLead) onViewLead(lead.id); else navigate(`/leads/${lead.id}`);
        }}
        className={`bg-card rounded-lg border p-2.5 cursor-pointer hover:shadow-sm transition-all group relative ${
          selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
        } ${draggingId === lead.id ? "opacity-40" : ""}`}
      >
        <div className="flex items-start gap-2">
          <input
            data-stop-nav
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(lead.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${lead.firstName} ${lead.lastName}`}
            className={`mt-0.5 w-3.5 h-3.5 rounded transition-opacity ${
              selectedIds.size > 0 || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-sm font-semibold text-foreground leading-tight truncate group-hover:text-primary">
                {lead.firstName} {lead.lastName}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                {lead.source && (
                  <span
                    title={lead.source}
                    className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[lead.source] || "bg-muted text-muted-foreground"}`}
                  >
                    <Icon aria-hidden className="size-3" />
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-stop-nav
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Lead actions"
                      className="p-0.5 text-muted-foreground/70 hover:text-foreground rounded transition-colors"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>View profile</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}/edit`)}>Edit lead</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDeleteId(lead.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {lead.phone && (
              <a
                data-stop-nav
                href={`tel:${lead.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="block text-xs text-primary hover:underline tabular-nums truncate"
              >
                {lead.phone}
              </a>
            )}
            {(stale || followUpOverdue) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {followUpOverdue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive-soft text-destructive-soft-foreground font-semibold">
                    Follow-up overdue
                  </span>
                )}
                {stale && !followUpOverdue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-soft text-warning-soft-foreground font-medium">
                    {daysSinceContact}d no contact
                  </span>
                )}
              </div>
            )}
            {isComfortable && (
              <>
                {lead.budget && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    <span>Budget </span>
                    <span className="font-medium text-foreground tabular-nums">{formatDirham(lead.budget)}</span>
                  </p>
                )}
                {lead.interests?.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    Units: {lead.interests.map((i) => i.unit.unitNumber).join(", ")}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  <span className="text-[10px] text-muted-foreground">{lead.assignedAgent?.name || "Unassigned"}</span>
                  <div className="flex items-center gap-2">
                    {lead._count && <span className="text-[10px] text-muted-foreground tabular-nums">{lead._count.activities} act</span>}
                    {daysSinceContact !== null && !stale && (
                      <span className="text-[10px] text-muted-foreground">
                        {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Table view ──────────────────────────────────────────────────────────────
  const tableView = (
    <div className="overflow-auto bg-card rounded-xl border border-border mx-4 my-3">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2.5 text-left w-8">
              <input
                type="checkbox"
                aria-label="Select all visible"
                checked={visibleLeads.length > 0 && selectedIds.size === visibleLeads.length}
                onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
              />
            </th>
            <th className="px-3 py-2.5 text-left">Name</th>
            <th className="px-3 py-2.5 text-left">Stage</th>
            <th className="px-3 py-2.5 text-left">Source</th>
            <th className="px-3 py-2.5 text-left">Phone</th>
            <th className="px-3 py-2.5 text-right">Budget</th>
            <th className="px-3 py-2.5 text-left">Agent</th>
            <th className="px-3 py-2.5 text-left">Last contact</th>
            <th className="px-3 py-2.5 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleLeads.map((lead) => {
            const days = daysSince(lead.lastContactedAt);
            const selected = selectedIds.has(lead.id);
            const Icon = SOURCE_ICON[lead.source] ?? Circle;
            const style = STAGE_STYLE[lead.stage];
            return (
              <tr
                key={lead.id}
                onClick={() => onViewLead ? onViewLead(lead.id) : navigate(`/leads/${lead.id}`)}
                className={`cursor-pointer hover:bg-muted/30 ${selected ? "bg-info-soft/40" : ""}`}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(lead.id)}
                    aria-label={`Select ${lead.firstName} ${lead.lastName}`}
                  />
                </td>
                <td className="px-3 py-2.5 font-medium text-foreground">{lead.firstName} {lead.lastName}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${style?.header}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style?.dot}`} />
                    {lead.stage.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[lead.source] || "bg-muted text-muted-foreground"}`}>
                    <Icon className="size-3" /> {lead.source.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-primary tabular-nums">{lead.phone}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{lead.budget ? formatDirham(lead.budget) : "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{lead.assignedAgent?.name || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {days === null ? "—" : days === 0 ? "Today" : `${days}d ago`}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Lead actions" className="p-1 text-muted-foreground hover:text-foreground rounded">
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>View profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}/edit`)}>Edit lead</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirmDeleteId(lead.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── Kanban view ─────────────────────────────────────────────────────────────
  const kanbanView = (
    <div className="flex gap-3 p-4 h-full min-w-max">
      {ACTIVE_STAGES.map((stage) => {
        const leads = byStage(stage);
        const style = STAGE_STYLE[stage];
        const isDragOver = dragOverStage === stage;
        return (
          <div
            key={stage}
            onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
            onDragLeave={() => setDragOverStage((prev) => prev === stage ? null : prev)}
            onDrop={() => dropOnStage(stage)}
            className={`w-64 flex flex-col bg-muted/40 rounded-xl border overflow-hidden transition-colors ${
              isDragOver ? "border-primary ring-2 ring-primary/30 bg-info-soft/30" : "border-border"
            }`}
          >
            <div className={`flex items-center justify-between px-3 py-2.5 ${style.header}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className="text-xs font-semibold">{stage.replace(/_/g, " ")}</span>
              </div>
              <span className="text-xs font-bold opacity-70 tabular-nums">{leads.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
              {leads.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-muted-foreground text-xs">
                    {isDragOver ? "Drop here" : "No leads in this stage"}
                  </p>
                </div>
              ) : leads.map(renderLeadCard)}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Leads" }]}
        title="Leads"
        subtitle={`${total} leads total`}
        actions={<Button onClick={() => setShowForm(true)}>Create lead</Button>}
        tabs={stageTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {kpiStrip}
        {filterZone}
        {activeChips.length > 0 && (
          <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
        )}
      </PageContainer>

      <div className="flex-1 overflow-x-auto scrollbar-thin relative" role="region" aria-label="Leads">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-destructive text-sm font-medium">{error}</p>
            <button onClick={() => fetchLeads(search, stageFilter)}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90">
              Retry
            </button>
          </div>
        ) : visibleLeads.length === 0 ? (
          <EmptyState
            icon="◎"
            title={search || anyAdvancedFilter ? "No leads match your filters" : "No leads yet"}
            description={search || anyAdvancedFilter ? "Try different keywords or clear filters." : "Add your first lead to start filling the pipeline."}
            action={!search && !anyAdvancedFilter ? { label: "Create lead", onClick: () => setShowForm(true) } : undefined}
          />
        ) : view === "kanban" ? kanbanView : tableView}
      </div>

      {/* ── Bulk action bar (sticky bottom when selection > 0) ─────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded-xl shadow-lg flex items-center gap-2 px-3 py-2 w-[min(720px,calc(100vw-2rem))]">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {selectedIds.size} selected
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button disabled={bulkBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted/60 disabled:opacity-50">
                Change stage ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[...ACTIVE_STAGES, ...EXTRA_STAGES].map((s) => (
                <DropdownMenuItem key={s} onClick={() => bulkChangeStage(s)}>
                  Move to {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button disabled={bulkBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted/60 disabled:opacity-50">
                Reassign ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {agents.length === 0 ? (
                <DropdownMenuItem disabled>No agents</DropdownMenuItem>
              ) : agents.map((a: any) => (
                <DropdownMenuItem key={a.id} onClick={() => bulkReassign(a.name)}>{a.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            disabled={bulkBusy}
            onClick={() => setConfirmBulkDelete(true)}
            className="text-xs font-medium text-destructive hover:bg-destructive-soft px-2.5 py-1.5 rounded-md disabled:opacity-50"
          >
            Delete
          </button>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            aria-label="Clear selection"
            className="p-1 text-muted-foreground hover:text-foreground rounded"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {showForm && (
        <QuickLeadModal onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Lead"
        message="Delete this lead? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        title="Delete leads"
        message={`Delete ${selectedIds.size} leads? This cannot be undone.`}
        confirmLabel="Delete all"
        variant="danger"
        onConfirm={bulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
