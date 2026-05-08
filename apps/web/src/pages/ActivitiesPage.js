import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import Modal from "../components/Modal";
// ─── Config ───────────────────────────────────────────────────────────────────
const TASK_TYPE_BADGES = {
    CALL: "bg-blue-100 text-blue-700",
    MEETING: "bg-purple-100 text-purple-700",
    FOLLOW_UP: "bg-amber-100 text-amber-700",
    DOCUMENT: "bg-slate-100 text-slate-700",
    PAYMENT: "bg-green-100 text-green-700",
};
const ACTIVITY_TYPE_BADGES = {
    CALL: "bg-blue-100 text-blue-700",
    EMAIL: "bg-indigo-100 text-indigo-700",
    WHATSAPP: "bg-emerald-100 text-emerald-700",
    MEETING: "bg-purple-100 text-purple-700",
    SITE_VISIT: "bg-orange-100 text-orange-700",
    NOTE: "bg-slate-100 text-slate-600",
    STAGE_CHANGE: "bg-rose-100 text-rose-700",
};
const PRIORITY_BADGES = {
    LOW: "bg-slate-100 text-slate-500",
    MEDIUM: "bg-amber-100 text-amber-600",
    HIGH: "bg-orange-100 text-orange-600",
    URGENT: "bg-red-100 text-red-700",
};
const TASK_TYPES = ["CALL", "MEETING", "FOLLOW_UP", "DOCUMENT", "PAYMENT"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"];
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" });
const isoDate = (d) => d.toISOString().slice(0, 10);
const today = () => isoDate(new Date());
function itemDate(item) {
    return item.kind === "task" ? item.dueDate : item.activityDate;
}
function groupByDate(items) {
    const groups = {};
    items.forEach((item) => {
        const key = isoDate(new Date(itemDate(item)));
        if (!groups[key])
            groups[key] = [];
        groups[key].push(item);
    });
    return groups;
}
function dateLabel(dateStr) {
    const d = new Date(dateStr);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
    if (diff < -1)
        return `${fmtDate(dateStr)} (Overdue)`;
    if (diff === -1)
        return "Yesterday";
    if (diff === 0)
        return "Today";
    if (diff === 1)
        return "Tomorrow";
    if (diff <= 7)
        return `${d.toLocaleDateString("en-AE", { weekday: "long" })} · ${fmtDate(dateStr)}`;
    return fmtDate(dateStr);
}
// ─── Subcomponents ────────────────────────────────────────────────────────────
function TaskCard({ task, users, onComplete, onDelete, onReassign }) {
    const [reassigning, setReassigning] = useState(false);
    const isOverdue = task.status !== "COMPLETED" && new Date(task.dueDate) < new Date();
    return (_jsxs("div", { className: `bg-white rounded-xl border p-4 flex items-start gap-3 group transition-all ${task.status === "COMPLETED" ? "border-slate-100 opacity-60" : isOverdue ? "border-red-200" : "border-slate-200"}`, children: [_jsx("button", { onClick: () => onComplete(task.id), className: `mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${task.status === "COMPLETED" ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400"}`, children: task.status === "COMPLETED" && _jsx("span", { className: "text-[10px]", children: "\u2713" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-1", children: [_jsx("span", { className: `text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${TASK_TYPE_BADGES[task.type] || "bg-slate-100 text-slate-600"}`, children: task.type.replace(/_/g, " ") }), _jsx("span", { className: `text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGES[task.priority]}`, children: task.priority }), isOverdue && task.status !== "COMPLETED" && (_jsx("span", { className: "text-[10px] font-semibold text-red-600", children: "OVERDUE" }))] }), _jsx("p", { className: `text-sm font-medium ${task.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-800"}`, children: task.title }), task.notes && _jsx("p", { className: "text-xs text-slate-400 mt-0.5 line-clamp-1", children: task.notes }), _jsxs("div", { className: "flex items-center gap-3 mt-2 flex-wrap", children: [_jsxs("span", { className: "text-xs text-slate-400", children: [fmtDate(task.dueDate), " ", fmtTime(task.dueDate)] }), task.lead && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Lead: ", task.lead.firstName, " ", task.lead.lastName] })), task.deal && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Deal: ", task.deal.dealNumber] })), _jsx("div", { className: "flex items-center gap-1", children: reassigning ? (_jsxs("select", { autoFocus: true, onChange: (e) => { onReassign(task.id, e.target.value); setReassigning(false); }, onBlur: () => setReassigning(false), defaultValue: task.assignedToId || "", className: "text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "Unassigned" }), users.map((u) => _jsx("option", { value: u.id, children: u.name }, u.id))] })) : (_jsx("button", { onClick: () => setReassigning(true), className: "text-xs text-blue-600 hover:underline", children: task.assignedTo ? `@${task.assignedTo.name}` : "Assign" })) })] })] }), _jsx("button", { onClick: () => onDelete(task.id), className: "opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all text-xs", children: "\u2715" })] }));
}
function ActivityCard({ activity }) {
    return (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: _jsx("div", { className: "flex items-start gap-3", children: _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-1", children: [_jsx("span", { className: `text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${ACTIVITY_TYPE_BADGES[activity.type] || "bg-slate-100 text-slate-600"}`, children: activity.type.replace(/_/g, " ") }), _jsxs("span", { className: "text-xs text-slate-400", children: [fmtDate(activity.activityDate), " ", fmtTime(activity.activityDate)] }), activity.callDuration && (_jsxs("span", { className: "text-xs text-slate-400", children: [activity.callDuration, "min"] }))] }), _jsx("p", { className: "text-sm text-slate-800 line-clamp-2", children: activity.summary }), activity.outcome && (_jsx("p", { className: "text-xs text-slate-500 mt-1 italic", children: activity.outcome })), _jsxs("div", { className: "flex items-center gap-3 mt-2 flex-wrap", children: [activity.lead && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Lead: ", activity.lead.firstName, " ", activity.lead.lastName] })), activity.deal && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Deal: ", activity.deal.dealNumber] })), activity.unit && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Unit: ", activity.unit.unitNumber] })), _jsxs("span", { className: "text-xs text-slate-400", children: ["by ", activity.createdBy.split("@")[0]] })] })] }) }) }));
}
// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ items }) {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });
    const year = month.getFullYear();
    const mon = month.getMonth();
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, mon, 1).getDay(); // 0=Sun
    const grouped = groupByDate(items);
    const todayStr = today();
    const cells = [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0)
        cells.push(null);
    const [selected, setSelected] = useState(null);
    const selectedItems = selected ? (grouped[selected] || []) : [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3", children: [_jsx("button", { onClick: () => setMonth(new Date(year, mon - 1, 1)), className: "text-slate-500 hover:text-slate-800 px-2 py-1 rounded transition-colors", children: "\u2039" }), _jsx("span", { className: "font-semibold text-slate-800", children: month.toLocaleDateString("en-AE", { month: "long", year: "numeric" }) }), _jsx("button", { onClick: () => setMonth(new Date(year, mon + 1, 1)), className: "text-slate-500 hover:text-slate-800 px-2 py-1 rounded transition-colors", children: "\u203A" })] }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("div", { className: "flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsx("div", { className: "grid grid-cols-7 border-b border-slate-100", children: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (_jsx("div", { className: "px-2 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide", children: d }, d))) }), _jsx("div", { className: "grid grid-cols-7", children: cells.map((day, idx) => {
                                    if (!day)
                                        return _jsx("div", { className: "border-b border-r border-slate-50 h-24" }, `empty-${idx}`);
                                    const dateStr = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                    const dayItems = grouped[dateStr] || [];
                                    const isToday = dateStr === todayStr;
                                    const isSel = dateStr === selected;
                                    const tasks = dayItems.filter((i) => i.kind === "task");
                                    const acts = dayItems.filter((i) => i.kind === "activity");
                                    return (_jsxs("div", { onClick: () => setSelected(isSel ? null : dateStr), className: `border-b border-r border-slate-50 h-24 p-1.5 cursor-pointer transition-colors ${isSel ? "bg-blue-50" : "hover:bg-slate-50"}`, children: [_jsx("div", { className: `text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-blue-600 text-white" : "text-slate-600"}`, children: day }), _jsxs("div", { className: "space-y-0.5 overflow-hidden", children: [tasks.slice(0, 2).map((t) => (_jsx("div", { className: `text-[10px] px-1 py-0.5 rounded truncate font-medium ${t.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" :
                                                            new Date(t.dueDate) < new Date() ? "bg-red-50 text-red-600" :
                                                                "bg-amber-50 text-amber-700"}`, children: t.title }, t.id))), acts.slice(0, tasks.length >= 2 ? 0 : 2 - tasks.length).map((a) => (_jsxs("div", { className: "text-[10px] px-1 py-0.5 rounded truncate bg-blue-50 text-blue-600", children: [a.type, ": ", a.summary.slice(0, 20)] }, a.id))), dayItems.length > 2 && (_jsxs("div", { className: "text-[10px] text-slate-400 px-1", children: ["+", dayItems.length - 2, " more"] }))] })] }, day));
                                }) })] }), selected && (_jsxs("div", { className: "w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-4 space-y-3 overflow-y-auto max-h-[600px]", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: fmtDate(selected) }), selectedItems.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400", children: "No items on this day" })) : (selectedItems.map((item) => (_jsxs("div", { className: "border-l-2 pl-3 py-1 border-slate-200", children: [_jsx("p", { className: "text-xs font-medium text-slate-700", children: item.kind === "task" ? item.title : `${item.type}: ${item.summary.slice(0, 60)}` }), _jsx("p", { className: "text-[10px] text-slate-400 mt-0.5", children: item.kind === "task" ? `Task · ${item.priority}` : `Activity` })] }, item.id))))] }))] })] }));
}
// ─── Create Task Modal ────────────────────────────────────────────────────────
function CreateTaskModal({ users, onClose, onCreated }) {
    const [title, setTitle] = useState("");
    const [type, setType] = useState("FOLLOW_UP");
    const [priority, setPriority] = useState("MEDIUM");
    const [dueDate, setDueDate] = useState(today() + "T09:00");
    const [notes, setNotes] = useState("");
    const [assignedToId, setAssignedToId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function submit() {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await axios.post("/api/tasks", {
                title, type, priority, dueDate, notes: notes || undefined,
                assignedToId: assignedToId || undefined,
            });
            onCreated();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to create task");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx(Modal, { open: true, onClose: () => { if (!loading)
            onClose(); }, title: "Create Task", size: "md", footer: _jsxs(_Fragment, { children: [_jsx("button", { onClick: onClose, disabled: loading, className: "px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50", children: "Cancel" }), _jsx("button", { onClick: submit, disabled: loading, className: "px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors", children: loading ? "Creating..." : "Create Task" })] }), children: _jsxs("div", { className: "px-6 py-5 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Title *" }), _jsx("input", { type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Task title", autoFocus: true, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Type" }), _jsx("select", { value: type, onChange: (e) => setType(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: TASK_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Priority" }), _jsx("select", { value: priority, onChange: (e) => setPriority(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: TASK_PRIORITIES.map((p) => _jsx("option", { value: p, children: p }, p)) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Due Date *" }), _jsx("input", { type: "datetime-local", value: dueDate, onChange: (e) => setDueDate(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Assign To" }), _jsxs("select", { value: assignedToId, onChange: (e) => setAssignedToId(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "Unassigned" }), users.map((u) => _jsxs("option", { value: u.id, children: [u.name, " (", u.role, ")"] }, u.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), rows: 2, placeholder: "Optional", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), error && _jsx("div", { role: "alert", className: "bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700", children: error })] }) }));
}
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivitiesPage() {
    const [tasks, setTasks] = useState([]);
    const [activities, setActivities] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    // Filters
    const [view, setView] = useState("list");
    const [filterUser, setFilterUser] = useState("ALL");
    const [filterKind, setFilterKind] = useState("ALL");
    const [filterType, setFilterType] = useState("ALL");
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [showCreate, setShowCreate] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const taskParams = { limit: 300 };
            if (filterUser !== "ALL")
                taskParams.assignedToId = filterUser;
            if (filterStatus !== "ALL")
                taskParams.status = filterStatus;
            if (filterType !== "ALL" && filterKind !== "activities")
                taskParams.type = filterType;
            const actParams = { limit: 300 };
            if (filterType !== "ALL" && filterKind !== "tasks")
                actParams.type = filterType;
            const [tRes, aRes, uRes] = await Promise.all([
                filterKind !== "activities" ? axios.get("/api/tasks", { params: taskParams }) : Promise.resolve({ data: [] }),
                filterKind !== "tasks" ? axios.get("/api/activities", { params: actParams }) : Promise.resolve({ data: { data: [] } }),
                axios.get("/api/users"),
            ]);
            setTasks((Array.isArray(tRes.data) ? tRes.data : []).map((t) => ({ ...t, kind: "task" })));
            setActivities((aRes.data.data || []).map((a) => ({ ...a, kind: "activity" })));
            setUsers(Array.isArray(uRes.data) ? uRes.data : (uRes.data.data || []));
        }
        catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.error || "Failed to load activities");
        }
        finally {
            setLoading(false);
        }
    }, [filterUser, filterKind, filterType, filterStatus]);
    useEffect(() => { load(); }, [load]);
    async function completeTask(id) {
        const t = tasks.find((x) => x.id === id);
        if (!t)
            return;
        if (t.status === "COMPLETED") {
            await axios.patch(`/api/tasks/${id}/reopen`);
        }
        else {
            await axios.patch(`/api/tasks/${id}/complete`);
        }
        load();
    }
    async function deleteTask(id) {
        await axios.delete(`/api/tasks/${id}`);
        load();
    }
    async function reassignTask(id, userId) {
        await axios.patch(`/api/tasks/${id}`, { assignedToId: userId || null });
        load();
    }
    // Combine and sort
    const allItems = [
        ...tasks,
        ...activities,
    ].sort((a, b) => new Date(itemDate(a)).getTime() - new Date(itemDate(b)).getTime());
    // List view grouped
    const grouped = groupByDate(allItems);
    const sortedDates = Object.keys(grouped).sort();
    // Stats
    const pendingTasks = tasks.filter((t) => t.status === "PENDING").length;
    const overdueTasks = tasks.filter((t) => t.status === "PENDING" && new Date(t.dueDate) < new Date()).length;
    const todayItems = grouped[today()]?.length ?? 0;
    const totalActivities = activities.length;
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Activities & Tasks" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Unified view of all tasks and logged activities" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: load, className: "text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors", children: "Refresh" }), _jsx("button", { onClick: () => setShowCreate(true), className: "text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors", children: "+ New Task" })] })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [
                    { label: "Pending Tasks", value: pendingTasks, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Overdue", value: overdueTasks, color: "text-red-600", bg: "bg-red-50" },
                    { label: "Due Today", value: todayItems, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Activities", value: totalActivities, color: "text-slate-600", bg: "bg-slate-50" },
                ].map(({ label, value, color, bg }) => (_jsxs("div", { className: `rounded-xl p-4 ${bg} border border-transparent`, children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1", children: label }), _jsx("p", { className: `text-2xl font-bold ${color}`, children: value })] }, label))) }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("div", { className: "flex bg-slate-100 rounded-lg p-0.5", children: ["list", "calendar"].map((v) => (_jsx("button", { onClick: () => setView(v), className: `px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${view === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: v === "list" ? "☰ List" : "▦ Calendar" }, v))) }), _jsxs("select", { value: filterKind, onChange: (e) => setFilterKind(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "ALL", children: "All Items" }), _jsx("option", { value: "tasks", children: "Tasks only" }), _jsx("option", { value: "activities", children: "Activities only" })] }), _jsxs("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "ALL", children: "All Types" }), filterKind !== "activities" && TASK_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)), filterKind !== "tasks" && ACTIVITY_TYPES.map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t))] }), filterKind !== "activities" && (_jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "ALL", children: "All Statuses" }), _jsx("option", { value: "PENDING", children: "Pending" }), _jsx("option", { value: "COMPLETED", children: "Completed" })] })), _jsxs("select", { value: filterUser, onChange: (e) => setFilterUser(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "ALL", children: "All Users" }), users.map((u) => _jsx("option", { value: u.id, children: u.name }, u.id))] }), (filterKind !== "ALL" || filterType !== "ALL" || filterStatus !== "ALL" || filterUser !== "ALL") && (_jsx("button", { onClick: () => { setFilterKind("ALL"); setFilterType("ALL"); setFilterStatus("ALL"); setFilterUser("ALL"); }, className: "text-xs text-slate-500 hover:text-slate-800 underline", children: "Clear filters" })), _jsxs("span", { className: "text-xs text-slate-400 ml-auto", children: [allItems.length, " item", allItems.length !== 1 ? "s" : ""] })] }), loading ? (_jsx("div", { className: "space-y-3", role: "status", "aria-busy": "true", "aria-label": "Loading activities", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-20" }, i))) })) : view === "calendar" ? (_jsx(CalendarView, { items: allItems })) : (_jsx("div", { className: "space-y-6", children: sortedDates.length === 0 ? (_jsxs("div", { className: "bg-white border border-slate-200 rounded-xl py-16 px-6 text-center", children: [_jsx("p", { className: "text-3xl mb-3 opacity-50", "aria-hidden": "true", children: "\u25F7" }), _jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-1", children: "No items found" }), _jsx("p", { className: "text-xs text-slate-400 max-w-xs leading-relaxed mx-auto", children: filterKind !== "ALL" || filterType !== "ALL" || filterStatus !== "ALL" || filterUser !== "ALL"
                                ? "Try clearing your filters to see more results."
                                : "Calls, meetings, and tasks will appear here as activity is logged." }), _jsx("button", { onClick: () => setShowCreate(true), className: "mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors", children: "+ Create Task" })] })) : (sortedDates.map((date) => {
                    const t = new Date();
                    t.setHours(0, 0, 0, 0);
                    const d = new Date(date);
                    const isOverdueGroup = d < t;
                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("span", { className: `text-xs font-semibold uppercase tracking-wide ${isOverdueGroup ? "text-red-600" : "text-slate-500"}`, children: dateLabel(date) }), _jsx("div", { className: "flex-1 h-px bg-slate-100" }), _jsxs("span", { className: "text-xs text-slate-400", children: [grouped[date].length, " item", grouped[date].length !== 1 ? "s" : ""] })] }), _jsx("div", { className: "space-y-2", children: grouped[date].map((item) => item.kind === "task" ? (_jsx(TaskCard, { task: item, users: users, onComplete: completeTask, onDelete: deleteTask, onReassign: reassignTask }, item.id)) : (_jsx(ActivityCard, { activity: item }, item.id))) })] }, date));
                })) })), showCreate && (_jsx(CreateTaskModal, { users: users, onClose: () => setShowCreate(false), onCreated: () => { setShowCreate(false); load(); } }))] }));
}
