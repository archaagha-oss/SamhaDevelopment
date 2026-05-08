import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import UnitsTable from "./UnitsTable";
import ProjectDocumentsTab from "./ProjectDocumentsTab";
import ProjectUpdatesTab from "./ProjectUpdatesTab";
import ProjectStatusHistoryPanel from "./ProjectStatusHistoryPanel";
const STATUS_CONFIG = {
    ACTIVE: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
    ON_HOLD: { label: "On Hold", cls: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
    CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
const daysUntil = (d) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
export default function ProjectDetailPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState(null);
    const [leads, setLeads] = useState([]);
    const [deals, setDeals] = useState([]);
    const [brokers, setBrokers] = useState([]);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState(null);
    useEffect(() => {
        if (!projectId)
            return;
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
            const projectLeads = allLeads.filter((l) => !l.projectId || l.projectId === projectId).slice(0, 100);
            setLeads(projectLeads);
            // Filter deals for this project
            const allDeals = dealsRes.data.data || [];
            const projectDeals = allDeals
                .filter((d) => d.unit?.projectId === projectId || !d.unit?.projectId)
                .slice(0, 100);
            setDeals(projectDeals);
            setBrokers(brokersRes.data || []);
        })
            .catch((err) => {
            if (err.response?.status === 404) {
                // Project doesn't exist, redirect to projects list
                navigate("/projects");
            }
            else {
                setError(err.response?.data?.error || "Failed to load project");
            }
        })
            .finally(() => setLoading(false));
    }, [projectId, navigate]);
    if (loading)
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error || !project)
        return (_jsxs("div", { className: "p-6", children: [_jsx("button", { onClick: () => navigate("/projects"), className: "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4", children: "\u2190 Back to Projects" }), _jsx("div", { className: "bg-red-50 border border-red-200 rounded-xl p-6 text-center", children: _jsx("p", { className: "text-red-600 font-medium", children: error || "Project not found" }) })] }));
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
    const handleEditSubmit = async (e) => {
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
        }
        catch (err) {
            setEditError(err.response?.data?.error || "Failed to save project");
        }
        finally {
            setEditSubmitting(false);
        }
    };
    const dealCount = deals.length;
    const leadCount = leads.length;
    const brokerCount = brokers.length;
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsx("button", { onClick: () => navigate("/projects"), className: "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3", children: "\u2190 Back to Projects" }), _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h1", { className: "text-2xl font-bold text-slate-900", children: project.name }), _jsx("span", { className: `text-xs px-2.5 py-1 rounded-full font-semibold ${statusCfg.cls}`, children: statusCfg.label })] }), _jsx("p", { className: "text-slate-400 text-sm mt-1", children: project.location }), project.description && (_jsx("p", { className: "text-slate-500 text-sm mt-1.5 max-w-xl", children: project.description }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: openEditModal, className: "px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5", children: "\u270E Edit Project" }), _jsx("button", { onClick: () => navigate(`/projects/${projectId}/settings`), className: "px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5", children: "\u2699 Settings" })] })] })] }), _jsxs("div", { className: "px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-shrink-0", children: [_jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Total Units" }), _jsx("p", { className: "text-xl font-bold text-slate-800", children: project.totalUnits })] }), project.totalFloors && (_jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Total Floors" }), _jsx("p", { className: "text-xl font-bold text-slate-800", children: project.totalFloors })] })), _jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Handover" }), _jsx("p", { className: `font-semibold text-sm ${handoverColor}`, children: fmtDate(project.handoverDate) }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: days < 0 ? `${Math.abs(days)} overdue` : `${days} left` })] }), _jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Active Leads" }), _jsx("p", { className: "text-xl font-bold text-blue-600", children: leads.filter((l) => !["CLOSED_WON", "CLOSED_LOST"].includes(l.stage)).length })] }), _jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Total Deals" }), _jsx("p", { className: "text-xl font-bold text-violet-600", children: dealCount })] }), _jsxs("div", { className: "bg-white rounded-lg p-3 border border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Broker Partners" }), _jsx("p", { className: "text-xl font-bold text-amber-600", children: brokerCount })] })] }), _jsx("div", { className: "px-6 py-3 bg-white border-b border-slate-200 flex gap-1 flex-shrink-0 overflow-x-auto", children: ["overview", "leads", "deals", "brokers", "units", "documents", "updates"].map((t) => (_jsx("button", { onClick: () => setTab(t), className: `px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${tab === t
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: t === "overview"
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
                                            : "Updates" }, t))) }), _jsxs("div", { className: "flex-1 overflow-auto", children: [tab === "overview" && (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6", children: [_jsx("h3", { className: "font-semibold text-slate-900 mb-4", children: "Project Information" }), project.description && (_jsx("p", { className: "text-sm text-slate-600 mb-4 pb-4 border-b border-slate-100", children: project.description })), _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Status" }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-semibold ${statusCfg.cls}`, children: statusCfg.label })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Location" }), _jsx("span", { className: "font-medium text-slate-800", children: project.location })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Total Units" }), _jsx("span", { className: "font-medium text-slate-800", children: project.totalUnits })] }), project.totalFloors && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Total Floors" }), _jsx("span", { className: "font-medium text-slate-800", children: project.totalFloors })] })), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Handover Date" }), _jsx("span", { className: `font-medium ${handoverColor}`, children: fmtDate(project.handoverDate) })] }), project.launchDate && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Launch Date" }), _jsx("span", { className: "font-medium text-slate-800", children: fmtDate(project.launchDate) })] })), project.startDate && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Start Date" }), _jsx("span", { className: "font-medium text-slate-800", children: fmtDate(project.startDate) })] })), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Created" }), _jsx("span", { className: "font-medium text-slate-800", children: project.createdAt ? fmtDate(project.createdAt) : "—" })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6", children: [_jsx("h3", { className: "font-semibold text-slate-900 mb-4", children: "Status Summary" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsx("span", { className: "text-sm text-slate-600", children: "Days to Handover" }), _jsxs("span", { className: `font-semibold ${handoverColor}`, children: [days, " days"] })] }), _jsx("div", { className: "w-full h-2 bg-slate-200 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${days < 0
                                                                        ? "bg-red-500"
                                                                        : days < 90
                                                                            ? "bg-amber-500"
                                                                            : "bg-emerald-500"}`, style: { width: `${Math.min(100, Math.max(0, 100 - (days / 730) * 100))}%` } }) })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-2", children: "Quick Stats" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("div", { className: "bg-blue-50 rounded p-2", children: _jsxs("p", { className: "text-xs text-blue-600 font-semibold", children: [leads.length, " Total Leads"] }) }), _jsx("div", { className: "bg-violet-50 rounded p-2", children: _jsxs("p", { className: "text-xs text-violet-600 font-semibold", children: [dealCount, " Total Deals"] }) })] })] })] })] })] }), projectId && (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-6", children: _jsx(ProjectStatusHistoryPanel, { projectId: projectId }) }))] })), tab === "leads" && (_jsx("div", { className: "p-6", children: leads.length === 0 ? (_jsx("p", { className: "text-center text-slate-400 py-8", children: "No leads found for this project" })) : (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Name" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Phone" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Email" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Budget" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Stage" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: leads.map((lead) => (_jsxs("tr", { className: "hover:bg-slate-50 cursor-pointer", onClick: () => navigate(`/leads/${lead.id}`), children: [_jsxs("td", { className: "px-4 py-3 font-medium text-slate-800", children: [lead.firstName, " ", lead.lastName] }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: lead.phone }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: lead.email || "—" }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: lead.budget ? `AED ${lead.budget.toLocaleString()}` : "—" }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium", children: lead.stage.replace(/_/g, " ") }) })] }, lead.id))) })] }) })) })), tab === "deals" && (_jsx("div", { className: "p-6", children: deals.length === 0 ? (_jsx("p", { className: "text-center text-slate-400 py-8", children: "No deals found for this project" })) : (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Deal #" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Buyer" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Unit" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Sale Price" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-600", children: "Stage" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: deals.map((deal) => (_jsxs("tr", { className: "hover:bg-slate-50 cursor-pointer", onClick: () => navigate(`/deals/${deal.id}`), children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-slate-600", children: deal.dealNumber }), _jsxs("td", { className: "px-4 py-3 text-slate-800", children: [deal.lead.firstName, " ", deal.lead.lastName] }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: deal.unit.unitNumber }), _jsxs("td", { className: "px-4 py-3 font-medium text-slate-800", children: ["AED ", deal.salePrice.toLocaleString()] }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium", children: deal.stage.replace(/_/g, " ") }) })] }, deal.id))) })] }) })) })), tab === "brokers" && (_jsx("div", { className: "p-6", children: brokers.length === 0 ? (_jsx("p", { className: "text-center text-slate-400 py-8", children: "No brokers found" })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: brokers.map((broker) => (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsx("h4", { className: "font-semibold text-slate-900", children: broker.name }), _jsxs("span", { className: "px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium", children: [broker.commissionRate, "%"] })] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-slate-500", children: "Associated Deals" }), _jsx("span", { className: "font-semibold text-slate-800", children: broker._count?.deals || 0 })] })] }, broker.id))) })) })), tab === "units" && projectId && (_jsx(UnitsTable, { projectId: projectId })), tab === "documents" && projectId && (_jsx(ProjectDocumentsTab, { projectId: projectId })), tab === "updates" && projectId && (_jsx(ProjectUpdatesTab, { projectId: projectId }))] }), showEditModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsx("h2", { className: "font-bold text-slate-900", children: "Edit Project" }), _jsx("button", { onClick: () => setShowEditModal(false), className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { id: "project-edit-form", onSubmit: handleEditSubmit, className: "px-6 py-4 space-y-4 overflow-y-auto flex-1", children: [[
                                    { label: "Project Name *", key: "name", required: true, placeholder: "e.g. Samha Tower" },
                                    { label: "Location *", key: "location", required: true, placeholder: "e.g. Dubai Marina" },
                                ].map(({ label, key, required, placeholder }) => (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: label }), _jsx("input", { required: required, value: editForm[key] ?? "", onChange: (e) => setEditForm((f) => ({ ...f, [key]: e.target.value })), placeholder: placeholder, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }, key))), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Description" }), _jsx("textarea", { rows: 2, value: editForm.description ?? "", onChange: (e) => setEditForm((f) => ({ ...f, description: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Total Units *" }), _jsx("input", { required: true, type: "number", min: "1", value: editForm.totalUnits ?? "", onChange: (e) => setEditForm((f) => ({ ...f, totalUnits: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Total Floors" }), _jsx("input", { type: "number", min: "1", value: editForm.totalFloors ?? "", onChange: (e) => setEditForm((f) => ({ ...f, totalFloors: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Status" }), _jsxs("select", { value: editForm.projectStatus ?? "ACTIVE", onChange: (e) => setEditForm((f) => ({ ...f, projectStatus: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "ACTIVE", children: "Active" }), _jsx("option", { value: "ON_HOLD", children: "On Hold" }), _jsx("option", { value: "COMPLETED", children: "Completed" }), _jsx("option", { value: "CANCELLED", children: "Cancelled" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Handover Date *" }), _jsx("input", { required: true, type: "date", value: editForm.handoverDate ?? "", onChange: (e) => setEditForm((f) => ({ ...f, handoverDate: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] })] }), editError && (_jsx("p", { className: "text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg", children: editError }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0", children: [_jsx("button", { type: "button", onClick: () => setShowEditModal(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { form: "project-edit-form", type: "submit", disabled: editSubmitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: editSubmitting ? "Saving…" : "Save Changes" })] })] }) }))] }));
}
