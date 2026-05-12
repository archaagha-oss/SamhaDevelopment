import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Search, Filter, MoreVertical, X, ArrowUp, Ban, Check, DollarSign, Ruler,
} from "lucide-react";
import { getStatusColor } from "../utils/statusColors";
import { formatAreaShort } from "../utils/formatArea";
import { formatDirham } from "@/lib/money";
import EmptyState from "./EmptyState";
import HoverPreview from "./HoverPreview";
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
  images?: UnitImageLite[];
}

interface Project { id: string; name: string; }
interface Agent   { id: string; name: string; }

// Status grouping. Active four front-and-center, terminal/edge stages live
// in the "More" dropdown — same shape as Leads / Deals.
const ACTIVE_STATUSES = ["AVAILABLE", "ON_HOLD", "RESERVED", "BOOKED"] as const;
const EXTRA_STATUSES  = ["NOT_RELEASED", "SOLD", "BLOCKED", "HANDED_OVER"] as const;
const ALL_STATUSES    = [...ACTIVE_STATUSES, ...EXTRA_STATUSES] as const;

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

type Density = "compact" | "comfortable";
type SortKey = "project" | "unitNumber" | "floor" | "type" | "area" | "price" | "status";
type BulkOp  = "RELEASE" | "BLOCK" | "UNBLOCK" | "PRICE_UPDATE";

export default function UnitsPage() {
  const navigate = useNavigate();

  // ── Data ────────────────────────────────────────────────────────────────
  const [units,    setUnits]    = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents,   setAgents]   = useState<Agent[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── Filters ─────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [typeFilter,    setTypeFilter]    = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [agentFilter,   setAgentFilter]   = useState("");
  const [priceMin,      setPriceMin]      = useState("");
  const [priceMax,      setPriceMax]      = useState("");

  // ── View / density ──────────────────────────────────────────────────────
  const [density, setDensity] = useState<Density>("compact");

  // ── Sort ────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("project");
  const [sortAsc, setSortAsc] = useState(true);

  // ── Inline price edit ───────────────────────────────────────────────────
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPrice,   setEditingPrice]   = useState("");
  const [savingPrice,    setSavingPrice]    = useState(false);

  // ── Bulk selection ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy,    setBulkBusy]    = useState(false);
  const [bulkOp,      setBulkOp]      = useState<BulkOp | null>(null);
  const [bulkReason,  setBulkReason]  = useState("");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkPriceType,  setBulkPriceType]  = useState<"PERCENT" | "FIXED_DELTA" | "FIXED">("PERCENT");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────
  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get("/api/units", { params: { limit: 2000 } }),
      axios.get("/api/users"),
      axios.get("/api/projects"),
    ])
      .then(([u, usersRes, p]) => {
        setUnits(u.data.data || u.data || []);
        setAgents(
          (usersRes.data || []).filter((x: any) => x.status === "ACTIVE" && x.role !== "VIEWER")
        );
        setProjects(p.data.data || p.data || []);
      })
      .catch((err) => toast.error(err?.response?.data?.error || "Failed to load units"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects]);
  const agentMap   = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a.name])),   [agents]);

  // ── Counts ──────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    units.forEach((u) => { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }, [units]);

  // ── Filtered + sorted ───────────────────────────────────────────────────
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return units.filter((u) => {
      if (s && !u.unitNumber.toLowerCase().includes(s)) return false;
      if (statusFilter  && u.status     !== statusFilter)  return false;
      if (typeFilter    && u.type       !== typeFilter)    return false;
      if (projectFilter && u.projectId  !== projectFilter) return false;
      if (agentFilter) {
        if (agentFilter === "UNASSIGNED" && u.assignedAgentId) return false;
        if (agentFilter !== "UNASSIGNED" && u.assignedAgentId !== agentFilter) return false;
      }
      if (priceMin && u.price < parseInt(priceMin)) return false;
      if (priceMax && u.price > parseInt(priceMax)) return false;
      return true;
    });
  }, [units, search, statusFilter, typeFilter, projectFilter, agentFilter, priceMin, priceMax]);

  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "project":    av = projectMap[a.projectId] || ""; bv = projectMap[b.projectId] || ""; break;
        case "unitNumber": av = a.unitNumber; bv = b.unitNumber; break;
        case "floor":      av = a.floor; bv = b.floor; break;
        case "type":       av = a.type; bv = b.type; break;
        case "area":       av = a.area; bv = b.area; break;
        case "price":      av = a.price; bv = b.price; break;
        case "status":     av = a.status; bv = b.status; break;
      }
      if (typeof av === "string") { av = av.toLowerCase(); bv = (bv as string).toLowerCase(); }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ?  1 : -1;
      return 0;
    });
    return copy;
  }, [visible, sortKey, sortAsc, projectMap]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const available = counts.AVAILABLE || 0;
    const reservedHeld = (counts.RESERVED || 0) + (counts.ON_HOLD || 0) + (counts.BOOKED || 0);
    const sold = (counts.SOLD || 0) + (counts.HANDED_OVER || 0);
    const total = units.length;
    return { available, reservedHeld, sold, total };
  }, [counts, units.length]);

  const anyAdvancedFilter = !!(typeFilter || projectFilter || agentFilter || priceMin || priceMax);

  // ── Search debounce ─────────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {/* search is local — no fetch */}, 200);
  };

  // ── Bulk selection ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection  = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(visible.map((u) => u.id)));

  // ── Bulk ops ────────────────────────────────────────────────────────────
  const openBulkOp = (op: BulkOp) => {
    setBulkOp(op);
    setBulkReason("");
    setBulkPriceValue("");
    setBulkPriceType("PERCENT");
  };
  const closeBulkOp = () => {
    setBulkOp(null);
    setBulkReason("");
    setBulkPriceValue("");
  };

  const runBulkOp = async () => {
    if (!bulkOp || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const body: any = { unitIds: Array.from(selectedIds), operation: bulkOp };
      if (bulkReason) body.reason = bulkReason;
      if (bulkOp === "PRICE_UPDATE" && bulkPriceValue) {
        body.value = (bulkPriceType === "PERCENT" || bulkPriceType === "FIXED_DELTA")
          ? { type: bulkPriceType, amount: parseFloat(bulkPriceValue) }
          : parseFloat(bulkPriceValue);
      }
      const r = await axios.post("/api/units/bulk-ops", body);
      toast.success(`${r.data.succeeded} done${r.data.failed > 0 ? ` · ${r.data.failed} skipped` : ""}`);
      closeBulkOp();
      clearSelection();
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Bulk operation failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const reasonRequired = bulkOp === "RELEASE" || bulkOp === "BLOCK" || bulkOp === "UNBLOCK";
  const canRunBulk = !!bulkOp && selectedIds.size > 0
    && (!reasonRequired || bulkReason.trim().length > 0)
    && (bulkOp !== "PRICE_UPDATE" || !!bulkPriceValue);

  // ── Inline price edit ───────────────────────────────────────────────────
  const savePrice = async (unitId: string, newPrice: number) => {
    setSavingPrice(true);
    try {
      await axios.patch(`/api/units/${unitId}`, { price: newPrice });
      setUnits((prev) => prev.map((u) => u.id === unitId ? { ...u, price: newPrice } : u));
      setEditingPriceId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save price");
    } finally {
      setSavingPrice(false);
    }
  };

  // ── Filter chips ────────────────────────────────────────────────────────
  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search) chips.push({ key: "search", label: "Search", value: search, onRemove: () => setSearch("") });
    if (typeFilter) chips.push({ key: "type", label: "Type", value: typeFilter.replace(/_/g, " "), onRemove: () => setTypeFilter("") });
    if (projectFilter) chips.push({ key: "project", label: "Project", value: projectMap[projectFilter] || projectFilter, onRemove: () => setProjectFilter("") });
    if (agentFilter) {
      const value = agentFilter === "UNASSIGNED" ? "Unassigned" : (agentMap[agentFilter] || agentFilter);
      chips.push({ key: "agent", label: "Agent", value, onRemove: () => setAgentFilter("") });
    }
    if (priceMin || priceMax) {
      const fmt = (v: string) => (v ? Number(v).toLocaleString() : "");
      const value = priceMin && priceMax ? `${fmt(priceMin)} – ${fmt(priceMax)}`
        : priceMin ? `≥ ${fmt(priceMin)}` : `≤ ${fmt(priceMax)}`;
      chips.push({ key: "price", label: "Price", value, onRemove: () => { setPriceMin(""); setPriceMax(""); } });
    }
    return chips;
  }, [search, typeFilter, projectFilter, agentFilter, priceMin, priceMax, projectMap, agentMap]);

  const resetFilters = () => {
    setSearch(""); setStatusFilter(""); setTypeFilter("");
    setProjectFilter(""); setAgentFilter("");
    setPriceMin(""); setPriceMax("");
  };

  // ── Status chip strip ───────────────────────────────────────────────────
  const statusTabs = (
    <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Filter units by status">
      {ACTIVE_STATUSES.map((s) => {
        const active = statusFilter === s;
        const c = getStatusColor(s);
        return (
          <button
            key={s}
            onClick={() => setStatusFilter(active ? "" : s)}
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
              active ? `${c.bg} ${c.text} border-current shadow-sm` : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
            {STATUS_LABELS[s]}
            <span className={`ml-0.5 text-[10px] tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>{counts[s] || 0}</span>
          </button>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border shrink-0 ${
              EXTRA_STATUSES.includes(statusFilter as any)
                ? `${getStatusColor(statusFilter).bg} ${getStatusColor(statusFilter).text} border-current shadow-sm`
                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {EXTRA_STATUSES.includes(statusFilter as any) ? STATUS_LABELS[statusFilter] : "More"} ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {EXTRA_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}>
              <span className={`w-2 h-2 rounded-full ${getStatusColor(s).dot} mr-2`} />
              {STATUS_LABELS[s]}
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{counts[s] || 0}</span>
            </DropdownMenuItem>
          ))}
          {statusFilter && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter("")}>Clear status filter</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── Compact filter zone ─────────────────────────────────────────────────
  const filterZone = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search unit no…"
          aria-label="Search units"
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
                {[typeFilter, projectFilter, agentFilter, priceMin || priceMax].filter(Boolean).length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-3 space-y-3">
          <DropdownMenuLabel className="px-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filters</DropdownMenuLabel>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project</label>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All types</option>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Agent</label>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full h-8 px-2 text-sm border border-input rounded-md bg-card">
              <option value="">All agents</option>
              <option value="UNASSIGNED">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Price range</label>
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
              onClick={() => { setTypeFilter(""); setProjectFilter(""); setAgentFilter(""); setPriceMin(""); setPriceMax(""); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground border border-border rounded-md py-1.5"
            >
              Clear filters
            </button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Available</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.available}</div>
        <div className="text-[11px] text-muted-foreground">ready to sell</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Held / Reserved</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.reservedHeld}</div>
        <div className="text-[11px] text-muted-foreground">on hold / reserved / booked</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sold</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.sold}</div>
        <div className="text-[11px] text-muted-foreground">sold or handed over</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{kpis.total}</div>
        <div className="text-[11px] text-muted-foreground">all inventory</div>
      </div>
    </div>
  );

  // ── Sortable column header ──────────────────────────────────────────────
  const Th = ({ label, sk, align = "left" }: { label: string; sk?: SortKey; align?: "left" | "right" }) => (
    <th className={`px-3 py-2.5 text-${align} text-xs font-semibold text-muted-foreground uppercase tracking-wide`}>
      {sk ? (
        <button
          onClick={() => toggleSort(sk)}
          className={`inline-flex items-center gap-0.5 hover:text-foreground ${align === "right" ? "ml-auto" : ""}`}
        >
          {label}
          <span className={`text-xs ${sortKey === sk ? "text-foreground" : "text-foreground/60"}`}>
            {sortKey === sk ? (sortAsc ? "↑" : "↓") : "⇅"}
          </span>
        </button>
      ) : label}
    </th>
  );

  // ── Table view ──────────────────────────────────────────────────────────
  const tableView = (
    <div className="overflow-auto bg-card rounded-xl border border-border mx-4 my-3">
      <table className="w-full text-sm" style={{ minWidth: 960 }}>
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2.5 text-left w-8">
              <input
                type="checkbox"
                aria-label="Select all visible"
                checked={visible.length > 0 && selectedIds.size === visible.length}
                onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
              />
            </th>
            <th className="px-3 py-2.5 text-center" style={{ width: 56 }}>Plan</th>
            <Th label="Project" sk="project" />
            <Th label="Unit"    sk="unitNumber" />
            <Th label="Floor"   sk="floor" />
            <Th label="Type"    sk="type" />
            <Th label="Area"    sk="area" />
            <Th label="Price"   sk="price" align="right" />
            <Th label="Status"  sk="status" />
            <Th label="Agent"   />
            <th className="px-3 py-2.5 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((unit) => {
            const c       = getStatusColor(unit.status);
            const isSel   = selectedIds.has(unit.id);
            const plan    = unit.images?.[0];
            const padCls  = density === "comfortable" ? "py-3.5" : "py-2.5";
            return (
              <tr
                key={unit.id}
                onClick={() => navigate(`/projects/${unit.projectId}/units/${unit.id}`)}
                className={`cursor-pointer hover:bg-muted/30 transition-colors ${isSel ? "bg-info-soft/40" : ""}`}
              >
                <td className={`px-3 ${padCls}`} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(unit.id)} aria-label={`Select ${unit.unitNumber}`} />
                </td>
                <td className={`px-3 ${padCls} text-center`} onClick={(e) => e.stopPropagation()} style={{ width: 56 }}>
                  {plan ? (
                    <HoverPreview src={plan.url} caption={plan.caption || `Floor plan — ${unit.unitNumber}`} size={360}>
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${unit.projectId}/units/${unit.id}`)}
                        className="w-10 h-10 rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors bg-muted/50 align-middle"
                        title="Hover to enlarge · click to open unit"
                        aria-label="Open unit"
                      >
                        <img
                          src={plan.url}
                          alt={plan.caption || "Floor plan"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    </HoverPreview>
                  ) : (
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-border text-muted-foreground" title="No floor plan uploaded">
                      <Ruler className="size-3.5" />
                    </span>
                  )}
                </td>
                <td className={`px-3 ${padCls}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/projects/${unit.projectId}`); }}
                    className="text-primary hover:underline text-xs font-medium"
                  >
                    {projectMap[unit.projectId] || "—"}
                  </button>
                </td>
                <td className={`px-3 ${padCls} font-mono font-semibold text-foreground text-xs`}>{unit.unitNumber}</td>
                <td className={`px-3 ${padCls} text-muted-foreground text-xs`}>F{unit.floor}</td>
                <td className={`px-3 ${padCls} text-foreground text-xs`}>{unit.type.replace(/_/g, " ")}</td>
                <td className={`px-3 ${padCls} text-muted-foreground text-xs tabular-nums`}>{formatAreaShort(unit.area)}</td>
                <td className={`px-3 ${padCls} text-right tabular-nums`} onClick={(e) => e.stopPropagation()}>
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
                      className="font-semibold text-foreground hover:text-primary hover:underline text-xs tabular-nums"
                      title="Click to edit price"
                    >
                      {formatDirham(unit.price)}
                    </button>
                  )}
                </td>
                <td className={`px-3 ${padCls}`}>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {STATUS_LABELS[unit.status] || unit.status}
                  </span>
                </td>
                <td className={`px-3 ${padCls} text-xs text-muted-foreground`}>
                  {unit.assignedAgentId ? (agentMap[unit.assignedAgentId] || "—") : "—"}
                </td>
                <td className={`px-3 ${padCls}`} onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Unit actions" className="p-1 text-muted-foreground hover:text-foreground rounded">
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => navigate(`/projects/${unit.projectId}/units/${unit.id}`)}>
                        View unit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/projects/${unit.projectId}/units/${unit.id}/edit`)}>
                        Edit unit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/projects/${unit.projectId}`)}>
                        Open project
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

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Units" }]}
        title="Units"
        subtitle={`${units.length} units total`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Create unit</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pick a project
              </DropdownMenuLabel>
              {projects.length === 0 ? (
                <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
              ) : projects.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => navigate(`/projects/${p.id}/units/new`)}>
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        tabs={statusTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {!loading && units.length > 0 && kpiStrip}
        {filterZone}
        {activeChips.length > 0 && (
          <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
        )}
      </PageContainer>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="◯"
            title={search || statusFilter || anyAdvancedFilter ? "No units match your filters" : "No units yet"}
            description={search || statusFilter || anyAdvancedFilter ? "Try clearing filters or searching with a different term." : "Open a project to start adding units."}
            action={search || statusFilter || anyAdvancedFilter ? { label: "Clear filters", onClick: resetFilters } : undefined}
          />
        ) : tableView}
      </div>

      {/* ── Bulk action bar (sticky bottom when selection > 0) ──────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded-xl shadow-lg flex items-center gap-2 px-3 py-2 w-[min(720px,calc(100vw-2rem))]">
          <span className="text-sm font-semibold text-foreground tabular-nums">{selectedIds.size} selected</span>
          <span className="text-xs text-muted-foreground">·</span>
          <button onClick={() => openBulkOp("RELEASE")}      disabled={bulkBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted/60 disabled:opacity-50 inline-flex items-center gap-1.5"><ArrowUp className="size-3.5" /> Release</button>
          <button onClick={() => openBulkOp("BLOCK")}        disabled={bulkBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted/60 disabled:opacity-50 inline-flex items-center gap-1.5"><Ban className="size-3.5" /> Block</button>
          <button onClick={() => openBulkOp("UNBLOCK")}      disabled={bulkBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted/60 disabled:opacity-50 inline-flex items-center gap-1.5"><Check className="size-3.5" /> Unblock</button>
          <button onClick={() => openBulkOp("PRICE_UPDATE")} disabled={bulkBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted/60 disabled:opacity-50 inline-flex items-center gap-1.5"><DollarSign className="size-3.5" /> Price</button>
          <div className="flex-1" />
          <button onClick={clearSelection} aria-label="Clear selection" className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ── Bulk op modal ─────────────────────────────────────────────── */}
      {bulkOp && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !bulkBusy && closeBulkOp()}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">
                {bulkOp === "RELEASE"      ? "Release units" :
                 bulkOp === "BLOCK"        ? "Block units" :
                 bulkOp === "UNBLOCK"      ? "Unblock units" :
                                             "Update prices"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedIds.size} unit{selectedIds.size === 1 ? "" : "s"} selected.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              {bulkOp === "PRICE_UPDATE" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Adjustment type</label>
                    <select value={bulkPriceType} onChange={(e) => setBulkPriceType(e.target.value as any)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring">
                      <option value="PERCENT">% Change</option>
                      <option value="FIXED_DELTA">AED Delta</option>
                      <option value="FIXED">Set Fixed AED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Amount *</label>
                    <input type="number" value={bulkPriceValue} onChange={(e) => setBulkPriceValue(e.target.value)}
                      placeholder={bulkPriceType === "PERCENT" ? "e.g. 5 or -3" : "Amount"}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason <span className="text-muted-foreground">(optional)</span></label>
                    <input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)}
                      placeholder="e.g. Q3 list-price refresh"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason *</label>
                  <textarea value={bulkReason} onChange={(e) => setBulkReason(e.target.value)}
                    placeholder={
                      bulkOp === "RELEASE" ? "Release note for audit" :
                      bulkOp === "BLOCK"   ? "Why are these blocked?" :
                                             "Why unblocking now?"
                    }
                    rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring resize-none" />
                </div>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={closeBulkOp} disabled={bulkBusy}
                className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm disabled:opacity-50">
                Cancel
              </button>
              <button onClick={runBulkOp} disabled={!canRunBulk || bulkBusy}
                className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50">
                {bulkBusy ? "Running…" : `Apply to ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
