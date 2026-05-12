import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { formatDirham } from "@/lib/money";
import { useDeals } from "../hooks/useDeals";
import EmptyState from "./EmptyState";
import ConfirmDialog from "./ConfirmDialog";
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
  LayoutGrid, List as ListIcon, Filter, Search, MoreVertical, X,
  AlertTriangle, Handshake,
} from "lucide-react";

interface Deal {
  id: string;
  dealNumber: string;
  lead: { id?: string; firstName: string; lastName: string; phone?: string };
  unit: { unitNumber: string; type: string; price?: number };
  stage: string;
  salePrice: number;
  discount?: number;
  reservationDate: string;
  payments?: { status: string; amount: number; dueDate?: string }[];
  commission?: { status: string; amount: number };
  oqoodDeadline?: string;
  brokerCompany?: { name: string } | null;
}

// Kanban columns. Terminal stages live in the "More" dropdown.
const ACTIVE_STAGES = [
  "RESERVATION_PENDING", "RESERVATION_CONFIRMED",
  "SPA_PENDING", "SPA_SENT", "SPA_SIGNED",
  "OQOOD_PENDING", "OQOOD_REGISTERED",
  "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING",
] as const;
const EXTRA_STAGES = ["COMPLETED", "CANCELLED"] as const;

const STAGE_STYLE: Record<string, { header: string; dot: string }> = {
  RESERVATION_PENDING:   { header: "bg-stage-neutral text-stage-neutral-foreground",     dot: "bg-neutral-400" },
  RESERVATION_CONFIRMED: { header: "bg-stage-progress text-stage-progress-foreground",   dot: "bg-brand-500" },
  SPA_PENDING:           { header: "bg-stage-attention text-stage-attention-foreground", dot: "bg-warning" },
  SPA_SENT:              { header: "bg-stage-attention text-stage-attention-foreground", dot: "bg-warning" },
  SPA_SIGNED:            { header: "bg-stage-active text-stage-active-foreground",       dot: "bg-accent-2" },
  OQOOD_PENDING:         { header: "bg-stage-attention text-stage-attention-foreground", dot: "bg-warning" },
  OQOOD_REGISTERED:      { header: "bg-stage-info text-stage-info-foreground",           dot: "bg-chart-5" },
  INSTALLMENTS_ACTIVE:   { header: "bg-stage-active text-stage-active-foreground",       dot: "bg-accent-2" },
  HANDOVER_PENDING:      { header: "bg-stage-success text-stage-success-foreground",     dot: "bg-success" },
  COMPLETED:             { header: "bg-stage-success text-stage-success-foreground",     dot: "bg-success" },
  CANCELLED:             { header: "bg-stage-danger text-stage-danger-foreground",       dot: "bg-destructive" },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  RESERVATION_PENDING:   ["RESERVATION_CONFIRMED", "CANCELLED"],
  RESERVATION_CONFIRMED: ["SPA_PENDING", "CANCELLED"],
  SPA_PENDING:           ["SPA_SENT", "CANCELLED"],
  SPA_SENT:              ["SPA_SIGNED", "CANCELLED"],
  SPA_SIGNED:            ["OQOOD_PENDING", "CANCELLED"],
  OQOOD_PENDING:         ["OQOOD_REGISTERED", "CANCELLED"],
  OQOOD_REGISTERED:      ["INSTALLMENTS_ACTIVE", "CANCELLED"],
  INSTALLMENTS_ACTIVE:   ["HANDOVER_PENDING", "CANCELLED"],
  HANDOVER_PENDING:      ["COMPLETED", "CANCELLED"],
  COMPLETED:             [],
  CANCELLED:             [],
};

const COM_BADGE: Record<string, string> = {
  NOT_DUE:          "text-muted-foreground",
  PENDING_APPROVAL: "text-warning font-semibold",
  APPROVED:         "text-primary font-semibold",
  PAID:             "text-success font-semibold",
  CANCELLED:        "text-destructive",
};

function paymentProgress(deal: Deal): number {
  if (!deal.payments?.length) return 0;
  return Math.round(deal.payments.filter((p) => p.status === "PAID").length / deal.payments.length * 100);
}
function hasOverduePayment(deal: Deal): boolean {
  return !!deal.payments?.some((p) => p.status === "OVERDUE");
}
function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

type View = "kanban" | "table";
type Density = "compact" | "comfortable";

interface Props {
  onViewDeal?: (id: string) => void;
}

export default function DealsPage({ onViewDeal }: Props = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search,       setSearch]       = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");
  const [stageFilter,  setStageFilter]  = useState<string>(searchParams.get("stage") || "");
  const [brokerFilter, setBrokerFilter] = useState<string>(searchParams.get("broker") || "");
  const [paymentFilter, setPaymentFilter] = useState<string>(searchParams.get("payment") || "");
  const [priceMin,     setPriceMin]     = useState<string>(searchParams.get("min") || "");
  const [priceMax,     setPriceMax]     = useState<string>(searchParams.get("max") || "");
  const [view,         setView]         = useState<View>((searchParams.get("view") as View) || "kanban");
  const [density,      setDensity]      = useState<Density>("compact");
  const [currentPage,  setCurrentPage]  = useState(Number(searchParams.get("page")) || 1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: dealsResponse, isLoading: loading } = useDeals(
    currentPage, 200, stageFilter || null, debouncedSearch || undefined
  );
  const allDeals: Deal[] = (dealsResponse?.data || []) as Deal[];
  const total = dealsResponse?.pagination.total || 0;

  // ── Debounced search ────────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1);
    }, 350);
  };

  const handleStageFilter = (stage: string) => {
    setStageFilter((prev) => prev === stage ? "" : stage);
    setCurrentPage(1);
  };

  // ── URL sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.q       = debouncedSearch;
    if (stageFilter)     p.stage   = stageFilter;
    if (brokerFilter)    p.broker  = brokerFilter;
    if (paymentFilter)   p.payment = paymentFilter;
    if (priceMin)        p.min     = priceMin;
    if (priceMax)        p.max     = priceMax;
    if (view !== "kanban") p.view  = view;
    if (currentPage > 1) p.page    = String(currentPage);
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, stageFilter, brokerFilter, paymentFilter, priceMin, priceMax, view, currentPage]);

  // ── Client-side filter (broker / payment / price) ───────────────────────
  const visibleDeals = useMemo(() => allDeals.filter((d) => {
    if (brokerFilter && d.brokerCompany?.name !== brokerFilter) return false;
    if (paymentFilter === "overdue" && !hasOverduePayment(d)) return false;
    if (paymentFilter === "paid" && !(d.payments?.length && d.payments.every((p) => p.status === "PAID"))) return false;
    if (paymentFilter === "partial" && !d.payments?.some((p) => p.status === "PARTIAL")) return false;
    if (priceMin && d.salePrice < parseFloat(priceMin)) return false;
    if (priceMax && d.salePrice > parseFloat(priceMax)) return false;
    return true;
  }), [allDeals, brokerFilter, paymentFilter, priceMin, priceMax]);

  const byStage = (stage: string) => visibleDeals.filter((d) => d.stage === stage);

  // ── Broker options (derived from data) ──────────────────────────────────
  const brokerOptions = useMemo(() => {
    const set = new Set<string>();
    allDeals.forEach((d) => { if (d.brokerCompany?.name) set.add(d.brokerCompany.name); });
    return Array.from(set).sort();
  }, [allDeals]);

  // ── KPI strip values ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const open = visibleDeals.filter((d) => !["COMPLETED", "CANCELLED"].includes(d.stage));
    const openValue = open.reduce((s, d) => s + (d.salePrice ?? 0), 0);
    const completedThisMonth = visibleDeals.filter((d) => {
      if (d.stage !== "COMPLETED") return false;
      const ref = new Date(d.reservationDate);
      const now = new Date();
      return ref.getMonth() === now.getMonth() && ref.getFullYear() === now.getFullYear();
    }).length;
    const overdueCount = visibleDeals.filter(hasOverduePayment).length;
    return { openValue, openDeals: open.length, completedThisMonth, overdueCount };
  }, [visibleDeals]);

  const anyAdvancedFilter = !!(brokerFilter || paymentFilter || priceMin || priceMax);

  // ── Drag-and-drop: stage change ─────────────────────────────────────────
  const dropOnStage = async (targetStage: string) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;
    const deal = allDeals.find((d) => d.id === id);
    if (!deal || deal.stage === targetStage) return;
    const allowed = VALID_TRANSITIONS[deal.stage] || [];
    if (!allowed.includes(targetStage)) {
      toast.error(`Cannot move ${deal.dealNumber}: ${deal.stage.replace(/_/g, " ")} → ${targetStage.replace(/_/g, " ")} is not allowed.`);
      return;
    }
    setMovingId(deal.id);
    try {
      await axios.patch(`/api/deals/${deal.id}/stage`, { newStage: targetStage });
      toast.success(`Moved to ${targetStage.replace(/_/g, " ")}`);
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `Cannot move to ${targetStage.replace(/_/g, " ")}`);
    } finally {
      setMovingId(null);
    }
  };

  // ── Delete (with cancel-then-delete to satisfy API stage rule) ──────────
  const confirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    const deal = allDeals.find((d) => d.id === id);
    if (!deal) return;
    try {
      if (deal.stage !== "RESERVATION_PENDING" && deal.stage !== "CANCELLED") {
        await axios.patch(`/api/deals/${id}/stage`, { newStage: "CANCELLED", reason: "Deleted from list" });
      }
      await axios.delete(`/api/deals/${id}`);
      toast.success("Deal deleted. Lead preserved.");
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete deal");
    }
  };

  // ── Bulk selection ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(visibleDeals.map((d) => d.id)));

  const bulkChangeStage = async (newStage: string) => {
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) =>
        axios.patch(`/api/deals/${id}/stage`, { newStage })
      ));
      toast.success(`Moved ${selectedIds.size} deals to ${newStage.replace(/_/g, " ")}`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["deals"] });
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
      for (const id of Array.from(selectedIds)) {
        const d = allDeals.find((x) => x.id === id);
        if (!d) continue;
        if (d.stage !== "RESERVATION_PENDING" && d.stage !== "CANCELLED") {
          await axios.patch(`/api/deals/${id}/stage`, { newStage: "CANCELLED", reason: "Bulk delete" });
        }
        await axios.delete(`/api/deals/${id}`);
      }
      toast.success(`Deleted ${selectedIds.size} deals. Leads preserved.`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const resetFilters = () => {
    setSearch(""); setDebouncedSearch("");
    setStageFilter(""); setBrokerFilter(""); setPaymentFilter("");
    setPriceMin(""); setPriceMax("");
    setCurrentPage(1);
  };

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (debouncedSearch) chips.push({
      key: "search", label: "Search", value: debouncedSearch,
      onRemove: () => { setSearch(""); setDebouncedSearch(""); setCurrentPage(1); },
    });
    if (brokerFilter) chips.push({
      key: "broker", label: "Broker", value: brokerFilter,
      onRemove: () => setBrokerFilter(""),
    });
    if (paymentFilter) chips.push({
      key: "payment", label: "Payments", value: paymentFilter.charAt(0).toUpperCase() + paymentFilter.slice(1),
      onRemove: () => setPaymentFilter(""),
    });
    if (priceMin || priceMax) {
      const fmt = (v: string) => (v ? Number(v).toLocaleString() : "");
      const value = priceMin && priceMax ? `${fmt(priceMin)} – ${fmt(priceMax)}`
        : priceMin ? `≥ ${fmt(priceMin)}` : `≤ ${fmt(priceMax)}`;
      chips.push({ key: "price", label: "Price", value, onRemove: () => { setPriceMin(""); setPriceMax(""); } });
    }
    return chips;
  }, [debouncedSearch, brokerFilter, paymentFilter, priceMin, priceMax]);

  // ── Stage chip strip (active stages + "More" for terminal) ──────────────
  const stageTabs = (
    <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Filter deals by stage">
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

  // ── Compact filter zone (single row) ────────────────────────────────────
  const filterZone = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search deal, buyer, unit…"
          aria-label="Search deals"
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
                {[brokerFilter, paymentFilter, priceMin || priceMax].filter(Boolean).length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-3 space-y-3">
          <DropdownMenuLabel className="px-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Filters
          </DropdownMenuLabel>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Broker</label>
            <select value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All brokers</option>
              {brokerOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Payments</label>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All payment states</option>
              <option value="overdue">Has overdue</option>
              <option value="partial">Has partial</option>
              <option value="paid">Fully paid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sale price range</label>
            <div className="flex items-center gap-1.5">
              <input type="number" placeholder="Min" value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-8 w-full text-sm border border-input rounded-md px-2 bg-card tabular-nums" />
              <span className="text-muted-foreground text-sm">–</span>
              <input type="number" placeholder="Max" value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-8 w-full text-sm border border-input rounded-md px-2 bg-card tabular-nums" />
            </div>
          </div>
          {anyAdvancedFilter && (
            <button
              onClick={() => { setBrokerFilter(""); setPaymentFilter(""); setPriceMin(""); setPriceMax(""); }}
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

  // ── KPI strip ───────────────────────────────────────────────────────────
  const kpiStrip = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Open pipeline</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.openValue ? formatDirham(kpis.openValue) : "—"}</div>
        <div className="text-[11px] text-muted-foreground">{kpis.openDeals} open deals</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Completed this month</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.completedThisMonth}</div>
        <div className="text-[11px] text-muted-foreground">handed over</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Overdue</div>
        <div className={`text-lg font-bold tabular-nums ${kpis.overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>{kpis.overdueCount}</div>
        <div className="text-[11px] text-muted-foreground">deals with late payment</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{total}</div>
        <div className="text-[11px] text-muted-foreground">all deals</div>
      </div>
    </div>
  );

  // ── Deal card (Kanban) ──────────────────────────────────────────────────
  const renderDealCard = (deal: Deal) => {
    const pct        = paymentProgress(deal);
    const overdue    = hasOverduePayment(deal);
    const days       = daysSince(deal.reservationDate);
    const oqoodDays  = daysUntil(deal.oqoodDeadline);
    const oqoodSoon  = oqoodDays !== null && oqoodDays >= 0 && oqoodDays <= 14;
    const oqoodLate  = oqoodDays !== null && oqoodDays < 0;
    const selected   = selectedIds.has(deal.id);
    const isComfortable = density === "comfortable";
    const isMoving   = movingId === deal.id;

    return (
      <div
        key={deal.id}
        draggable={!isMoving}
        onDragStart={() => setDraggingId(deal.id)}
        onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-stop-nav]")) return;
          if (onViewDeal) onViewDeal(deal.id); else navigate(`/deals/${deal.id}`);
        }}
        className={`bg-card rounded-lg border p-2.5 cursor-pointer hover:shadow-sm transition-all group relative ${
          selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
        } ${draggingId === deal.id || isMoving ? "opacity-40" : ""}`}
      >
        <div className="flex items-start gap-2">
          <input
            data-stop-nav
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(deal.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${deal.dealNumber}`}
            className={`mt-0.5 w-3.5 h-3.5 rounded transition-opacity ${
              selectedIds.size > 0 || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-sm font-semibold text-foreground leading-tight truncate group-hover:text-primary">
                {deal.lead.firstName} {deal.lead.lastName}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                {deal.brokerCompany && (
                  <span
                    title={`Broker: ${deal.brokerCompany.name}`}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-accent-2-soft text-accent-2-soft-foreground"
                  >
                    <Handshake aria-hidden className="size-3" />
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-stop-nav
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Deal actions"
                      className="p-0.5 text-muted-foreground/70 hover:text-foreground rounded transition-colors"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => navigate(`/deals/${deal.id}`)}>View deal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/deals/${deal.id}/edit`)}>Edit deal</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDeleteId(deal.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete deal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {deal.unit.unitNumber} · {deal.unit.type.replace(/_/g, " ")}
            </p>
            <p className="text-xs font-semibold text-foreground tabular-nums mt-0.5">
              {formatDirham(deal.salePrice)}
            </p>
            {(overdue || oqoodLate || oqoodSoon) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {overdue && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-destructive-soft text-destructive-soft-foreground font-semibold">
                    <AlertTriangle aria-hidden className="size-2.5" /> Overdue
                  </span>
                )}
                {oqoodLate && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive-soft text-destructive-soft-foreground font-semibold">
                    Oqood {Math.abs(oqoodDays!)}d overdue
                  </span>
                )}
                {oqoodSoon && !oqoodLate && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-soft text-warning-soft-foreground font-medium">
                    Oqood in {oqoodDays}d
                  </span>
                )}
              </div>
            )}
            {isComfortable && (
              <>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  <span className="text-[10px] text-muted-foreground font-mono">{deal.dealNumber}</span>
                  <div className="flex items-center gap-2">
                    {deal.commission && (
                      <span className={`text-[10px] ${COM_BADGE[deal.commission.status] || "text-muted-foreground"}`}>
                        Comm {deal.commission.status.replace(/_/g, " ")}
                      </span>
                    )}
                    {days !== null && (
                      <span className="text-[10px] text-muted-foreground">{days}d</span>
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

  // ── Table view ──────────────────────────────────────────────────────────
  const tableView = (
    <div className="overflow-auto bg-card rounded-xl border border-border mx-4 my-3">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2.5 text-left w-8">
              <input
                type="checkbox"
                aria-label="Select all visible"
                checked={visibleDeals.length > 0 && selectedIds.size === visibleDeals.length}
                onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
              />
            </th>
            <th className="px-3 py-2.5 text-left">Deal #</th>
            <th className="px-3 py-2.5 text-left">Buyer</th>
            <th className="px-3 py-2.5 text-left">Unit</th>
            <th className="px-3 py-2.5 text-left">Stage</th>
            <th className="px-3 py-2.5 text-right">Sale price</th>
            <th className="px-3 py-2.5 text-left">Payments</th>
            <th className="px-3 py-2.5 text-left">Commission</th>
            <th className="px-3 py-2.5 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleDeals.map((deal) => {
            const pct      = paymentProgress(deal);
            const overdue  = hasOverduePayment(deal);
            const selected = selectedIds.has(deal.id);
            const style    = STAGE_STYLE[deal.stage];
            return (
              <tr
                key={deal.id}
                onClick={() => onViewDeal ? onViewDeal(deal.id) : navigate(`/deals/${deal.id}`)}
                className={`cursor-pointer hover:bg-muted/30 ${selected ? "bg-info-soft/40" : ""}`}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(deal.id)}
                    aria-label={`Select ${deal.dealNumber}`}
                  />
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{deal.dealNumber}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{deal.lead.firstName} {deal.lead.lastName}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{deal.unit.unitNumber}</p>
                  <p className="text-xs text-muted-foreground">{deal.unit.type.replace(/_/g, " ")}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${style?.header}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style?.dot}`} />
                    {deal.stage.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-foreground">
                  {formatDirham(deal.salePrice)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                    {overdue && <AlertTriangle aria-label="Has overdue payment" className="size-3.5 text-destructive" />}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {deal.commission ? (
                    <span className={`text-xs ${COM_BADGE[deal.commission.status] || "text-muted-foreground"}`}>
                      {deal.commission.status.replace(/_/g, " ")}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Deal actions" className="p-1 text-muted-foreground hover:text-foreground rounded">
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => navigate(`/deals/${deal.id}`)}>View deal</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/deals/${deal.id}/edit`)}>Edit deal</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirmDeleteId(deal.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete deal
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

  // ── Kanban view ─────────────────────────────────────────────────────────
  const kanbanView = (
    <div className="flex gap-3 p-4 h-full min-w-max">
      {ACTIVE_STAGES.map((stage) => {
        const cards = byStage(stage);
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
              <span className="text-xs font-bold opacity-70 tabular-nums">{cards.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2 min-h-[200px]">
              {cards.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-muted-foreground text-xs">
                    {isDragOver ? "Drop here" : "No deals in this stage"}
                  </p>
                </div>
              ) : cards.map(renderDealCard)}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Deals" }]}
        title="Deals Pipeline"
        subtitle={`${total} deals total`}
        actions={<Button onClick={() => navigate("/deals/new")}>Create deal</Button>}
        tabs={stageTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {kpiStrip}
        {filterZone}
        {activeChips.length > 0 && (
          <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
        )}
      </PageContainer>

      <div className="flex-1 overflow-x-auto scrollbar-thin relative" role="region" aria-label="Deals">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleDeals.length === 0 ? (
          <EmptyState
            icon="◈"
            title={debouncedSearch || stageFilter || anyAdvancedFilter ? "No deals match your filters" : "No deals yet"}
            description={debouncedSearch || stageFilter || anyAdvancedFilter ? "Try adjusting your search or filters." : "Create your first deal to get started."}
            action={!debouncedSearch && !stageFilter && !anyAdvancedFilter ? { label: "Create deal", onClick: () => navigate("/deals/new") } : undefined}
          />
        ) : view === "kanban" ? kanbanView : tableView}
      </div>

      {/* ── Bulk action bar (floating bottom when selection > 0) ─────────── */}
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

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete deal"
        message="Delete this deal? The lead will be preserved. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        title="Delete deals"
        message={`Delete ${selectedIds.size} deals? Leads will be preserved. This cannot be undone.`}
        confirmLabel="Delete all"
        variant="danger"
        onConfirm={bulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
