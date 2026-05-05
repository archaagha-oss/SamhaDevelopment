import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
const BLANK = {
    name: "", location: "", description: "", totalUnits: "", totalFloors: "",
    projectStatus: "ACTIVE", handoverDate: "", launchDate: "", startDate: "",
};
const STATUS_CONFIG = {
    ACTIVE: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
    ON_HOLD: { label: "On Hold", cls: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
    CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
const daysUntil = (d) => {
    const diff = new Date(d).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
export default function ProjectsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editProject, setEditProject] = useState(null);
    const [form, setForm] = useState(BLANK);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [cloning, setCloning] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const load = () => {
        setLoading(true);
        axios.get("/api/projects")
            .then((r) => setProjects(r.data.data || r.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    const openCreate = () => {
        setEditProject(null);
        setForm(BLANK);
        setFormError(null);
        setShowForm(true);
    };
    const openEdit = (p) => {
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
    const handleSubmit = async (e) => {
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
            }
            else {
                await axios.post("/api/projects", payload);
            }
            setShowForm(false);
            load();
        }
        catch (err) {
            setFormError(err.response?.data?.error || "Failed to save project");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleDelete = (p, e) => {
        e.stopPropagation();
        setConfirmDeleteProject(p);
    };
    const doDeleteProject = async () => {
        const p = confirmDeleteProject;
        if (!p)
            return;
        setConfirmDeleteProject(null);
        setDeleting(p.id);
        try {
            await axios.delete(`/api/projects/${p.id}`);
            load();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to delete project");
        }
        finally {
            setDeleting(null);
        }
    };
    const handleClone = async (p, e) => {
        e.stopPropagation();
        if (cloning)
            return;
        setCloning(p.id);
        try {
            await axios.post(`/api/projects/${p.id}/clone`, { includeUnits: false });
            load();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to clone project");
        }
        finally {
            setCloning(null);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Projects" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [projects.length, " project", projects.length !== 1 ? "s" : ""] })] }), _jsxs("button", { onClick: openCreate, className: "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5", children: [_jsx("span", { className: "text-base leading-none", children: "+" }), " New Project"] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "text", placeholder: "Search projects\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-blue-400 bg-slate-50" }), _jsx("div", { className: "flex gap-1", children: ["", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => (_jsx("button", { onClick: () => setStatusFilter(s), className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: s === "" ? "All" : STATUS_CONFIG[s]?.label || s }, s))) })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-6", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : projects.length === 0 ? (_jsx(EmptyState, { icon: "\u2295", title: "No projects yet", description: "Create your first project to start adding units and tracking deals.", action: { label: "Create Project", onClick: openCreate } })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: projects.filter((p) => {
                        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase());
                        const matchStatus = !statusFilter || p.projectStatus === statusFilter;
                        return matchSearch && matchStatus;
                    }).map((p) => {
                        const days = daysUntil(p.handoverDate);
                        const handoverColor = days < 0 ? "text-red-600" : days < 90 ? "text-amber-600" : "text-emerald-600";
                        const statusCfg = STATUS_CONFIG[p.projectStatus] || STATUS_CONFIG.ACTIVE;
                        return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group", onClick: () => navigate(`/projects/${p.id}`), children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h2", { className: "font-bold text-slate-900 group-hover:text-blue-600 transition-colors", children: p.name }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusCfg.cls}`, children: statusCfg.label })] }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: p.location }), p.description && (_jsx("p", { className: "text-xs text-slate-500 mt-1 line-clamp-2", children: p.description }))] }), _jsxs("div", { className: "flex items-center gap-1 ml-2 shrink-0", children: [_jsx("button", { onClick: (e) => handleClone(p, e), disabled: cloning === p.id, className: "text-slate-300 hover:text-slate-600 text-xs p-1 rounded transition-colors disabled:opacity-40", title: "Clone project", children: cloning === p.id ? "…" : "⊕" }), _jsx("button", { onClick: (e) => { e.stopPropagation(); openEdit(p); }, className: "text-slate-300 hover:text-slate-600 text-sm p-1 rounded transition-colors", title: "Edit project", children: "\u270E" }), _jsx("button", { onClick: (e) => handleDelete(p, e), disabled: deleting === p.id, className: "text-slate-300 hover:text-red-500 text-sm p-1 rounded transition-colors disabled:opacity-40", title: "Delete project", children: deleting === p.id ? "…" : "✕" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { className: "bg-slate-50 rounded-lg p-3", children: [_jsxs("p", { className: "text-xs text-slate-400 mb-0.5", children: ["Total Units", p.totalFloors ? ` · ${p.totalFloors}F` : ""] }), _jsx("p", { className: "font-bold text-slate-800 text-lg", children: p.totalUnits })] }), _jsxs("div", { className: "bg-slate-50 rounded-lg p-3", children: [_jsx("p", { className: "text-xs text-slate-400 mb-0.5", children: "Handover" }), _jsx("p", { className: `font-bold text-sm ${handoverColor}`, children: fmtDate(p.handoverDate) }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left` })] })] }), _jsx("div", { className: "mt-3 pt-3 border-t border-slate-100", children: _jsx("p", { className: "text-xs text-blue-600 font-medium group-hover:underline", children: "View details \u2192" }) })] }, p.id));
                    }) })) }), showForm && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0", children: [_jsx("h2", { className: "font-bold text-slate-900", children: editProject ? "Edit Project" : "New Project" }), _jsx("button", { onClick: () => setShowForm(false), className: "text-slate-400 hover:text-slate-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "px-6 py-4 space-y-4 overflow-y-auto", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Project Name *" }), _jsx("input", { required: true, value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "e.g. Samha Tower", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Location *" }), _jsx("input", { required: true, value: form.location, onChange: (e) => setForm({ ...form, location: e.target.value }), placeholder: "e.g. Dubai Marina", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Description" }), _jsx("textarea", { rows: 2, value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }), placeholder: "Brief description, highlights, amenities\u2026", className: `${inp} resize-none` })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Total Units *" }), _jsx("input", { required: true, type: "number", min: "1", value: form.totalUnits, onChange: (e) => setForm({ ...form, totalUnits: e.target.value }), placeholder: "e.g. 173", className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Total Floors" }), _jsx("input", { type: "number", min: "1", value: form.totalFloors, onChange: (e) => setForm({ ...form, totalFloors: e.target.value }), placeholder: "e.g. 25", className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Project Status" }), _jsxs("select", { value: form.projectStatus, onChange: (e) => setForm({ ...form, projectStatus: e.target.value }), className: inp, children: [_jsx("option", { value: "ACTIVE", children: "Active" }), _jsx("option", { value: "ON_HOLD", children: "On Hold" }), _jsx("option", { value: "COMPLETED", children: "Completed" }), _jsx("option", { value: "CANCELLED", children: "Cancelled" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Handover Date *" }), _jsx("input", { required: true, type: "date", value: form.handoverDate, onChange: (e) => setForm({ ...form, handoverDate: e.target.value }), className: inp })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Launch Date" }), _jsx("input", { type: "date", value: form.launchDate, onChange: (e) => setForm({ ...form, launchDate: e.target.value }), className: inp })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Start Date" }), _jsx("input", { type: "date", value: form.startDate, onChange: (e) => setForm({ ...form, startDate: e.target.value }), className: inp })] })] }), formError && _jsx("p", { className: "text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg", children: formError }), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsx("button", { type: "button", onClick: () => setShowForm(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: submitting ? "Saving…" : editProject ? "Save Changes" : "Create Project" })] })] })] }) })), _jsx(ConfirmDialog, { open: !!confirmDeleteProject, title: "Delete Project", message: `Delete "${confirmDeleteProject?.name}"? This cannot be undone and will fail if the project has units with active deals.`, confirmLabel: "Delete", variant: "danger", onConfirm: doDeleteProject, onCancel: () => setConfirmDeleteProject(null) })] }));
}
