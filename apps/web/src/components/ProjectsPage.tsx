import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Pencil, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import { SkeletonCard } from "./Skeleton";
import { PageContainer, PageHeader } from "./layout";
import { extractApiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Project {
  id: string;
  name: string;
  location: string;
  description?: string;
  totalUnits: number;
  totalFloors?: number;
  projectStatus: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  handoverDate: string;
  launchDate?: string;
  startDate?: string;
  _count?: { units: number };
}

type StatusKey = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
type SortKey = "recent" | "name" | "handover" | "units";
type ViewMode = "grid" | "table";

const BLANK = {
  name: "", location: "", description: "", totalUnits: "", totalFloors: "",
  projectStatus: "ACTIVE", handoverDate: "", launchDate: "", startDate: "",
};

const STATUS_STYLE: Record<StatusKey, { header: string; dot: string; chip: string; accent: string; label: string }> = {
  ACTIVE:    { header: "bg-stage-success text-stage-success-foreground",     dot: "bg-success",     chip: "bg-success-soft text-success",         accent: "bg-success",       label: "Active" },
  ON_HOLD:   { header: "bg-stage-attention text-stage-attention-foreground", dot: "bg-warning",     chip: "bg-warning-soft text-warning",         accent: "bg-warning",       label: "On Hold" },
  COMPLETED: { header: "bg-stage-info text-stage-info-foreground",           dot: "bg-primary",     chip: "bg-info-soft text-primary",            accent: "bg-primary",       label: "Completed" },
  CANCELLED: { header: "bg-stage-danger text-stage-danger-foreground",       dot: "bg-destructive", chip: "bg-destructive-soft text-destructive", accent: "bg-neutral-300",   label: "Cancelled" },
};

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (d: string) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

const SORT_LABELS: Record<SortKey, string> = {
  recent:   "Recent",
  name:     "Name (A–Z)",
  handover: "Handover (soonest)",
  units:    "Largest first",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey | "">("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");

  const load = () => {
    setLoading(true);
    axios.get("/api/projects")
      .then((r) => setProjects(r.data.data || r.data || []))
      .catch((err) => toast.error(extractApiError(err, "Failed to load projects")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(BLANK);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    navigate(`/projects/${p.id}/settings`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        location: form.location,
        description: form.description || undefined,
        totalUnits: parseInt(form.totalUnits),
        totalFloors: form.totalFloors ? parseInt(form.totalFloors) : undefined,
        projectStatus: form.projectStatus,
        handoverDate: form.handoverDate,
        launchDate: form.launchDate || undefined,
        startDate: form.startDate || undefined,
      };
      await axios.post("/api/projects", payload);
      toast.success(`Created "${form.name}"`);
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(extractApiError(err, "Failed to save project"));
    } finally {
      setSubmitting(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<StatusKey | "all", number> = { all: projects.length, ACTIVE: 0, ON_HOLD: 0, COMPLETED: 0, CANCELLED: 0 };
    projects.forEach((p) => { c[p.projectStatus] = (c[p.projectStatus] || 0) + 1; });
    return c;
  }, [projects]);

  const totalPlannedUnits = useMemo(
    () => projects.reduce((sum, p) => sum + (p.totalUnits || 0), 0),
    [projects]
  );
  const totalActualUnits = useMemo(
    () => projects.reduce((sum, p) => sum + (p._count?.units || 0), 0),
    [projects]
  );

  const handoverThisYear = useMemo(() => {
    const year = new Date().getFullYear();
    return projects.filter(
      (p) => new Date(p.handoverDate).getFullYear() === year && p.projectStatus === "ACTIVE"
    ).length;
  }, [projects]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      const matchSearch = !s || p.name.toLowerCase().includes(s) || p.location.toLowerCase().includes(s);
      const matchStatus = !statusFilter || p.projectStatus === statusFilter;
      return matchSearch && matchStatus;
    });
    if (sort === "name")     return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "handover") return [...filtered].sort((a, b) => new Date(a.handoverDate).getTime() - new Date(b.handoverDate).getTime());
    if (sort === "units")    return [...filtered].sort((a, b) => b.totalUnits - a.totalUnits);
    return filtered;
  }, [projects, search, statusFilter, sort]);

  // ── Status chip strip (matches Leads / Deals tab pattern) ───────────────
  const stageTabs = (
    <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Filter projects by status">
      {(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const).map((s) => {
        const active = statusFilter === s;
        const style = STATUS_STYLE[s];
        return (
          <button
            key={s}
            onClick={() => setStatusFilter(active ? "" : s)}
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
              active ? `${style.header} border-current shadow-sm` : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
            {style.label}
            <span className={`ml-0.5 text-[10px] tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>{counts[s]}</span>
          </button>
        );
      })}
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or location…"
          aria-label="Search projects"
          className="w-full h-9 pl-8 pr-3 text-sm border border-input rounded-lg bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setView("grid")}
          aria-label="Grid view"
          aria-pressed={view === "grid"}
          className={`h-9 px-2.5 text-sm inline-flex items-center gap-1 ${
            view === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="size-3.5" /> Grid
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
            Sort: {SORT_LABELS[sort]} ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <DropdownMenuItem key={k} onClick={() => setSort(k)}>{SORT_LABELS[k]}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── KPI strip ───────────────────────────────────────────────────────────
  const kpiStrip = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Portfolio</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{projects.length}</div>
        <div className="text-[11px] text-muted-foreground">projects</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Units loaded</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{totalActualUnits.toLocaleString()}</div>
        <div className="text-[11px] text-muted-foreground">/ {totalPlannedUnits.toLocaleString()} planned</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Active</div>
        <div className="text-lg font-bold text-foreground tabular-nums">{counts.ACTIVE}</div>
        <div className="text-[11px] text-muted-foreground">in pipeline</div>
      </div>
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Handover this year</div>
        <div className={`text-lg font-bold tabular-nums ${handoverThisYear > 0 ? "text-warning" : "text-foreground"}`}>{handoverThisYear}</div>
        <div className="text-[11px] text-muted-foreground">due to close</div>
      </div>
    </div>
  );

  const clearFilters = () => { setSearch(""); setStatusFilter(""); };

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Projects" }]}
        title="Projects"
        subtitle={`${projects.length} projects total`}
        actions={<Button onClick={openCreate}>Create project</Button>}
        tabs={stageTabs}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {!loading && projects.length > 0 && kpiStrip}
        {filterZone}
      </PageContainer>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon="⊕"
            title="No projects yet"
            description="Create your first project to start adding units and tracking deals."
            action={{ label: "Create Project", onClick: openCreate }}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="⌕"
            title="No matching projects"
            description="Try clearing filters or searching with a different term."
            action={{ label: "Clear filters", onClick: clearFilters }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                onOpen={() => navigate(`/projects/${p.id}`)}
                onEdit={() => openEdit(p)}
              />
            ))}
          </div>
        ) : (
          <ProjectTable
            rows={visible}
            onOpen={(p) => navigate(`/projects/${p.id}`)}
            onEdit={openEdit}
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={showForm}
        onClose={() => { if (!submitting) setShowForm(false); }}
        title="Create project"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className={lbl}>Project Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Samha Tower" className={inp} />
          </div>
          <div>
            <label className={lbl}>Location *</label>
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Dubai Marina" className={inp} />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description, highlights, amenities…"
              className={`${inp} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Total Units *</label>
              <input required type="number" min="1" value={form.totalUnits} onChange={(e) => setForm({ ...form, totalUnits: e.target.value })} placeholder="e.g. 173" className={inp} />
            </div>
            <div>
              <label className={lbl}>Total Floors</label>
              <input type="number" min="1" value={form.totalFloors} onChange={(e) => setForm({ ...form, totalFloors: e.target.value })} placeholder="e.g. 25" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Project Status</label>
              <select value={form.projectStatus} onChange={(e) => setForm({ ...form, projectStatus: e.target.value })} className={inp}>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Handover Date *</label>
              <input required type="date" value={form.handoverDate} onChange={(e) => setForm({ ...form, handoverDate: e.target.value })} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Launch Date</label>
              <input type="date" value={form.launchDate} onChange={(e) => setForm({ ...form, launchDate: e.target.value })} className={inp} />
            </div>
            <div>
              <label className={lbl}>Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inp} />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive bg-destructive-soft px-3 py-2 rounded-lg" role="alert">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50">
              {submitting ? "Saving…" : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function ProjectCard({
  p,
  onOpen,
  onEdit,
}: {
  p: Project;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const days = daysUntil(p.handoverDate);
  const handoverColor = days < 0 ? "text-destructive" : days < 90 ? "text-warning" : "text-success";
  const style = STATUS_STYLE[p.projectStatus] || STATUS_STYLE.ACTIVE;
  const handoverLabel = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
  const actualUnits = p._count?.units ?? 0;
  const fillPct = p.totalUnits > 0 ? Math.round((actualUnits / p.totalUnits) * 100) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className={`h-1 ${style.accent}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{p.name}</h2>
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${style.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
                {style.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{p.location}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted text-sm p-1.5 rounded-md transition-all shrink-0"
            title="Edit project"
            aria-label={`Edit ${p.name}`}
          >
            <Pencil className="size-3.5" />
          </button>
        </div>

        {p.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
        )}

        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Units loaded</p>
              <p className="text-[11px] text-muted-foreground font-medium">
                <span className="font-bold text-foreground">{actualUnits}</span>
                <span className="text-muted-foreground"> / {p.totalUnits} planned</span>
                {p.totalFloors ? <span className="text-muted-foreground"> · {p.totalFloors}F</span> : null}
              </p>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${fillPct >= 100 ? "bg-success" : fillPct >= 50 ? "bg-primary" : "bg-neutral-300"}`}
                style={{ width: `${Math.min(fillPct, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Handover</p>
            <p className="text-right">
              <span className={`font-bold text-sm leading-tight ${handoverColor}`}>{fmtDate(p.handoverDate)}</span>
              <span className="text-[11px] text-muted-foreground ml-2">{handoverLabel}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectTable({
  rows,
  onOpen,
  onEdit,
}: {
  rows: Project[];
  onOpen: (p: Project) => void;
  onEdit: (p: Project) => void;
}) {
  return (
    <div className="overflow-auto bg-card rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2.5 text-left">Project</th>
            <th className="px-3 py-2.5 text-left">Location</th>
            <th className="px-3 py-2.5 text-left">Status</th>
            <th className="px-3 py-2.5 text-left">Units (loaded / planned)</th>
            <th className="px-3 py-2.5 text-left">Handover</th>
            <th className="px-3 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => {
            const days = daysUntil(p.handoverDate);
            const handoverColor = days < 0 ? "text-destructive" : days < 90 ? "text-warning" : "text-foreground";
            const style = STATUS_STYLE[p.projectStatus] || STATUS_STYLE.ACTIVE;
            const sub = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "today" : `in ${days} days`;
            const actualUnits = p._count?.units ?? 0;
            const fillPct = p.totalUnits > 0 ? Math.round((actualUnits / p.totalUnits) * 100) : 0;
            const fillCls = fillPct >= 100 ? "bg-success" : fillPct >= 50 ? "bg-primary" : "bg-neutral-300";
            return (
              <tr
                key={p.id}
                onClick={() => onOpen(p)}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5 font-semibold text-foreground">{p.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.location}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${style.header}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {style.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground tabular-nums">{actualUnits}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">/ {p.totalUnits}</span>
                    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fillCls}`} style={{ width: `${Math.min(fillPct, 100)}%` }} />
                    </div>
                    {p.totalFloors ? <span className="text-[11px] text-muted-foreground">· {p.totalFloors}F</span> : null}
                  </div>
                </td>
                <td className={`px-3 py-2.5 ${handoverColor} whitespace-nowrap`}>
                  <div className="font-medium">{fmtDate(p.handoverDate)}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm p-1.5 rounded-md transition-colors"
                    title="Edit project"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
