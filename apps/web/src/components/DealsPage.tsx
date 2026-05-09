import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useDeals } from "../hooks/useDeals";
import DealFormModal from "./DealFormModal";
import DealEditModal from "./DealEditModal";
import EmptyState from "./EmptyState";
import { StageBadge } from "@/components/ui/stage-badge";
import { SkeletonTableRows } from "./Skeleton";
import { IconChevronUp, IconChevronDown, IconChevronsUpDown } from "./Icons";
import { PageContainer, PageHeader } from "./layout";
import {
  FilterBar,
  ActiveFilterChips,
  Pagination,
  type ActiveFilterChip,
} from "./data";
import { Button } from "@/components/ui/button";

interface Deal {
  id: string; dealNumber: string;
  lead: { firstName: string; lastName: string };
  unit: { unitNumber: string; type: string; price: number };
  stage: string; salePrice: number; discount: number; reservationDate: string;
  payments?: { status: string; amount: number }[];
  commission?: { status: string; amount: number };
  oqoodDeadline?: string;
}

const STAGES = ["RESERVATION_PENDING","RESERVATION_CONFIRMED","SPA_PENDING","SPA_SENT","SPA_SIGNED","OQOOD_PENDING","OQOOD_REGISTERED","INSTALLMENTS_ACTIVE","HANDOVER_PENDING","COMPLETED","CANCELLED"];

// Stages considered "active range" (per spec: RESERVATION_PENDING through INSTALLMENTS_ACTIVE)
const ACTIVE_STAGES = ["RESERVATION_PENDING","RESERVATION_CONFIRMED","SPA_PENDING","SPA_SENT","SPA_SIGNED","OQOOD_PENDING","OQOOD_REGISTERED","INSTALLMENTS_ACTIVE"];

// Allowed forward transitions per stage (mirrors API rules)
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

function daysBetween(date: string | Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function paymentOverdue(deal: any): boolean {
  return Array.isArray(deal.payments) && deal.payments.some((p: any) => p.status === "OVERDUE");
}

const STAGE_BADGE: Record<string, string> = {
  RESERVATION_PENDING:   "bg-muted text-muted-foreground",
  RESERVATION_CONFIRMED: "bg-info-soft text-primary",
  SPA_PENDING:           "bg-warning-soft text-warning",
  SPA_SENT:              "bg-warning-soft text-warning",
  SPA_SIGNED:            "bg-stage-active text-stage-active-foreground",
  OQOOD_PENDING:         "bg-warning-soft text-warning",
  OQOOD_REGISTERED:      "bg-chart-5/15 text-chart-5",
  INSTALLMENTS_ACTIVE:   "bg-stage-active text-stage-active-foreground",
  HANDOVER_PENDING:      "bg-success-soft text-success",
  COMPLETED:             "bg-success-soft text-success",
  CANCELLED:             "bg-destructive-soft text-destructive",
};

const COM_BADGE: Record<string, string> = {
  NOT_DUE: "text-muted-foreground", PENDING_APPROVAL: "text-warning font-semibold",
  APPROVED: "text-primary font-semibold", PAID: "text-success font-semibold",
  CANCELLED: "text-destructive",
};

function paymentProgress(deal: Deal) {
  if (!deal.payments?.length) return 0;
  return Math.round(deal.payments.filter((p) => p.status === "PAID").length / deal.payments.length * 100);
}

interface Props {
  onViewDeal?: (id: string) => void;
}

export default function DealsPage({ onViewDeal }: Props = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(searchParams.get("stage"));
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [sortCol, setSortCol] = useState<string>(searchParams.get("sort") || "reservationDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as "asc" | "desc") || "desc");
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelDeal, setCancelDeal] = useState<Deal | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Kanban view + active-stages-only toggle
  const [viewMode, setViewMode] = useState<"kanban" | "list">((searchParams.get("view") as "kanban" | "list") || "kanban");
  const [activeOnly, setActiveOnly] = useState<boolean>(searchParams.get("active") !== "0");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Debounce search input 350ms before firing API call
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1);
    }, 350);
  };

  const { data: dealsResponse, isLoading } = useDeals(currentPage, 50, selectedStage, debouncedSearch || undefined);
  const deals = (dealsResponse?.data || []) as Deal[];
  const total = dealsResponse?.pagination.total || 0;

  useEffect(() => { setCurrentPage(1); }, [selectedStage]);

  // Sync filters → URL
  useEffect(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.q = debouncedSearch;
    if (selectedStage)   p.stage = selectedStage;
    if (currentPage > 1) p.page  = String(currentPage);
    if (sortCol !== "reservationDate") p.sort = sortCol;
    if (sortDir !== "desc") p.dir = sortDir;
    if (viewMode !== "kanban") p.view = viewMode;
    if (!activeOnly) p.active = "0";
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, selectedStage, currentPage, sortCol, sortDir, viewMode, activeOnly]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const colAccessor: Record<string, (d: Deal) => any> = {
    dealNumber: (d) => d.dealNumber,
    buyer: (d) => `${d.lead.firstName} ${d.lead.lastName}`,
    unit: (d) => d.unit.unitNumber,
    stage: (d) => d.stage,
    salePrice: (d) => d.salePrice,
    reservationDate: (d) => d.reservationDate,
  };

  const sorted = [...deals].sort((a, b) => {
    const av = colAccessor[sortCol]?.(a) ?? "";
    const bv = colAccessor[sortCol]?.(b) ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: string }) => (
    <span className={`ml-1 inline-flex items-center align-middle ${sortCol === col ? "text-foreground" : "text-foreground/80"}`} aria-hidden="true">
      {sortCol === col
        ? (sortDir === "asc" ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />)
        : <IconChevronsUpDown size={12} />}
    </span>
  );

  const moveDeal = async (deal: Deal, targetStage: string) => {
    if (deal.stage === targetStage) return;
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
      const reason = err?.response?.data?.error || `Cannot move to ${targetStage.replace(/_/g, " ")}`;
      toast.error(reason);
    } finally {
      setMovingId(null);
    }
  };

  const performCancel = async () => {
    if (!cancelDeal) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("A cancel reason is required");
      return;
    }
    setCancelingId(cancelDeal.id);
    try {
      await axios.patch(`/api/deals/${cancelDeal.id}/stage`, { newStage: "CANCELLED", reason });
      toast.success("Deal cancelled");
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setCancelDeal(null);
      setCancelReason("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to cancel deal");
    } finally {
      setCancelingId(null);
    }
  };

  const filtered = sorted;

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (debouncedSearch) {
      chips.push({
        key: "search",
        label: "Search",
        value: debouncedSearch,
        onRemove: () => { setSearch(""); setDebouncedSearch(""); setCurrentPage(1); },
      });
    }
    return chips;
  }, [debouncedSearch]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedStage(null);
    setCurrentPage(1);
  };

  const stageTabs = (
    <div
      className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 scrollbar-thin py-2 items-center"
      role="tablist"
      aria-label="Filter by stage"
    >
      <button
        onClick={() => setSelectedStage(null)}
        role="tab"
        aria-selected={!selectedStage}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${!selectedStage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted"}`}
      >All</button>
      {STAGES.map((s) => (
        <button
          key={s}
          onClick={() => setSelectedStage(s === selectedStage ? null : s)}
          role="tab"
          aria-selected={selectedStage === s}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${selectedStage === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted"}`}
        >{s.replace(/_/g," ")}</button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Deals" }]}
        title="Deals"
        subtitle={`${total} deals ${selectedStage ? `· ${selectedStage.replace(/_/g," ")}` : "· all stages"}`}
        actions={<Button onClick={() => setShowNewDeal(true)}>Create deal</Button>}
        tabs={stageTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        <FilterBar
          search={{
            value: search,
            onChange: handleSearch,
            placeholder: "Search deal, buyer, unit…",
            ariaLabel: "Search deals",
          }}
          extra={
            viewMode === "kanban" ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded border-border"
                />
                Active stages only
              </label>
            ) : null
          }
          view={{
            value: viewMode,
            onChange: (v) => setViewMode(v as "kanban" | "list"),
            views: [
              { value: "kanban", label: "Kanban" },
              { value: "list", label: "List" },
            ],
          }}
        />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
      </PageContainer>

      {/* Board / Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : viewMode === "kanban" ? (
          (() => {
            // Group deals by stage. The kanban shows ALL deals returned by useDeals,
            // not just the paginated current page; for large pipelines, switch to List view.
            const byStage: Record<string, Deal[]> = {};
            STAGES.forEach((s) => { byStage[s] = []; });
            for (const d of filtered) {
              (byStage[d.stage] ||= []).push(d);
            }
            const visibleStages = STAGES.filter((s) => {
              if (!activeOnly) return true;
              return ACTIVE_STAGES.includes(s) || (byStage[s] && byStage[s].length > 0);
            });

            return (
              <div className="flex gap-3 p-4 h-full min-w-max">
                {visibleStages.map((stage) => {
                  const cards = byStage[stage] || [];
                  const isDropTarget = draggingId !== null && dragOverStage === stage;
                  return (
                    <div
                      key={stage}
                      onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
                      onDragLeave={() => { if (dragOverStage === stage) setDragOverStage(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverStage(null);
                        const id = e.dataTransfer.getData("text/deal-id");
                        const deal = deals.find((d) => d.id === id);
                        setDraggingId(null);
                        if (deal) moveDeal(deal, stage);
                      }}
                      className={`w-72 flex-shrink-0 flex flex-col rounded-xl border ${isDropTarget ? "border-primary/40 bg-info-soft/50" : "border-border bg-muted/50"} overflow-hidden`}
                    >
                      <div className={`flex items-center justify-between px-3 py-2.5 border-b border-border ${STAGE_BADGE[stage] || "bg-muted text-muted-foreground"}`}>
                        <span className="text-xs font-semibold">{stage.replace(/_/g, " ")}</span>
                        <span className="text-xs font-bold opacity-70">{cards.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2 min-h-[200px]">
                        {cards.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-6">Drop a deal here</p>
                        ) : cards.map((deal) => {
                          const days = daysBetween(deal.reservationDate);
                          const overdue = paymentOverdue(deal as any);
                          const isMoving = movingId === deal.id;
                          return (
                            <div
                              key={deal.id}
                              draggable={!isMoving}
                              onDragStart={(e) => {
                                setDraggingId(deal.id);
                                e.dataTransfer.setData("text/deal-id", deal.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                              onClick={() => navigate(`/deals/${deal.id}`)}
                              onDoubleClick={() => navigate(`/deals/${deal.id}`)}
                              className={`bg-card rounded-lg border border-border p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all ${draggingId === deal.id ? "opacity-50" : ""} ${isMoving ? "opacity-50 pointer-events-none" : ""}`}
                            >
                              <div className="flex items-start justify-between mb-1.5">
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                  {deal.lead.firstName} {deal.lead.lastName}
                                </p>
                                {overdue && (
                                  <span title="Has overdue payment" className="text-destructive text-base leading-none flex-shrink-0">▲</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">{deal.unit.unitNumber} · {deal.unit.type.replace(/_/g, " ")}</p>
                              <p className="text-xs font-semibold text-foreground mb-2">AED {deal.salePrice.toLocaleString()}</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{days}d in pipeline</span>
                                <span className="font-mono">{deal.dealNumber}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        ) : (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
              <tr>
                {[
                  { label: "Deal #", col: "dealNumber" },
                  { label: "Buyer", col: "buyer" },
                  { label: "Unit", col: "unit" },
                  { label: "Stage", col: "stage" },
                  { label: "Sale Price", col: "salePrice" },
                  { label: "Payments", col: null },
                  { label: "Commission", col: null },
                  { label: "", col: null },
                ].map(({ label, col }) => (
                  <th
                    key={label || "actions"}
                    onClick={col ? () => handleSort(col) : undefined}
                    className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${col ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                    aria-sort={col && sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {label}{col && <SortIcon col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon="◈"
                    title={debouncedSearch || selectedStage ? "No deals match your filters" : "No deals yet"}
                    description={debouncedSearch || selectedStage ? "Try adjusting your search or stage filter." : "Create your first deal to get started."}
                    action={!debouncedSearch && !selectedStage ? { label: "Create deal", onClick: () => setShowNewDeal(true) } : undefined}
                  />
                </td></tr>
              ) : (filtered.map((deal) => {
                const pct = paymentProgress(deal);
                const isMenuOpen = openMenuId === deal.id;
                return (
                  <tr
                    key={deal.id}
                    onClick={() => onViewDeal ? onViewDeal(deal.id) : navigate(`/deals/${deal.id}`)}
                    className="hover:bg-info-soft/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{deal.dealNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {deal.lead.firstName} {deal.lead.lastName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{deal.unit.unitNumber}</p>
                      <p className="text-xs text-muted-foreground">{deal.unit.type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge kind="deal" stage={deal.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">AED {deal.salePrice.toLocaleString()}</p>
                      {deal.discount > 0 && <p className="text-xs text-success">-{deal.discount.toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {deal.commission ? (
                        <span className={`text-xs ${COM_BADGE[deal.commission.status] || "text-muted-foreground"}`}>
                          {deal.commission.status.replace(/_/g, " ")}
                        </span>
                      ) : <span className="text-xs text-foreground/80">—</span>}
                    </td>
                    {/* Kebab menu - always tappable on touch */}
                    <td className="px-2 py-3 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : deal.id)}
                        aria-label={`Actions for deal ${deal.dealNumber}`}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        ⋮
                      </button>
                      {isMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
                            <button
                              onClick={() => { setOpenMenuId(null); navigate(`/deals/${deal.id}`); }}
                              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/50"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); setEditDeal(deal); }}
                              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/50"
                            >
                              Edit Deal
                            </button>
                            {deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (
                              <button
                                onClick={() => { setOpenMenuId(null); setCancelDeal(deal); setCancelReason(""); }}
                                disabled={cancelingId === deal.id}
                                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive-soft disabled:opacity-50"
                              >
                                Cancel Deal
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              }))}
          </tbody>
        </table>
        )}
      </div>

      {/* Pagination — hidden in kanban view (kanban shows current page's batch only) */}
      {viewMode === "list" && (
        <PageContainer
          padding="compact"
          className="border-t border-border bg-card flex-shrink-0"
        >
          <Pagination
            page={currentPage}
            pageSize={50}
            total={total}
            onPageChange={setCurrentPage}
          />
        </PageContainer>
      )}

      {showNewDeal && (
        <DealFormModal
          onClose={() => setShowNewDeal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["deals"] });
            setShowNewDeal(false);
          }}
        />
      )}
      {editDeal && (
        <DealEditModal
          deal={editDeal as any}
          onClose={() => setEditDeal(null)}
          onSaved={() => { setEditDeal(null); queryClient.invalidateQueries({ queryKey: ["deals"] }); }}
        />
      )}

      {cancelDeal && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={() => { if (cancelingId) return; setCancelDeal(null); setCancelReason(""); }}
          onKeyDown={(e) => { if (e.key === "Escape" && !cancelingId) { setCancelDeal(null); setCancelReason(""); } }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-deal-title"
            className="bg-card rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5">
              <h3 id="cancel-deal-title" className="text-base font-semibold text-foreground">Cancel deal {cancelDeal.dealNumber}?</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                This will set the deal to CANCELLED. Provide a reason — it will be recorded on the deal's history.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Buyer changed mind, financing fell through, etc."
                rows={3}
                autoFocus
                className="mt-3 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-muted/50 border-t border-border">
              <button
                onClick={() => { setCancelDeal(null); setCancelReason(""); }}
                disabled={!!cancelingId}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50"
              >
                Keep deal
              </button>
              <button
                onClick={performCancel}
                disabled={!cancelReason.trim() || !!cancelingId}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive hover:bg-destructive/90 text-white disabled:opacity-50"
              >
                {cancelingId ? "Cancelling…" : "Cancel deal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
