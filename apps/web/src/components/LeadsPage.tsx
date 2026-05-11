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
import {
  FilterBar,
  ActiveFilterChips,
  type ActiveFilterChip,
} from "./data";
import { Button } from "@/components/ui/button";
import { Smartphone, Handshake, Globe, Users, MessageCircle, Footprints, Circle } from "lucide-react";
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

const STAGES = ["NEW","CONTACTED","QUALIFIED","VIEWING","PROPOSAL","NEGOTIATING","CLOSED_WON","CLOSED_LOST"] as const;
// Kanban shows only the 5 active working stages.
// NEW (inbox) and CLOSED_WON/CLOSED_LOST (terminal) are filterable but not columns.
const ACTIVE_STAGES = ["CONTACTED","QUALIFIED","VIEWING","PROPOSAL","NEGOTIATING"] as const;

// Stage column header + dot. Maps each stage to design-system tokens.
// See design-system/MASTER.md and components/ui/stage-badge.tsx.
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

// Source badge tones — distinguishable, brand-coordinated. BROKER follows the
// secondary brand axis so it shifts with the user's secondary color.
const SOURCE_COLORS: Record<string, string> = {
  DIRECT:   "bg-info-soft text-info-soft-foreground",
  BROKER:   "bg-accent-2-soft text-accent-2-soft-foreground",
  WEBSITE:  "bg-chart-5/15 text-chart-5",
  REFERRAL: "bg-success-soft text-success-soft-foreground",
  WHATSAPP: "bg-success-soft text-success-soft-foreground",
  WALK_IN:  "bg-chart-3/15 text-chart-3",
};
const SOURCE_ICON: Record<string, LucideIcon> = {
  DIRECT:   Smartphone,
  BROKER:   Handshake,
  WEBSITE:  Globe,
  REFERRAL: Users,
  WHATSAPP: MessageCircle,
  WALK_IN:  Footprints,
};


function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function isOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

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
  const [showForm,     setShowForm]     = useState(false);
  const [allLeads,     setAllLeads]     = useState<Lead[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [openCardMenuId,  setOpenCardMenuId]  = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    setSearchParams(p, { replace: true });
  }, [search, stageFilter, sourceFilter, agentFilter, budgetMin, budgetMax]);

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

  const handleDeleteLead = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await axios.delete(`/api/leads/${id}`);
      fetchLeads(search, stageFilter);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  };

  const byStage = (stage: string) => allLeads.filter((l) => {
    if (l.stage !== stage) return false;
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (agentFilter && l.assignedAgent?.name !== agentFilter) return false;
    if (budgetMin && (l.budget ?? 0) < parseFloat(budgetMin)) return false;
    if (budgetMax && (l.budget ?? Infinity) > parseFloat(budgetMax)) return false;
    return true;
  });

  const handleCreated = () => {
    fetchLeads(search, stageFilter);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const sourceOptions = useMemo(
    () => [
      { value: "", label: "All sources" },
      ...["DIRECT", "BROKER", "WEBSITE", "REFERRAL", "WHATSAPP", "WALK_IN"].map((s) => ({
        value: s,
        label: s.replace(/_/g, " "),
      })),
    ],
    []
  );

  const agentOptions = useMemo(
    () => [
      { value: "", label: "All agents" },
      ...agents.map((a: { id: string; name: string }) => ({ value: a.name, label: a.name })),
    ],
    [agents]
  );

  const resetFilters = () => {
    setSourceFilter("");
    setAgentFilter("");
    setBudgetMin("");
    setBudgetMax("");
    setSearch("");
    setStageFilter("");
    fetchLeads("", "");
  };

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search) {
      chips.push({
        key: "search",
        label: "Search",
        value: search,
        onRemove: () => { setSearch(""); fetchLeads("", stageFilter); },
      });
    }
    if (sourceFilter) {
      chips.push({
        key: "source",
        label: "Source",
        value: sourceFilter.replace(/_/g, " "),
        onRemove: () => setSourceFilter(""),
      });
    }
    if (agentFilter) {
      chips.push({
        key: "agent",
        label: "Agent",
        value: agentFilter,
        onRemove: () => setAgentFilter(""),
      });
    }
    if (budgetMin || budgetMax) {
      const fmt = (v: string) => (v ? Number(v).toLocaleString() : "");
      const value = budgetMin && budgetMax
        ? `${fmt(budgetMin)} – ${fmt(budgetMax)}`
        : budgetMin
        ? `≥ ${fmt(budgetMin)}`
        : `≤ ${fmt(budgetMax)}`;
      chips.push({
        key: "budget",
        label: "Budget",
        value,
        onRemove: () => { setBudgetMin(""); setBudgetMax(""); },
      });
    }
    return chips;
  }, [search, sourceFilter, agentFilter, budgetMin, budgetMax, stageFilter, fetchLeads]);

  const stageTabs = (
    <div
      className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin"
      role="tablist"
      aria-label="Filter leads by stage"
    >
      {STAGES.map((s) => {
        const active = stageFilter === s;
        const style = STAGE_STYLE[s];
        return (
          <button
            key={s}
            onClick={() => handleStageFilter(s)}
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
              active
                ? `${style.header} border-current shadow-sm`
                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
            {s.replace(/_/g, " ")}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Leads" }]}
        title="Leads Pipeline"
        subtitle={`${total} leads total`}
        actions={<Button onClick={() => setShowForm(true)}>Create lead</Button>}
        tabs={stageTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {/* Phase J — Saved views (curated URL-preset shortcuts).
            Each button is a one-click filter combination that writes through
            to the URL (so it can be bookmarked/shared) via the existing
            stageFilter / sourceFilter / budgetMin state. */}
        <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Saved views">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mr-1">
            Views
          </span>
          {[
            { key: "all",       label: "All",         apply: () => { setStageFilter(""); setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); } },
            { key: "qualified", label: "Qualified+",  apply: () => { setStageFilter("QUALIFIED"); setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); } },
            { key: "negotiating", label: "Negotiating", apply: () => { setStageFilter("NEGOTIATING"); setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); } },
            { key: "highvalue", label: "High budget", apply: () => { setStageFilter(""); setSourceFilter(""); setAgentFilter(""); setBudgetMin("1000000"); setBudgetMax(""); } },
            { key: "broker",    label: "From broker", apply: () => { setStageFilter(""); setSourceFilter("BROKER"); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); } },
            { key: "won",       label: "Closed won",  apply: () => { setStageFilter("CLOSED_WON"); setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); } },
          ].map((view) => {
            // Active when the URL state currently matches this view's effect.
            const matchesAll       = !stageFilter && !sourceFilter && !agentFilter && !budgetMin && !budgetMax;
            const matchesQualified = stageFilter === "QUALIFIED" && !sourceFilter && !agentFilter && !budgetMin && !budgetMax;
            const matchesNeg       = stageFilter === "NEGOTIATING" && !sourceFilter && !agentFilter && !budgetMin && !budgetMax;
            const matchesHigh      = !stageFilter && !sourceFilter && !agentFilter && budgetMin === "1000000" && !budgetMax;
            const matchesBroker    = !stageFilter && sourceFilter === "BROKER" && !agentFilter && !budgetMin && !budgetMax;
            const matchesWon       = stageFilter === "CLOSED_WON" && !sourceFilter && !agentFilter && !budgetMin && !budgetMax;
            const isActive =
              (view.key === "all"         && matchesAll) ||
              (view.key === "qualified"   && matchesQualified) ||
              (view.key === "negotiating" && matchesNeg) ||
              (view.key === "highvalue"   && matchesHigh) ||
              (view.key === "broker"      && matchesBroker) ||
              (view.key === "won"         && matchesWon);
            return (
              <button
                key={view.key}
                type="button"
                onClick={view.apply}
                aria-pressed={isActive}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
        <FilterBar
          search={{
            value: search,
            onChange: handleSearchChange,
            placeholder: "Search name or phone…",
            ariaLabel: "Search leads",
          }}
          filters={[
            {
              key: "source",
              label: "Source",
              value: sourceFilter,
              onChange: setSourceFilter,
              options: sourceOptions,
            },
            {
              key: "agent",
              label: "Agent",
              value: agentFilter,
              onChange: setAgentFilter,
              options: agentOptions,
            },
          ]}
          extra={
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Budget min"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                aria-label="Budget minimum"
                className="h-9 w-28 text-sm border border-input rounded-lg px-2.5 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
              />
              <span className="text-muted-foreground text-sm" aria-hidden="true">–</span>
              <input
                type="number"
                placeholder="Budget max"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                aria-label="Budget maximum"
                className="h-9 w-28 text-sm border border-input rounded-lg px-2.5 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
              />
            </div>
          }
        />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
      </PageContainer>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto scrollbar-thin relative" role="region" aria-label="Leads pipeline. Scroll horizontally to see all stages.">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-destructive text-sm font-medium">{error}</p>
            <button
              onClick={() => fetchLeads(search, stageFilter)}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : allLeads.length === 0 ? (
          <EmptyState
            icon="◎"
            title={search ? "No leads match your search" : "No leads yet"}
            description={search ? "Try different keywords." : "Add your first lead to start filling the pipeline."}
            action={!search ? { label: "Create lead", onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <div className="flex gap-3 p-4 h-full min-w-max">
            {ACTIVE_STAGES.map((stage) => {
              const leads = byStage(stage);
              const style = STAGE_STYLE[stage];
              return (
                <div key={stage} className="w-64 flex flex-col bg-muted/40 rounded-xl border border-border overflow-hidden">
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
                        <p className="text-muted-foreground text-xs">No leads in this stage</p>
                      </div>
                    ) : (
                      leads.map((lead) => {
                        const daysSinceContact = daysSince(lead.lastContactedAt);
                        const followUpOverdue  = isOverdue(lead.nextFollowUpDate);
                        const stale            = daysSinceContact !== null && daysSinceContact > 7;
                        return (
                          <div
                            key={lead.id}
                            onClick={() => onViewLead ? onViewLead(lead.id) : navigate(`/leads/${lead.id}`)}
                            className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group relative"
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                                {lead.firstName} {lead.lastName}
                              </p>
                              <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                                {lead.source && (
                                  <span
                                    title={lead.source}
                                    className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[lead.source] || "bg-muted text-muted-foreground"}`}
                                  >
                                    {(() => {
                                      const Icon = SOURCE_ICON[lead.source] ?? Circle;
                                      return <Icon aria-hidden className="size-3" />;
                                    })()}
                                    <span className="hidden sm:inline">{lead.source}</span>
                                  </span>
                                )}
                                {/* Card action menu */}
                                <div onClick={(e) => e.stopPropagation()} className="relative">
                                  <button
                                    onClick={() => setOpenCardMenuId(openCardMenuId === lead.id ? null : lead.id)}
                                    className="p-0.5 text-muted-foreground/60 hover:text-foreground rounded opacity-0 group-hover:opacity-100 transition-all text-xs leading-none"
                                  >
                                    ⋮
                                  </button>
                                  {openCardMenuId === lead.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setOpenCardMenuId(null)} />
                                      <div className="absolute right-0 top-full mt-1 w-40 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg z-20 py-1">
                                        <button
                                          onClick={() => { setOpenCardMenuId(null); navigate(`/leads/${lead.id}`); }}
                                          className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                                        >View Profile</button>
                                        <button
                                          onClick={() => { setOpenCardMenuId(null); handleDeleteLead(lead.id); }}
                                          disabled={deletingId === lead.id}
                                          className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive-soft disabled:opacity-50 transition-colors"
                                        >Delete Lead</button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {lead.phone && (
                              <a
                                href={`tel:${lead.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="block text-xs text-primary hover:underline mb-2 tabular-nums"
                              >
                                {lead.phone}
                              </a>
                            )}

                            {lead.budget && (
                              <p className="text-xs text-muted-foreground mb-1.5">
                                <span>Budget </span>
                                <span className="font-medium text-foreground tabular-nums">{formatDirham(lead.budget)}</span>
                              </p>
                            )}

                            {lead.interests?.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate mb-1.5">
                                {lead.interests.map((i) => i.unit.unitNumber).join(", ")}
                              </p>
                            )}

                            {/* Urgency signals */}
                            {(stale || followUpOverdue) && (
                              <div className="flex flex-wrap gap-1 mb-1.5">
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

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                              <span className="text-[10px] text-muted-foreground">
                                {lead.assignedAgent?.name || "Unassigned"}
                              </span>
                              <div className="flex items-center gap-2">
                                {lead._count && (
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {lead._count.activities} act
                                  </span>
                                )}
                                {daysSinceContact !== null && !stale && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    </div>
  );
}
