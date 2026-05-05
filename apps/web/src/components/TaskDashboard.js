import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
const TYPE_ICON = {
    CALL: "📞", MEETING: "🤝", FOLLOW_UP: "🔁", DOCUMENT: "📄", PAYMENT: "💳",
};
const PRIORITY_BADGE = {
    LOW: "bg-slate-100 text-slate-500",
    MEDIUM: "bg-blue-100 text-blue-600",
    HIGH: "bg-amber-100 text-amber-700",
    URGENT: "bg-red-100 text-red-700",
};
function fmtTime(d) {
    return new Date(d).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" });
}
export default function TaskDashboard() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState("ALL");
    const [filterPriority, setFilterPriority] = useState("ALL");
    const [completingId, setCompletingId] = useState(null);
    const [reschedulingId, setReschedulingId] = useState(null);
    const [newDueDate, setNewDueDate] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ title: "", type: "FOLLOW_UP", priority: "MEDIUM", dueDate: "", notes: "" });
    const [submitting, setSubmitting] = useState(false);
    const loadTasks = useCallback(() => {
        setLoading(true);
        axios.get("/api/tasks", { params: { status: "PENDING", limit: 200 } })
            .then((r) => setTasks(r.data || []))
            .catch(() => setTasks([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { loadTasks(); }, [loadTasks]);
    const complete = async (id) => {
        setCompletingId(id);
        try {
            await axios.patch(`/api/tasks/${id}/complete`);
            setTasks((prev) => prev.filter((t) => t.id !== id));
        }
        catch {
            // silent
        }
        finally {
            setCompletingId(null);
        }
    };
    const reschedule = async (id) => {
        if (!newDueDate)
            return;
        try {
            await axios.patch(`/api/tasks/${id}`, { dueDate: new Date(newDueDate).toISOString() });
            setTasks((prev) => prev.map((t) => t.id === id ? { ...t, dueDate: new Date(newDueDate).toISOString() } : t));
            setReschedulingId(null);
            setNewDueDate("");
        }
        catch {
            // silent
        }
    };
    const addTask = async () => {
        if (!addForm.title.trim() || !addForm.dueDate)
            return;
        setSubmitting(true);
        try {
            const res = await axios.post("/api/tasks", {
                title: addForm.title,
                type: addForm.type,
                priority: addForm.priority,
                dueDate: new Date(addForm.dueDate).toISOString(),
                notes: addForm.notes || null,
            });
            setTasks((prev) => [...prev, res.data]);
            setAddForm({ title: "", type: "FOLLOW_UP", priority: "MEDIUM", dueDate: "", notes: "" });
            setShowAddForm(false);
        }
        catch {
            // silent
        }
        finally {
            setSubmitting(false);
        }
    };
    const filtered = tasks.filter((t) => {
        if (filterType !== "ALL" && t.type !== filterType)
            return false;
        if (filterPriority !== "ALL" && t.priority !== filterPriority)
            return false;
        return true;
    });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    const weekEnd = new Date(today.getTime() + 7 * 86400000);
    const overdue = filtered.filter((t) => new Date(t.dueDate) < today).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const todayTasks = filtered.filter((t) => { const d = new Date(t.dueDate); return d >= today && d < tomorrow; });
    const upcoming = filtered.filter((t) => { const d = new Date(t.dueDate); return d >= tomorrow && d < weekEnd; });
    const taskLabel = (t) => {
        if (t.lead)
            return `${t.lead.firstName} ${t.lead.lastName}`;
        if (t.deal)
            return t.deal.dealNumber;
        return "";
    };
    const jumpTo = (t) => {
        if (t.deal?.id)
            navigate(`/deals/${t.deal.id}`);
        else if (t.lead?.id)
            navigate(`/leads/${t.lead.id}`);
    };
    const renderTask = (t) => (_jsxs("div", { className: `flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group ${completingId === t.id ? "opacity-50" : ""}`, children: [_jsx("button", { onClick: () => complete(t.id), disabled: completingId === t.id, className: "w-5 h-5 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 flex-shrink-0 mt-0.5 transition-colors", title: "Mark complete" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start gap-2 flex-wrap", children: [_jsx("span", { className: "text-base leading-none", children: TYPE_ICON[t.type] || "📌" }), _jsx("p", { className: "text-sm font-medium text-slate-800 leading-snug flex-1", children: t.title }), _jsx("span", { className: `text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${PRIORITY_BADGE[t.priority]}`, children: t.priority })] }), _jsxs("div", { className: "flex items-center gap-3 mt-1.5 flex-wrap", children: [taskLabel(t) && (_jsxs("button", { onClick: () => jumpTo(t), className: "text-xs text-blue-600 hover:underline font-medium", children: [t.deal ? "Deal" : "Lead", ": ", taskLabel(t), " \u2197"] })), _jsx("span", { className: "text-xs text-slate-400", children: fmtTime(t.dueDate) }), reschedulingId === t.id ? (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "date", value: newDueDate, onChange: (e) => setNewDueDate(e.target.value), className: "border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-blue-400" }), _jsx("button", { onClick: () => reschedule(t.id), className: "text-xs text-blue-600 font-semibold hover:underline", children: "Save" }), _jsx("button", { onClick: () => { setReschedulingId(null); setNewDueDate(""); }, className: "text-xs text-slate-400 hover:underline", children: "\u00D7" })] })) : (_jsx("button", { onClick: () => { setReschedulingId(t.id); setNewDueDate(t.dueDate.slice(0, 10)); }, className: "text-xs text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity", children: "Reschedule" }))] }), t.notes && _jsx("p", { className: "text-xs text-slate-400 mt-1", children: t.notes })] })] }, t.id));
    const Section = ({ title, tasks: sectionTasks, colorClass }) => {
        if (sectionTasks.length === 0)
            return null;
        return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: `px-5 py-2.5 border-b border-slate-100 flex items-center justify-between ${colorClass}`, children: [_jsx("h3", { className: "text-xs font-bold uppercase tracking-wide", children: title }), _jsx("span", { className: "text-xs font-semibold", children: sectionTasks.length })] }), _jsx("div", { className: "divide-y divide-slate-50", children: sectionTasks.map(renderTask) })] }));
    };
    return (_jsxs("div", { className: "p-6 space-y-5 max-w-3xl", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "My Tasks" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [overdue.length > 0 && _jsxs("span", { className: "text-red-500 font-semibold", children: [overdue.length, " overdue \u00B7 "] }), todayTasks.length, " due today \u00B7 ", upcoming.length, " upcoming"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-600 focus:outline-none", children: [_jsx("option", { value: "ALL", children: "All Types" }), ["CALL", "MEETING", "FOLLOW_UP", "DOCUMENT", "PAYMENT"].map((t) => (_jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)))] }), _jsxs("select", { value: filterPriority, onChange: (e) => setFilterPriority(e.target.value), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-600 focus:outline-none", children: [_jsx("option", { value: "ALL", children: "All Priorities" }), ["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (_jsx("option", { value: p, children: p }, p)))] }), _jsx("button", { onClick: () => setShowAddForm((v) => !v), className: "px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors", children: "+ Add Task" })] })] }), showAddForm && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800", children: "New Task" }), _jsx("input", { type: "text", value: addForm.title, onChange: (e) => setAddForm((f) => ({ ...f, title: e.target.value })), placeholder: "Task title *", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx("select", { value: addForm.type, onChange: (e) => setAddForm((f) => ({ ...f, type: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 focus:outline-none", children: ["CALL", "MEETING", "FOLLOW_UP", "DOCUMENT", "PAYMENT"].map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)) }), _jsx("select", { value: addForm.priority, onChange: (e) => setAddForm((f) => ({ ...f, priority: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 focus:outline-none", children: ["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => _jsx("option", { value: p, children: p }, p)) }), _jsx("input", { type: "datetime-local", value: addForm.dueDate, onChange: (e) => setAddForm((f) => ({ ...f, dueDate: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 focus:outline-none" })] }), _jsx("textarea", { value: addForm.notes, onChange: (e) => setAddForm((f) => ({ ...f, notes: e.target.value })), placeholder: "Notes (optional)", rows: 2, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none resize-none" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setShowAddForm(false), className: "px-3 py-2 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200", children: "Cancel" }), _jsx("button", { onClick: addTask, disabled: !addForm.title.trim() || !addForm.dueDate || submitting, className: "px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: submitting ? "Creating…" : "Create Task" })] })] })), loading ? (_jsx("div", { className: "flex items-center justify-center h-40", children: _jsx("div", { className: "w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : filtered.length === 0 ? (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-12 text-center", children: _jsx("p", { className: "text-slate-400", children: "No pending tasks" }) })) : (_jsxs("div", { className: "space-y-4", children: [_jsx(Section, { title: "Overdue", tasks: overdue, colorClass: "text-red-700 bg-red-50" }), _jsx(Section, { title: "Due Today", tasks: todayTasks, colorClass: "text-amber-700 bg-amber-50" }), _jsx(Section, { title: "This Week", tasks: upcoming, colorClass: "text-slate-600 bg-slate-50" })] }))] }));
}
