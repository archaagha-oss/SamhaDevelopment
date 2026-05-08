import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { getStatusColor } from "../utils/statusColors";
import { formatAreaShort } from "../utils/formatArea";
import UnitModal from "./UnitModal";
import UnitFormModal from "./UnitFormModal";
import BulkUnitModal from "./BulkUnitModal";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import UnitGrid from "./UnitGrid";

// Solid background colors for matrix cells (different from the badge styling)
const CELL_BG: Record<string, string> = {
  NOT_RELEASED: "bg-slate-300",
  AVAILABLE:    "bg-emerald-400",
  ON_HOLD:      "bg-orange-400",
  RESERVED:     "bg-amber-400",
  BOOKED:       "bg-sky-400",
  SOLD:         "bg-rose-400",
  HANDED_OVER:  "bg-teal-400",
  BLOCKED:      "bg-slate-400",
};

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
}

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
  <span className={`ml-1 text-xs ${active ? "text-blue-600" : "text-slate-300"}`}>
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

  // View mode (Matrix is default for project-scoped view)
  const [viewMode, setViewMode] = useState<"matrix" | "list">(isGlobal ? "list" : "matrix");

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
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<Unit | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

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
          (usersRes.data || []).filter((u: any) => u.role === "SALES_AGENT" || u.role === "OPERATIONS")
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
        className={`text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-0.5 ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}<SortIcon active={sortKey === sk} asc={sortAsc} />
      </button>
    </th>
  );

  return (
    <div className="flex flex-col h-full">

      {/* ── Quick stats strip ── */}
      {!loading && units.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 bg-white border-b border-slate-100 text-xs text-slate-600 flex-shrink-0">
          <span className="font-semibold text-slate-700">Total {units.length}</span>
          <span className="text-slate-300">·</span>
          <span>Available <span className="font-semibold text-emerald-600">{byStatus.AVAILABLE || 0}</span></span>
          <span className="text-slate-300">·</span>
          <span>Reserved <span className="font-semibold text-amber-600">{byStatus.RESERVED || 0}</span></span>
          <span className="text-slate-300">·</span>
          <span>Booked <span className="font-semibold text-sky-600">{byStatus.BOOKED || 0}</span></span>
          <span className="text-slate-300">·</span>
          <span>Sold <span className="font-semibold text-rose-600">{byStatus.SOLD || 0}</span></span>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-slate-100 flex-shrink-0 flex-wrap">
        {!selectionMode ? (
          <>
            {/* Project-mode actions */}
            {!isGlobal && (
              <>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  + Add Unit
                </button>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ⊞ Add Floor
                </button>
              </>
            )}

            <button
              onClick={() => setSelectionMode(true)}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              ☑ Select
            </button>

            {/* View toggle (project mode only — matrix needs a single project) */}
            {!isGlobal && (
              <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setViewMode("matrix")}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${viewMode === "matrix" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  title="Matrix view"
                >
                  ▦ Matrix
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  title="List view"
                >
                  ☰ List
                </button>
              </div>
            )}

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit no…"
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 w-36"
            />

            {/* Project filter — global mode only */}
            {isGlobal && (
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
            >
              <option value="ALL">All Types</option>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {showAdvanced ? "Less ▲" : "More ▼"}
            </button>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium">
                Clear ×
              </button>
            )}

            <span className="ml-auto text-xs text-slate-400">
              {filtered.length.toLocaleString()} / {units.length.toLocaleString()} units
            </span>
          </>
        ) : (
          /* Selection mode bar */
          <>
            <button onClick={exitSelection} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
              ✕ Cancel
            </button>
            <span className="text-sm text-slate-600 font-medium">{selectedIds.size} selected</span>
            <div className="h-5 w-px bg-slate-200 mx-1" />
            {(["RELEASE", "BLOCK", "UNBLOCK", "PRICE_UPDATE"] as const).map((op) => {
              const styles: Record<string, string> = {
                RELEASE:      bulkOp === op ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                BLOCK:        bulkOp === op ? "bg-slate-700 text-white"   : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                UNBLOCK:      bulkOp === op ? "bg-blue-600 text-white"    : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                PRICE_UPDATE: bulkOp === op ? "bg-violet-600 text-white"  : "bg-violet-50 text-violet-700 hover:bg-violet-100",
              };
              const labels: Record<string, string> = { RELEASE: "↑ Release", BLOCK: "⊘ Block", UNBLOCK: "✓ Unblock", PRICE_UPDATE: "$ Price" };
              return (
                <button key={op} onClick={() => setBulkOp(op)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${styles[op]}`}>
                  {labels[op]}
                </button>
              );
            })}
            <span className="ml-auto text-xs text-slate-400">{filtered.length} shown</span>
          </>
        )}
      </div>

      {/* ── Advanced filters ── */}
      {showAdvanced && !selectionMode && (
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 flex-shrink-0">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Agent</label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="ALL">All agents</option>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Min Price (AED)</label>
            <input
              type="number"
              value={filterPriceMin}
              onChange={(e) => setFilterPriceMin(e.target.value)}
              placeholder="0"
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm w-32 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Max Price (AED)</label>
            <input
              type="number"
              value={filterPriceMax}
              onChange={(e) => setFilterPriceMax(e.target.value)}
              placeholder="∞"
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm w-32 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {/* ── Bulk op panel ── */}
      {selectionMode && bulkOp && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3 flex-wrap flex-shrink-0">
          <span className="text-sm font-semibold text-blue-800">{bulkOp.replace(/_/g, " ")}</span>
          {bulkOp !== "PRICE_UPDATE" && (
            <input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder={bulkOp === "BLOCK" ? "Reason (required)" : "Reason (optional)"}
              className="border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400 w-56"
            />
          )}
          {bulkOp === "PRICE_UPDATE" && (
            <div className="flex items-center gap-2">
              <select
                value={bulkPriceType}
                onChange={(e) => setBulkPriceType(e.target.value as any)}
                className="border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none"
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
                className="border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none w-32"
              />
              <input
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Reason (optional)"
                className="border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none w-44"
              />
            </div>
          )}
          <button
            onClick={runBulkOp}
            disabled={bulkSubmitting || selectedIds.size === 0 || (bulkOp === "BLOCK" && !bulkReason)}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkSubmitting ? "Running…" : `Apply to ${selectedIds.size}`}
          </button>
          {bulkResult && (
            <span className="text-sm text-slate-600">
              ✓ {bulkResult.succeeded} done{bulkResult.failed > 0 ? `, ${bulkResult.failed} skipped` : ""}
            </span>
          )}
        </div>
      )}

      {/* ── Status summary pills ── */}
      {!loading && units.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap flex-shrink-0">
          {Object.entries(byStatus).map(([status, count]) => {
            const c = getStatusColor(status);
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "ALL" : status)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all ${c.bg} ${c.text} ${filterStatus === status ? "border-slate-700" : "border-transparent hover:border-slate-300"}`}
              >
                {STATUS_LABELS[status] || status} <span className="font-bold">{count}</span>
              </button>
            );
          })}
          {filterStatus !== "ALL" && (
            <button onClick={() => setFilterStatus("ALL")} className="text-xs text-slate-400 hover:text-slate-600 ml-1">
              Clear ×
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          units.length === 0 ? (
            <EmptyState
              icon="🏢"
              title="No units yet"
              description="Add units one at a time, or import a full floor in bulk."
              action={!isGlobal ? { label: "Import Units", onClick: () => setShowBulkModal(true) } : undefined}
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="No units match the current filters"
              description="Try clearing the search or status filters."
            />
          )
        ) : viewMode === "matrix" && !isGlobal ? (
          <div className="p-4">
            <UnitGrid
              units={filtered as any}
              statusColors={CELL_BG}
              statusLabels={STATUS_LABELS}
              onRefresh={load}
            />
          </div>
        ) : (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
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
                {isGlobal && <Th label="Project" sk="project" />}
                <Th label="Unit No." sk="unitNumber" />
                <Th label="Floor" sk="floor" />
                <Th label="Type" sk="type" />
                <Th label="Area (sqft)" sk="area" />
                <Th label="View" sk="view" />
                <Th label="Price (AED)" sk="price" align="right" />
                <Th label="Status" sk="status" />
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Agent</th>
                {!selectionMode && <th className="px-4 py-2.5 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((unit) => {
                const c = getStatusColor(unit.status);
                const isSelected = selectedIds.has(unit.id);
                const canEdit = !isGlobal && ["AVAILABLE", "BLOCKED", "NOT_RELEASED"].includes(unit.status);
                return (
                  <tr
                    key={unit.id}
                    className={`cursor-pointer group transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}
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

                    {/* Project column (global mode) */}
                    {isGlobal && (
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/projects/${unit.projectId}`); }}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
                        >
                          {projectMap[unit.projectId] || "—"}
                        </button>
                      </td>
                    )}

                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${unit.projectId}/units/${unit.id}`);
                        }}
                        className="font-mono font-semibold text-slate-800 hover:text-blue-600 hover:underline text-xs"
                      >
                        {unit.unitNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">F{unit.floor}</td>
                    <td className="px-4 py-3 text-slate-700 text-xs">{unit.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatAreaShort(unit.area)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{unit.view}</td>

                    {/* Inline price edit */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                          className="w-28 px-2 py-1 border border-blue-400 rounded text-right text-xs font-semibold bg-blue-50"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingPriceId(unit.id); setEditingPrice(unit.price.toString()); }}
                          className="font-semibold text-slate-800 hover:text-blue-600 hover:underline text-xs"
                          title="Click to edit price"
                        >
                          {unit.price.toLocaleString("en-AE")}
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
                        {STATUS_LABELS[unit.status] || unit.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {unit.assignedAgentId ? agentMap[unit.assignedAgentId] || "—" : "—"}
                    </td>

                    {/* Edit + Delete buttons (hover) */}
                    {!selectionMode && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingUnit(unit); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </button>
                          )}
                          {["AVAILABLE", "NOT_RELEASED", "BLOCKED"].includes(unit.status) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteUnit(unit); }}
                              className="text-xs text-red-400 hover:text-red-600 font-medium"
                            >
                              Delete
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
      {showCreateModal && projectId && (
        <UnitFormModal projectId={projectId} onClose={() => setShowCreateModal(false)} onSaved={load} />
      )}
      {showBulkModal && projectId && (
        <BulkUnitModal projectId={projectId} onClose={() => setShowBulkModal(false)} onCreated={load} />
      )}
      {editingUnit && projectId && (
        <UnitFormModal
          projectId={projectId}
          unit={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSaved={() => { setEditingUnit(null); load(); }}
        />
      )}
      {selectedUnit && (
        <UnitModal
          unit={selectedUnit}
          agents={agents}
          statusLabels={STATUS_LABELS}
          onClose={() => setSelectedUnit(null)}
          onRefresh={load}
          onEditUnit={(u) => { setSelectedUnit(null); setEditingUnit(u as Unit); }}
          onDeleted={() => { setSelectedUnit(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteUnit}
        title="Delete Unit"
        message={`Delete unit ${confirmDeleteUnit?.unitNumber}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          const unit = confirmDeleteUnit;
          if (!unit) return;
          setConfirmDeleteUnit(null);
          try {
            await axios.delete(`/api/units/${unit.id}`);
            load();
          } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to delete unit");
          }
        }}
        onCancel={() => setConfirmDeleteUnit(null)}
      />
    </div>
  );
}
