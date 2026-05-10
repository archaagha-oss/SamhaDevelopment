import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Pencil, Building2, Search } from "lucide-react";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import { SkeletonCard } from "./Skeleton";
import { PageContainer, PageHeader } from "./layout";
import { Button } from "@/components/ui/button";

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

const STATUS_CONFIG: Record<StatusKey, { label: string; chip: string; dot: string; accent: string }> = {
  ACTIVE:    { label: "Active",    chip: "bg-success-soft text-success", dot: "bg-success", accent: "bg-success" },
  ON_HOLD:   { label: "On Hold",   chip: "bg-warning-soft text-warning",     dot: "bg-warning",   accent: "bg-warning" },
  COMPLETED: { label: "Completed", chip: "bg-info-soft text-primary",       dot: "bg-primary",    accent: "bg-primary" },
  CANCELLED: { label: "Cancelled", chip: "bg-destructive-soft text-destructive",         dot: "bg-destructive",     accent: "bg-neutral-300" },
};

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (d: string) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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
      .catch((err) => toast.error(err?.response?.data?.error || "Failed to load projects"))
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
      setFormError(err.response?.data?.error || "Failed to save project");
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
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "handover") return [...filtered].sort((a, b) => new Date(a.handoverDate).getTime() - new Date(b.handoverDate).getTime());
    if (sort === "units") return [...filtered].sort((a, b) => b.totalUnits - a.totalUnits);
    return filtered;
  }, [projects, search, statusFilter, sort]);

  const clearFilters = () => { setSearch(""); setStatusFilter(""); };

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Projects" }]}
        title="Projects"
        subtitle="Browse your portfolio. Open a project to manage leads, deals, units, and documents."
        actions={<Button onClick={openCreate}>Create project</Button>}
      />

      <PageContainer padding="compact" className="flex-shrink-0 space-y-3">
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Portfolio" value={projects.length} suffix="projects" />
            <KPI
              label="Units loaded"
              value={totalActualUnits.toLocaleString()}
              suffix={`/ ${totalPlannedUnits.toLocaleString()} planned`}
            />
            <KPI label="Active" value={counts.ACTIVE} tone="emerald" />
            <KPI label="Handover this year" value={handoverThisYear} tone="amber" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by name or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg w-72 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring bg-card"
          />

          <div className="flex gap-1">
            <FilterPill active={!statusFilter} onClick={() => setStatusFilter("")} count={counts.all}>
              All
            </FilterPill>
            {(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const).map((s) => (
              <FilterPill
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                count={counts[s]}
                dotClass={STATUS_CONFIG[s].dot}
              >
                {STATUS_CONFIG[s].label}
              </FilterPill>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:border-ring"
              aria-label="Sort projects"
            >
              <option value="recent">Recent</option>
              <option value="name">Name (A→Z)</option>
              <option value="handover">Handover (soonest)</option>
              <option value="units">Largest first</option>
            </select>
            <div className="flex border border-border rounded-lg overflow-hidden bg-card">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-2 text-sm transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                ⊞
              </button>
              <button
                onClick={() => setView("table")}
                className={`px-3 py-2 text-sm transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                title="Table view"
                aria-label="Table view"
                aria-pressed={view === "table"}
              >
                ≡
              </button>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="No projects yet"
            description="Create your first project to start adding units and tracking deals."
            action={{ label: "Create project", onClick: openCreate }}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Search className="size-10 text-muted-foreground" aria-hidden="true" />}
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

function KPI({
  label,
  value,
  suffix,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: "slate" | "emerald" | "amber" | "blue";
}) {
  const toneCls = {
    slate:   "bg-card border-border",
    emerald: "bg-success-soft/60 border-success/30",
    amber:   "bg-warning-soft/60 border-warning/30",
    blue:    "bg-info-soft/60 border-primary/40",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneCls}`}>
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5">
        {value}
        {suffix && <span className="text-xs font-medium text-muted-foreground ml-1.5">{suffix}</span>}
      </p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  count,
  dotClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  dotClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted"
      }`}
    >
      {dotClass && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-card" : dotClass}`} />}
      {children}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-white/20" : "bg-card text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}

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
  const statusCfg = STATUS_CONFIG[p.projectStatus] || STATUS_CONFIG.ACTIVE;
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
      <div className={`h-1 ${statusCfg.accent}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{p.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${statusCfg.chip}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{p.location}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center min-w-9 min-h-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Edit project"
            aria-label={`Edit ${p.name}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
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
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Units (loaded / planned)</th>
              <th className="px-4 py-3 font-semibold">Handover</th>
              <th className="px-4 py-3 font-semibold w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const days = daysUntil(p.handoverDate);
              const handoverColor = days < 0 ? "text-destructive" : days < 90 ? "text-warning" : "text-foreground";
              const statusCfg = STATUS_CONFIG[p.projectStatus] || STATUS_CONFIG.ACTIVE;
              const sub = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "today" : `in ${days} days`;
              const actualUnits = p._count?.units ?? 0;
              const fillPct = p.totalUnits > 0 ? Math.round((actualUnits / p.totalUnits) * 100) : 0;
              const fillCls = fillPct >= 100 ? "bg-success" : fillPct >= 50 ? "bg-primary" : "bg-neutral-300";
              return (
                <tr
                  key={p.id}
                  onClick={() => onOpen(p)}
                  className="hover:bg-info-soft/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.location}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${statusCfg.chip}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground tabular-nums">{actualUnits}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">/ {p.totalUnits}</span>
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fillCls}`} style={{ width: `${Math.min(fillPct, 100)}%` }} />
                      </div>
                      {p.totalFloors ? <span className="text-[11px] text-muted-foreground">· {p.totalFloors}F</span> : null}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${handoverColor} whitespace-nowrap`}>
                    <div className="font-medium">{fmtDate(p.handoverDate)}</div>
                    <div className="text-xs text-muted-foreground">{sub}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                      className="inline-flex items-center justify-center min-w-9 min-h-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Edit project"
                      aria-label={`Edit ${p.name}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
