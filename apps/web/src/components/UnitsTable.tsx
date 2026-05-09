import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { getStatusColor } from "../utils/statusColors";
import { formatAreaShort } from "../utils/formatArea";
import { formatAED } from "../lib/format";
import UnitModal from "./UnitModal";
import HoverPreview from "./HoverPreview";

interface UnitImageLite {
  id: string;
  url: string;
  caption?: string;
  type: "PHOTO" | "FLOOR_PLAN" | "FLOOR_MAP";
  sortOrder: number;
}

interface Unit {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  area: number;
  basePrice?: number;
  price: number;
  view: string;
  status: string;
  assignedAgentId?: string;
  projectId: string;
  images?: UnitImageLite[]; // first FLOOR_PLAN included by GET /api/units
}

type ColumnKey = "plan" | "project" | "unitNumber" | "floor" | "type" | "area" | "view" | "price" | "status" | "agent";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  plan:       "Plan",
  project:    "Project",
  unitNumber: "Unit No.",
  floor:      "Floor",
  type:       "Type",
  area:       "Area",
  view:       "View",
  price:      "Price",
  status:     "Status",
  agent:      "Agent",
};

const ALWAYS_VISIBLE: ColumnKey[] = ["unitNumber", "price", "status"];
const DEFAULT_HIDDEN: ColumnKey[] = []; // all visible by default
const COLUMN_PREF_KEY = "samha.unitsTable.hiddenColumns";

interface Project { id: string; name: string; }
interface Agent { id: string; name: string; }

interface Props {
  projectId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_RELEASED: "Not Released",
  AVAILABLE:    "Available",
  ON_HOLD:      "On Hold",
  RESERVED:     "Reserved",
  BOOKED:       "Booked",
  SOLD:         "Sold",
  BLOCKED:      "Blocked",
  HANDED_OVER:  "Handed Over",
};

const ALL_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"];

type SortKey = "project" | "unitNumber" | "floor" | "type" | "area" | "view" | "price" | "status";

const SortIcon = ({ active, asc }: { active: boolean; asc: boolean }) => (
  <span className={`ml-1 text-xs ${active ? "text-primary" : "text-foreground/80"}`}>
    {active ? (asc ? "↑" : "↓") : "⇅"}
  </span>
);

export default function UnitsTable({ projectId }: Props) {
  const navigate = useNavigate();
  const isGlobal = !projectId;

  // Data
  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");
  const [filterAgent, setFilterAgent] = useState("ALL");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>(isGlobal ? "project" : "unitNumber");
  const [sortAsc, setSortAsc] = useState(true);

  // Inline price edit
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Selection + bulk ops
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = useState<"RELEASE" | "BLOCK" | "UNBLOCK" | "PRICE_UPDATE" | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkPriceType, setBulkPriceType] = useState<"PERCENT" | "FIXED_DELTA" | "FIXED">("PERCENT");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number } | null>(null);

  // Modals
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  // Edit/Create + bulk state removed in Phase C.3/C.7 — all three flows are
  // routes now:
  //   /projects/:projectId/units/new           (single create)
  //   /projects/:projectId/units/:unitId/edit  (single edit)
  //   /projects/:projectId/units/bulk          (bulk floor wizard)

  // Column visibility (persisted in localStorage)
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(() => {
    if (typeof window === "undefined") return new Set(DEFAULT_HIDDEN);
    try {
      const raw = window.localStorage.getItem(COLUMN_PREF_KEY);
      if (!raw) return new Set(DEFAULT_HIDDEN);
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((k: string) => !ALWAYS_VISIBLE.includes(k as ColumnKey)) as ColumnKey[]);
    } catch {/* ignore */}
    return new Set(DEFAULT_HIDDEN);
  });
  useEffect(() => {
    try { window.localStorage.setItem(COLUMN_PREF_KEY, JSON.stringify(Array.from(hiddenColumns))); }
    catch {/* ignore */}
  }, [hiddenColumns]);
  const isVisible = (k: ColumnKey) => !hiddenColumns.has(k);
  const toggleColumn = (k: ColumnKey) => {
    if (ALWAYS_VISIBLE.includes(k)) return;
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!columnMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) setColumnMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [columnMenuOpen]);

  const load = useCallback(() => {
    setLoading(true);
    const params = projectId ? { projectId, limit: 1000 } : { limit: 2000 };
    const requests: Promise<any>[] = [
      axios.get("/api/units", { params }),
      axios.get("/api/users"),
    ];
    if (isGlobal) requests.push(axios.get("/api/projects"));

    Promise.all(requests)
      .then(([unitsRes, usersRes, projectsRes]) => {
        setUnits(unitsRes.data.data || unitsRes.data || []);
        setAgents(
          (usersRes.data || []).filter((u: any) => u.status === "ACTIVE" && u.role !== "VIEWER")
        );
        if (projectsRes) setProjects(projectsRes.data.data || projectsRes.data || []);
      })
      .finally(() => setLoading(false));
  }, [projectId, isGlobal]);

  useEffect(() => { load(); }, [load]);

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [projects]);

  const agentMap = useMemo(() => {
    const m: Record<string, string> = {};
    agents.forEach((a) => (m[a.id] = a.name));
    return m;
  }, [agents]);

  // Status summary counts (over all units, before filters)
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach((u) => { counts[u.status] = (counts[u.status] || 0) + 1; });
    return counts;
  }, [units]);

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (search && !u.unitNumber.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== "ALL" && u.status !== filterStatus) return false;
      if (filterType !== "ALL" && u.type !== filterType) return false;
      if (isGlobal && filterProject !== "ALL" && u.projectId !== filterProject) return false;
      if (filterAgent !== "ALL") {
        if (filterAgent === "" && u.assignedAgentId) return false;
        if (filterAgent !== "" && u.assignedAgentId !== filterAgent) return false;
      }
      if (filterPriceMin && u.price < parseInt(filterPriceMin)) return false;
      if (filterPriceMax && u.price > parseInt(filterPriceMax)) return false;
      return true;
    });
  }, [units, search, filterStatus, filterType, filterProject, filterAgent, filterPriceMin, filterPriceMax, isGlobal]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "project":     av = projectMap[a.projectId] || ""; bv = projectMap[b.projectId] || ""; break;
        case "unitNumber":  av = a.unitNumber; bv = b.unitNumber; break;
        case "floor":       av = a.floor; bv = b.floor; break;
        case "type":        av = a.type; bv = b.type; break;
        case "area":        av = a.area; bv = b.area; break;
        case "view":        av = a.view; bv = b.view; break;
        case "price":       av = a.price; bv = b.price; break;
        case "status":      av = a.status; bv = b.status; break;
      }
      if (typeof av === "string") { av = av.toLowerCase(); bv = (bv as string).toLowerCase(); }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortAsc, projectMap]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length
      ? new Set()
      : new Set(filtered.map((u) => u.id))
    );
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkOp(null);
    setBulkReason("");
    setBulkPriceValue("");
    setBulkResult(null);
  };

  const runBulkOp = async () => {
    if (!bulkOp || selectedIds.size === 0) return;
    setBulkSubmitting(true);
    setBulkResult(null);
    try {
      const body: any = { unitIds: Array.from(selectedIds), operation: bulkOp };
      if (bulkReason) body.reason = bulkReason;
      if (bulkOp === "PRICE_UPDATE" && bulkPriceValue) {
        body.value = (bulkPriceType === "PERCENT" || bulkPriceType === "FIXED_DELTA")
          ? { type: bulkPriceType, amount: parseFloat(bulkPriceValue) }
          : parseFloat(bulkPriceValue);
      }
      const r = await axios.post("/api/units/bulk-ops", body);
      setBulkResult({ succeeded: r.data.succeeded, failed: r.data.failed });
      load();
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Bulk operation failed");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const savePrice = async (unitId: string, newPrice: number) => {
    setSavingPrice(true);
    try {
      await axios.patch(`/api/units/${unitId}`, { price: newPrice });
      setUnits((prev) => prev.map((u) => u.id === unitId ? { ...u, price: newPrice } : u));
      setEditingPriceId(null);
    } catch {
      // keep editing open on failure
    } finally {
      setSavingPrice(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("ALL");
    setFilterType("ALL");
    setFilterProject("ALL");
    setFilterAgent("ALL");
    setFilterPriceMin("");
    setFilterPriceMax("");
  };

  const hasFilters = search || filterStatus !== "ALL" || filterType !== "ALL" ||
    filterProject !== "ALL" || filterAgent !== "ALL" || filterPriceMin || filterPriceMax;

  const Th = ({ label, sk, align = "left" }: { label: string; sk: SortKey; align?: "left" | "right" }) => (
    <th className={`px-4 py-2.5 text-${align}`}>
      <button
        onClick={() => toggleSort(sk)}
        className={`text-xs font-semibold text-muted-foreground hover:text-primary flex items-center gap-0.5 ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}<SortIcon active={sortKey === sk} asc={sortAsc} />
      </button>
    </th>
  );

  return (
    <div className="flex flex-col h-full">

      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-card border-b border-border flex-shrink-0 flex-wrap">
        {!selectionMode ? (
          <>
            {/* Project-mode actions */}
            {!isGlobal && (
              <>
                <button
                  onClick={() => projectId && navigate(`/projects/${projectId}/units/new`)}
                  className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  + Create unit
                </button>
                <button
                  onClick={() => projectId && navigate(`/projects/${projectId}/units/bulk`)}
                  className="px-3 py-1.5 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                >
                  ⊞ Add Floor
                </button>
              </>
            )}

            <button
              onClick={() => setSelectionMode(true)}
              className="px-3 py-1.5 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            >
              ☑ Select
            </button>

            {/* Column picker */}
            <div className="relative" ref={columnMenuRef}>
              <button
                onClick={() => setColumnMenuOpen((v) => !v)}
                className="px-3 py-1.5 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                title="Show / hide columns"
                aria-haspopup="menu"
                aria-expanded={columnMenuOpen}
              >
                ⋯ Columns{hiddenColumns.size > 0 ? ` (${hiddenColumns.size} hidden)` : ""}
              </button>
              {columnMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-card border border-border rounded-lg shadow-lg py-2 w-48" role="menu">
                  {(Object.keys(COLUMN_LABELS) as ColumnKey[])
                    .filter((k) => k !== "project" || isGlobal) // Project column only in global mode
                    .map((k) => {
                      const locked = ALWAYS_VISIBLE.includes(k);
                      return (
                        <label
                          key={k}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer ${locked ? "text-muted-foreground cursor-not-allowed" : "text-foreground hover:bg-muted/50"}`}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible(k)}
                            disabled={locked}
                            onChange={() => toggleColumn(k)}
                            className="rounded"
                          />
                          {COLUMN_LABELS[k]}
                          {locked && <span className="ml-auto text-[10px] text-muted-foreground">always</span>}
                        </label>
                      );
                    })}
                  {hiddenColumns.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setHiddenColumns(new Set())}
                      className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-info-soft border-t border-border mt-1"
                    >
                      Show all columns
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-neutral-200 mx-1" />

            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit no…"
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 focus:outline-none focus:border-ring w-36"
            />

            {/* Project filter — global mode only */}
            {isGlobal && (
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 focus:outline-none focus:border-ring"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 focus:outline-none focus:border-ring"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 focus:outline-none focus:border-ring"
            >
              <option value="ALL">All Types</option>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-info-soft rounded-lg transition-colors"
            >
              {showAdvanced ? "Less ▲" : "More ▼"}
            </button>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-destructive hover:text-destructive font-medium">
                Clear ×
              </button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length.toLocaleString()} / {units.length.toLocaleString()} units
            </span>
          </>
        ) : (
          /* Selection mode bar */
          <>
            <button onClick={exitSelection} className="px-3 py-1.5 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted">
              ✕ Cancel
            </button>
            <span className="text-sm text-muted-foreground font-medium">{selectedIds.size} selected</span>
            <div className="h-5 w-px bg-neutral-200 mx-1" />
            {(["RELEASE", "BLOCK", "UNBLOCK", "PRICE_UPDATE"] as const).map((op) => {
              const styles: Record<string, string> = {
                RELEASE:      bulkOp === op ? "bg-success text-white" : "bg-success-soft text-success hover:bg-success-soft",
                BLOCK:        bulkOp === op ? "bg-neutral-700 text-white"   : "bg-muted text-foreground hover:bg-muted",
                UNBLOCK:      bulkOp === op ? "bg-primary text-white"    : "bg-info-soft text-primary hover:bg-info-soft",
                PRICE_UPDATE: bulkOp === op ? "bg-accent-2 text-accent-2-foreground"  : "bg-stage-active text-stage-active-foreground hover:bg-stage-active",
              };
              const labels: Record<string, string> = { RELEASE: "↑ Release", BLOCK: "⊘ Block", UNBLOCK: "✓ Unblock", PRICE_UPDATE: "$ Price" };
              return (
                <button key={op} onClick={() => setBulkOp(op)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${styles[op]}`}>
                  {labels[op]}
                </button>
              );
            })}
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} shown</span>
          </>
        )}
      </div>

      {/* ── Advanced filters ── */}
      {showAdvanced && !selectionMode && (
        <div className="px-6 py-3 bg-muted/50 border-b border-border flex flex-wrap gap-4 flex-shrink-0">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Agent</label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:border-ring"
            >
              <option value="ALL">All agents</option>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Price (AED)</label>
            <input
              type="number"
              value={filterPriceMin}
              onChange={(e) => setFilterPriceMin(e.target.value)}
              placeholder="0"
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm w-32 bg-card focus:outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Max Price (AED)</label>
            <input
              type="number"
              value={filterPriceMax}
              onChange={(e) => setFilterPriceMax(e.target.value)}
              placeholder="∞"
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm w-32 bg-card focus:outline-none focus:border-ring"
            />
          </div>
        </div>
      )}

      {/* ── Bulk op panel ── */}
      {selectionMode && bulkOp && (
        <div className="px-6 py-3 bg-info-soft border-b border-primary/40 flex items-center gap-3 flex-wrap flex-shrink-0">
          <span className="text-sm font-semibold text-primary">{bulkOp.replace(/_/g, " ")}</span>
          {bulkOp !== "PRICE_UPDATE" && (
            <input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder={
                bulkOp === "BLOCK"   ? "Reason — why are these blocked? (required)" :
                bulkOp === "RELEASE" ? "Reason — release note for audit (required)" :
                bulkOp === "UNBLOCK" ? "Reason — why unblocking now? (required)" :
                "Reason"
              }
              className="border border-primary/40 rounded-lg px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:border-ring w-72"
            />
          )}
          {bulkOp === "PRICE_UPDATE" && (
            <div className="flex items-center gap-2">
              <select
                value={bulkPriceType}
                onChange={(e) => setBulkPriceType(e.target.value as any)}
                className="border border-primary/40 rounded-lg px-2.5 py-1.5 text-sm bg-card focus:outline-none"
              >
                <option value="PERCENT">% Change</option>
                <option value="FIXED_DELTA">AED Delta</option>
                <option value="FIXED">Set Fixed AED</option>
              </select>
              <input
                type="number"
                value={bulkPriceValue}
                onChange={(e) => setBulkPriceValue(e.target.value)}
                placeholder={bulkPriceType === "PERCENT" ? "e.g. 5 or -3" : "Amount"}
                className="border border-primary/40 rounded-lg px-2.5 py-1.5 text-sm bg-card focus:outline-none w-32"
              />
              <input
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Reason (optional)"
                className="border border-primary/40 rounded-lg px-2.5 py-1.5 text-sm bg-card focus:outline-none w-44"
              />
            </div>
          )}
          <button
            onClick={runBulkOp}
            disabled={
              bulkSubmitting ||
              selectedIds.size === 0 ||
              ((bulkOp === "BLOCK" || bulkOp === "RELEASE" || bulkOp === "UNBLOCK") && !bulkReason.trim())
            }
            title={
              ((bulkOp === "BLOCK" || bulkOp === "RELEASE" || bulkOp === "UNBLOCK") && !bulkReason.trim())
                ? "Reason is required for this operation"
                : undefined
            }
            className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkSubmitting ? "Running…" : `Apply to ${selectedIds.size}`}
          </button>
          {bulkResult && (
            <span className="text-sm text-muted-foreground">
              ✓ {bulkResult.succeeded} done{bulkResult.failed > 0 ? `, ${bulkResult.failed} skipped` : ""}
            </span>
          )}
        </div>
      )}

      {/* ── Status summary pills ── */}
      {!loading && units.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-muted/50 border-b border-border flex-wrap flex-shrink-0">
          {Object.entries(byStatus).map(([status, count]) => {
            const c = getStatusColor(status);
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "ALL" : status)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all ${c.bg} ${c.text} ${filterStatus === status ? "border-border" : "border-transparent hover:border-border"}`}
              >
                {STATUS_LABELS[status] || status} <span className="font-bold">{count}</span>
              </button>
            );
          })}
          {filterStatus !== "ALL" && (
            <button onClick={() => setFilterStatus("ALL")} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Clear ×
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p>{units.length === 0 ? "No units yet — add your first unit above" : "No units match the current filters"}</p>
          </div>
        ) : (
          <table className="w-full text-sm" style={{ minWidth: "960px" }}>
            <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
              <tr>
                {selectionMode && (
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                )}
                {isVisible("plan")       && <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ minWidth: 56, width: 56 }}>Plan</th>}
                {isGlobal && isVisible("project")    && <Th label="Project"     sk="project" />}
                {isVisible("unitNumber") && <Th label="Unit No."    sk="unitNumber" />}
                {isVisible("floor")      && <Th label="Floor"       sk="floor" />}
                {isVisible("type")       && <Th label="Type"        sk="type" />}
                {isVisible("area")       && <Th label="Area (sqft)" sk="area" />}
                {isVisible("view")       && <Th label="View"        sk="view" />}
                {isVisible("price")      && <Th label="Price (AED)" sk="price" align="right" />}
                {isVisible("status")     && <Th label="Status"      sk="status" />}
                {isVisible("agent")      && <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground" style={{ minWidth: 140 }}>Agent</th>}
                {!selectionMode && <th className="px-4 py-2.5 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((unit) => {
                const c = getStatusColor(unit.status);
                const isSelected = selectedIds.has(unit.id);
                const canEdit = !isGlobal && ["AVAILABLE", "BLOCKED", "NOT_RELEASED"].includes(unit.status);
                const floorPlan = unit.images?.[0];
                return (
                  <tr
                    key={unit.id}
                    className={`cursor-pointer group transition-colors ${isSelected ? "bg-info-soft" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectionMode) toggleSelect(unit.id);
                      else navigate(`/projects/${unit.projectId}/units/${unit.id}`);
                    }}
                  >
                    {selectionMode && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(unit.id)} className="rounded" />
                      </td>
                    )}

                    {/* Floor-plan thumbnail with hover-zoom preview */}
                    {isVisible("plan") && (
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()} style={{ width: 56 }}>
                        {floorPlan ? (
                          <HoverPreview src={floorPlan.url} caption={floorPlan.caption || `Floor plan — ${unit.unitNumber}`} size={360}>
                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${unit.projectId}/units/${unit.id}`)}
                              className="w-10 h-10 rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors bg-muted/50 align-middle"
                              title="Hover to enlarge · click to open unit"
                              aria-label="Open unit"
                            >
                              <img
                                src={floorPlan.url}
                                alt={floorPlan.caption || "Floor plan"}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          </HoverPreview>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-border text-muted-foreground text-base"
                            title="No floor plan uploaded"
                          >
                            📐
                          </span>
                        )}
                      </td>
                    )}

                    {/* Project column (global mode) */}
                    {isGlobal && isVisible("project") && (
                      <td className="px-4 py-3" style={{ minWidth: 120 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/projects/${unit.projectId}`); }}
                          className="text-primary hover:text-primary hover:underline text-xs font-medium"
                        >
                          {projectMap[unit.projectId] || "—"}
                        </button>
                      </td>
                    )}

                    {isVisible("unitNumber") && (
                      <td className="px-4 py-3" style={{ minWidth: 88 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${unit.projectId}/units/${unit.id}`);
                          }}
                          className="font-mono font-semibold text-foreground hover:text-primary hover:underline text-xs"
                        >
                          {unit.unitNumber}
                        </button>
                      </td>
                    )}
                    {isVisible("floor") && <td className="px-4 py-3 text-muted-foreground text-xs" style={{ minWidth: 56 }}>F{unit.floor}</td>}
                    {isVisible("type")  && <td className="px-4 py-3 text-foreground text-xs" style={{ minWidth: 96 }}>{unit.type.replace(/_/g, " ")}</td>}
                    {isVisible("area")  && <td className="px-4 py-3 text-muted-foreground text-xs" style={{ minWidth: 88 }}>{formatAreaShort(unit.area)}</td>}
                    {isVisible("view")  && <td className="px-4 py-3 text-muted-foreground text-xs" style={{ minWidth: 88 }}>{unit.view}</td>}

                    {/* Inline price edit (always visible) */}
                    {isVisible("price") && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()} style={{ minWidth: 128 }}>
                        {editingPriceId === unit.id ? (
                          <input
                            type="number"
                            value={editingPrice}
                            autoFocus
                            onChange={(e) => setEditingPrice(e.target.value)}
                            onBlur={() => editingPrice && parseInt(editingPrice) > 0 ? savePrice(unit.id, parseInt(editingPrice)) : setEditingPriceId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingPrice && parseInt(editingPrice) > 0) savePrice(unit.id, parseInt(editingPrice));
                              if (e.key === "Escape") setEditingPriceId(null);
                            }}
                            disabled={savingPrice}
                            className="w-28 px-2 py-1 border border-primary/40 rounded text-right text-xs font-semibold bg-info-soft"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingPriceId(unit.id); setEditingPrice(unit.price.toString()); }}
                            className="font-semibold text-foreground hover:text-primary hover:underline text-xs"
                            title="Click to edit price"
                          >
                            {formatAED(unit.price, { bare: true })}
                          </button>
                        )}
                      </td>
                    )}

                    {isVisible("status") && (
                      <td className="px-4 py-3" style={{ minWidth: 110 }}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
                          {STATUS_LABELS[unit.status] || unit.status}
                        </span>
                      </td>
                    )}

                    {isVisible("agent") && (
                      <td className="px-4 py-3 text-xs text-muted-foreground" style={{ minWidth: 140 }}>
                        {unit.assignedAgentId ? agentMap[unit.assignedAgentId] || "—" : "—"}
                      </td>
                    )}

                    {/* Edit only — Delete now lives in the unit detail page Danger zone */}
                    {!selectionMode && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()} style={{ width: 64 }}>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/projects/${unit.projectId}/units/${unit.id}/edit`); }}
                              className="text-xs text-primary hover:text-primary font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {selectedUnit && (
        <UnitModal
          unit={selectedUnit}
          agents={agents}
          statusLabels={STATUS_LABELS}
          onClose={() => setSelectedUnit(null)}
          onRefresh={load}
          onEditUnit={(u) => {
            setSelectedUnit(null);
            const unit = u as Unit;
            navigate(`/projects/${unit.projectId}/units/${unit.id}/edit`);
          }}
          onDeleted={() => { setSelectedUnit(null); load(); }}
        />
      )}

    </div>
  );
}
