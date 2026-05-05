import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  notes?: string;
  completedAt?: string;
  lead?: { id: string; firstName: string; lastName: string } | null;
  deal?: { id: string; dealNumber: string; lead?: { firstName: string; lastName: string } } | null;
  assignedTo?: { id: string; name: string } | null;
}

const TYPE_ICON: Record<string, string> = {
  CALL: "📞", MEETING: "🤝", FOLLOW_UP: "🔁", DOCUMENT: "📄", PAYMENT: "💳",
};
const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500",
  MEDIUM: "bg-blue-100 text-blue-600",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" });
}

export default function TaskDashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
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

  const complete = async (id: string) => {
    setCompletingId(id);
    try {
      await axios.patch(`/api/tasks/${id}/complete`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // silent
    } finally {
      setCompletingId(null);
    }
  };

  const reschedule = async (id: string) => {
    if (!newDueDate) return;
    try {
      await axios.patch(`/api/tasks/${id}`, { dueDate: new Date(newDueDate).toISOString() });
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, dueDate: new Date(newDueDate).toISOString() } : t));
      setReschedulingId(null);
      setNewDueDate("");
    } catch {
      // silent
    }
  };

  const addTask = async () => {
    if (!addForm.title.trim() || !addForm.dueDate) return;
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
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = tasks.filter((t) => {
    if (filterType !== "ALL" && t.type !== filterType) return false;
    if (filterPriority !== "ALL" && t.priority !== filterPriority) return false;
    return true;
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);

  const overdue = filtered.filter((t) => new Date(t.dueDate) < today).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const todayTasks = filtered.filter((t) => { const d = new Date(t.dueDate); return d >= today && d < tomorrow; });
  const upcoming = filtered.filter((t) => { const d = new Date(t.dueDate); return d >= tomorrow && d < weekEnd; });

  const taskLabel = (t: Task) => {
    if (t.lead) return `${t.lead.firstName} ${t.lead.lastName}`;
    if (t.deal) return t.deal.dealNumber;
    return "";
  };

  const jumpTo = (t: Task) => {
    if (t.deal?.id) navigate(`/deals/${t.deal.id}`);
    else if (t.lead?.id) navigate(`/leads/${t.lead.id}`);
  };

  const renderTask = (t: Task) => (
    <div key={t.id} className={`flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group ${completingId === t.id ? "opacity-50" : ""}`}>
      <button
        onClick={() => complete(t.id)}
        disabled={completingId === t.id}
        className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 flex-shrink-0 mt-0.5 transition-colors"
        title="Mark complete"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-base leading-none">{TYPE_ICON[t.type] || "📌"}</span>
          <p className="text-sm font-medium text-slate-800 leading-snug flex-1">{t.title}</p>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${PRIORITY_BADGE[t.priority]}`}>
            {t.priority}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {taskLabel(t) && (
            <button onClick={() => jumpTo(t)} className="text-xs text-blue-600 hover:underline font-medium">
              {t.deal ? "Deal" : "Lead"}: {taskLabel(t)} ↗
            </button>
          )}
          <span className="text-xs text-slate-400">{fmtTime(t.dueDate)}</span>
          {reschedulingId === t.id ? (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-blue-400"
              />
              <button onClick={() => reschedule(t.id)} className="text-xs text-blue-600 font-semibold hover:underline">Save</button>
              <button onClick={() => { setReschedulingId(null); setNewDueDate(""); }} className="text-xs text-slate-400 hover:underline">×</button>
            </span>
          ) : (
            <button
              onClick={() => { setReschedulingId(t.id); setNewDueDate(t.dueDate.slice(0, 10)); }}
              className="text-xs text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Reschedule
            </button>
          )}
        </div>
        {t.notes && <p className="text-xs text-slate-400 mt-1">{t.notes}</p>}
      </div>
    </div>
  );

  const Section = ({ title, tasks: sectionTasks, colorClass }: { title: string; tasks: Task[]; colorClass: string }) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className={`px-5 py-2.5 border-b border-slate-100 flex items-center justify-between ${colorClass}`}>
          <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
          <span className="text-xs font-semibold">{sectionTasks.length}</span>
        </div>
        <div className="divide-y divide-slate-50">
          {sectionTasks.map(renderTask)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {overdue.length > 0 && <span className="text-red-500 font-semibold">{overdue.length} overdue · </span>}
            {todayTasks.length} due today · {upcoming.length} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-600 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g," ")}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-600 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            {["LOW","MEDIUM","HIGH","URGENT"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Task
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">New Task</h3>
          <input
            type="text"
            value={addForm.title}
            onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
              className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 focus:outline-none">
              {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
            </select>
            <select value={addForm.priority} onChange={(e) => setAddForm((f) => ({ ...f, priority: e.target.value }))}
              className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 focus:outline-none">
              {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="datetime-local" value={addForm.dueDate} onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 focus:outline-none" />
          </div>
          <textarea value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-2 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Cancel</button>
            <button
              onClick={addTask}
              disabled={!addForm.title.trim() || !addForm.dueDate || submitting}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">No pending tasks</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Section title="Overdue" tasks={overdue} colorClass="text-red-700 bg-red-50" />
          <Section title="Due Today" tasks={todayTasks} colorClass="text-amber-700 bg-amber-50" />
          <Section title="This Week" tasks={upcoming} colorClass="text-slate-600 bg-slate-50" />
        </div>
      )}
    </div>
  );
}
