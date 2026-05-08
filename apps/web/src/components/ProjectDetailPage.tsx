import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import UnitsTable from "./UnitsTable";
import ProjectDocumentsTab from "./ProjectDocumentsTab";
import ProjectUpdatesTab from "./ProjectUpdatesTab";
import ProjectStatusHistoryPanel from "./ProjectStatusHistoryPanel";

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
  createdAt?: string;
  _count?: { units: number };
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Active",    cls: "bg-emerald-100 text-emerald-700" },
  ON_HOLD:   { label: "On Hold",   cls: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  stage: string;
  budget?: number;
}

interface Deal {
  id: string;
  dealNumber: string;
  lead: { firstName: string; lastName: string };
  unit: { unitNumber: string };
  stage: string;
  salePrice: number;
}

interface Broker {
  id: string;
  name: string;
  commissionRate: number;
  _count?: { deals: number };
}

type Tab = "overview" | "leads" | "deals" | "brokers" | "units" | "documents" | "updates";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      axios.get(`/api/projects/${projectId}`),
      axios.get("/api/leads", { params: { page: 1, limit: 500 } }),
      axios.get("/api/deals", { params: { page: 1, limit: 500 } }),
      axios.get("/api/brokers/companies"),
    ])
      .then(([projRes, leadsRes, dealsRes, brokersRes]) => {
        setProject(projRes.data);
        // Filter leads for this project
        const allLeads = leadsRes.data.data || [];
        const projectLeads = allLeads.filter((l: any) => !l.projectId || l.projectId === projectId).slice(0, 100);
        setLeads(projectLeads);

        // Filter deals for this project
        const allDeals = dealsRes.data.data || [];
        const projectDeals = allDeals
          .filter((d: any) => d.unit?.projectId === projectId || !d.unit?.projectId)
          .slice(0, 100);
        setDeals(projectDeals);

        setBrokers(brokersRes.data || []);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          // Project doesn't exist, redirect to projects list
          navigate("/projects");
        } else {
          setError(err.response?.data?.error || "Failed to load project");
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error || !project)
    return (
      <div className="p-6">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
          ← Back to Projects
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">{error || "Project not found"}</p>
        </div>
      </div>
    );

  const days = daysUntil(project.handoverDate);
  const handoverColor = days < 0 ? "text-red-600" : days < 90 ? "text-amber-600" : "text-emerald-600";
  const statusCfg = STATUS_CONFIG[project.projectStatus] || STATUS_CONFIG.ACTIVE;

  const openEditModal = () => {
    setEditForm({
      name: project.name,
      location: project.location,
      description: project.description || "",
      totalUnits: String(project.totalUnits),
      totalFloors: project.totalFloors ? String(project.totalFloors) : "",
      projectStatus: project.projectStatus,
      handoverDate: project.handoverDate ? project.handoverDate.slice(0, 10) : "",
      launchDate: project.launchDate ? project.launchDate.slice(0, 10) : "",
      startDate: project.startDate ? project.startDate.slice(0, 10) : "",
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSubmitting(true);
    try {
      const res = await axios.patch(`/api/projects/${projectId}`, {
        name: editForm.name,
        location: editForm.location,
        description: editForm.description || undefined,
        totalUnits: parseInt(editForm.totalUnits),
        totalFloors: editForm.totalFloors ? parseInt(editForm.totalFloors) : undefined,
        projectStatus: editForm.projectStatus,
        handoverDate: editForm.handoverDate,
        launchDate: editForm.launchDate || undefined,
        startDate: editForm.startDate || undefined,
      });
      setProject(res.data);
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.response?.data?.error || "Failed to save project");
    } finally {
      setEditSubmitting(false);
    }
  };

  const dealCount = deals.length;
  const leadCount = leads.length;
  const brokerCount = brokers.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3">
          ← Back to Projects
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
            </div>
            <p className="text-slate-400 text-sm mt-1">{project.location}</p>
            {project.description && (
              <p className="text-slate-500 text-sm mt-1.5 max-w-xl">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openEditModal}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5"
            >
              ✎ Edit Project
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/settings`)}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              ⚙ Settings
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-6 gap-3 flex-shrink-0">
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Total Units</p>
          <p className="text-xl font-bold text-slate-800">{project.totalUnits}</p>
        </div>
        {project.totalFloors && (
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Total Floors</p>
            <p className="text-xl font-bold text-slate-800">{project.totalFloors}</p>
          </div>
        )}
        <div className={`bg-white rounded-lg p-3 border border-slate-100 ${project.totalFloors ? "" : "col-span-1"}`}>
          <p className="text-xs text-slate-500 mb-1">Handover</p>
          <p className={`font-semibold text-sm ${handoverColor}`}>{fmtDate(project.handoverDate)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{days < 0 ? `${Math.abs(days)} overdue` : `${days} left`}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Active Leads</p>
          <p className="text-xl font-bold text-blue-600">{leads.filter((l) => !["CLOSED_WON", "CLOSED_LOST"].includes(l.stage)).length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Total Deals</p>
          <p className="text-xl font-bold text-violet-600">{dealCount}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Broker Partners</p>
          <p className="text-xl font-bold text-amber-600">{brokerCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex gap-1 flex-shrink-0 overflow-x-auto">
        {(["overview", "leads", "deals", "brokers", "units", "documents", "updates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t === "overview"
              ? "Overview"
              : t === "leads"
                ? `Leads (${leadCount})`
                : t === "deals"
                  ? `Deals (${dealCount})`
                  : t === "brokers"
                    ? `Brokers (${brokerCount})`
                    : t === "units"
                      ? "Units"
                      : t === "documents"
                        ? "Documents"
                        : "Updates"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Project Information</h3>
                {project.description && (
                  <p className="text-sm text-slate-600 mb-4 pb-4 border-b border-slate-100">{project.description}</p>
                )}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-800">{project.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Units</span>
                    <span className="font-medium text-slate-800">{project.totalUnits}</span>
                  </div>
                  {project.totalFloors && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Floors</span>
                      <span className="font-medium text-slate-800">{project.totalFloors}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Handover Date</span>
                    <span className={`font-medium ${handoverColor}`}>{fmtDate(project.handoverDate)}</span>
                  </div>
                  {project.launchDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Launch Date</span>
                      <span className="font-medium text-slate-800">{fmtDate(project.launchDate)}</span>
                    </div>
                  )}
                  {project.startDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Start Date</span>
                      <span className="font-medium text-slate-800">{fmtDate(project.startDate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Created</span>
                    <span className="font-medium text-slate-800">{project.createdAt ? fmtDate(project.createdAt) : "—"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Status Summary</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-slate-600">Days to Handover</span>
                      <span className={`font-semibold ${handoverColor}`}>{days} days</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          days < 0
                            ? "bg-red-500"
                            : days < 90
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, 100 - (days / 730) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">Quick Stats</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 rounded p-2">
                        <p className="text-xs text-blue-600 font-semibold">{leads.length} Total Leads</p>
                      </div>
                      <div className="bg-violet-50 rounded p-2">
                        <p className="text-xs text-violet-600 font-semibold">{dealCount} Total Deals</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {projectId && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <ProjectStatusHistoryPanel projectId={projectId} />
              </div>
            )}
          </div>
        )}

        {/* Leads Tab */}
        {tab === "leads" && (
          <div className="p-6">
            {leads.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No leads found for this project</p>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Budget</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                        <td className="px-4 py-3 text-slate-600">{lead.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{lead.budget ? `AED ${lead.budget.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{lead.stage.replace(/_/g, " ")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Deals Tab */}
        {tab === "deals" && (
          <div className="p-6">
            {deals.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No deals found for this project</p>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Deal #</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Buyer</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Unit</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Sale Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{deal.dealNumber}</td>
                        <td className="px-4 py-3 text-slate-800">
                          {deal.lead.firstName} {deal.lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{deal.unit.unitNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">AED {deal.salePrice.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                            {deal.stage.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Brokers Tab */}
        {tab === "brokers" && (
          <div className="p-6">
            {brokers.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No brokers found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brokers.map((broker) => (
                  <div key={broker.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">{broker.name}</h4>
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">{broker.commissionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Associated Deals</span>
                      <span className="font-semibold text-slate-800">{broker._count?.deals || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Units Tab */}
        {tab === "units" && projectId && (
          <UnitsTable projectId={projectId} />
        )}

        {/* Documents Tab */}
        {tab === "documents" && projectId && (
          <ProjectDocumentsTab projectId={projectId} />
        )}

        {/* Updates Tab */}
        {tab === "updates" && projectId && (
          <ProjectUpdatesTab projectId={projectId} />
        )}
      </div>

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="font-bold text-slate-900">Edit Project</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <form id="project-edit-form" onSubmit={handleEditSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {[
                { label: "Project Name *", key: "name", required: true, placeholder: "e.g. Samha Tower" },
                { label: "Location *", key: "location", required: true, placeholder: "e.g. Dubai Marina" },
              ].map(({ label, key, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    required={required}
                    value={editForm[key] ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea rows={2} value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Units *</label>
                  <input required type="number" min="1" value={editForm.totalUnits ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalUnits: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Floors</label>
                  <input type="number" min="1" value={editForm.totalFloors ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalFloors: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select value={editForm.projectStatus ?? "ACTIVE"}
                    onChange={(e) => setEditForm((f) => ({ ...f, projectStatus: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Handover Date *</label>
                  <input required type="date" value={editForm.handoverDate ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, handoverDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              {editError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{editError}</p>
              )}
            </form>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">
                Cancel
              </button>
              <button form="project-edit-form" type="submit" disabled={editSubmitting}
                className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                {editSubmitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
