import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import { SkeletonCard } from "./Skeleton";

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

const BLANK = {
  name: "", location: "", description: "", totalUnits: "", totalFloors: "",
  projectStatus: "ACTIVE", handoverDate: "", launchDate: "", startDate: "",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Active",    cls: "bg-emerald-100 text-emerald-700" },
  ON_HOLD:   { label: "On Hold",   cls: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (d: string) => {
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = () => {
    setLoading(true);
    axios.get("/api/projects")
      .then((r) => setProjects(r.data.data || r.data || []))
      .catch((err) => {
        toast.error(err?.response?.data?.error || "Failed to load projects");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditProject(null);
    setForm(BLANK);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    setForm({
      name: p.name,
      location: p.location,
      description: p.description || "",
      totalUnits: String(p.totalUnits),
      totalFloors: p.totalFloors ? String(p.totalFloors) : "",
      projectStatus: p.projectStatus || "ACTIVE",
      handoverDate: p.handoverDate ? p.handoverDate.slice(0, 10) : "",
      launchDate: p.launchDate ? p.launchDate.slice(0, 10) : "",
      startDate: p.startDate ? p.startDate.slice(0, 10) : "",
    });
    setFormError(null);
    setShowForm(true);
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
      if (editProject) {
        await axios.patch(`/api/projects/${editProject.id}`, payload);
        toast.success(`Updated "${form.name}"`);
      } else {
        await axios.post("/api/projects", payload);
        toast.success(`Created "${form.name}"`);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Failed to save project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteProject(p);
  };

  const doDeleteProject = async () => {
    const p = confirmDeleteProject;
    if (!p) return;
    setConfirmDeleteProject(null);
    setDeleting(p.id);
    try {
      await axios.delete(`/api/projects/${p.id}`);
      toast.success(`Deleted "${p.name}"`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete project");
    } finally {
      setDeleting(null);
    }
  };

  const handleClone = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cloning) return;
    setCloning(p.id);
    try {
      await axios.post(`/api/projects/${p.id}/clone`, { includeUnits: false });
      toast.success(`Cloned "${p.name}"`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to clone project");
    } finally {
      setCloning(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Projects</h1>
            <p className="text-slate-400 text-xs mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> New Project
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-blue-400 bg-slate-50"
          />
          <div className="flex gap-1">
            {["", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {s === "" ? "All" : STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.filter((p) => {
              const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase());
              const matchStatus = !statusFilter || p.projectStatus === statusFilter;
              return matchSearch && matchStatus;
            }).map((p) => {
              const days = daysUntil(p.handoverDate);
              const handoverColor = days < 0 ? "text-red-600" : days < 90 ? "text-amber-600" : "text-emerald-600";
              const statusCfg = STATUS_CONFIG[p.projectStatus] || STATUS_CONFIG.ACTIVE;
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{p.location}</p>
                      {p.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={(e) => handleClone(p, e)}
                        disabled={cloning === p.id}
                        className="text-slate-300 hover:text-slate-600 text-xs p-1 rounded transition-colors disabled:opacity-40"
                        title="Clone project"
                      >
                        {cloning === p.id ? "…" : "⊕"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        className="text-slate-300 hover:text-slate-600 text-sm p-1 rounded transition-colors"
                        title="Edit project"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => handleDelete(p, e)}
                        disabled={deleting === p.id}
                        className="text-slate-300 hover:text-red-500 text-sm p-1 rounded transition-colors disabled:opacity-40"
                        title="Delete project"
                      >
                        {deleting === p.id ? "…" : "✕"}
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-0.5">Total Units{p.totalFloors ? ` · ${p.totalFloors}F` : ""}</p>
                      <p className="font-bold text-slate-800 text-lg">{p.totalUnits}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-0.5">Handover</p>
                      <p className={`font-bold text-sm ${handoverColor}`}>{fmtDate(p.handoverDate)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-blue-600 font-medium group-hover:underline">View details →</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => { if (!submitting) setShowForm(false); }}
        title={editProject ? "Edit Project" : "New Project"}
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
          {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
              {submitting ? "Saving…" : editProject ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteProject}
        title="Delete Project"
        message={`Delete "${confirmDeleteProject?.name}"? This cannot be undone and will fail if the project has units with active deals.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDeleteProject}
        onCancel={() => setConfirmDeleteProject(null)}
      />
    </div>
  );
}
