import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Phone, Handshake, RefreshCw, File, CreditCard, Pin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const TYPE_ICON: Record<string, LucideIcon> = {
  CALL: Phone, MEETING: Handshake, FOLLOW_UP: RefreshCw, DOCUMENT: File, PAYMENT: CreditCard,
};
const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info-soft text-primary",
  HIGH: "bg-warning-soft text-warning",
  URGENT: "bg-destructive-soft text-destructive",
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
      .catch((err) => {
        setTasks([]);
        toast.error(err?.response?.data?.error || "Failed to load tasks");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const complete = async (id: string) => {
    setCompletingId(id);
    try {
      await axios.patch(`/api/tasks/${id}/complete`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task completed");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to complete task");
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
      toast.success("Task rescheduled");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to reschedule task");
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
      toast.success("Task created");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create task");
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
    <div key={t.id} className={`flex items-start gap-3 px-5 py-3.5 hover:bg-muted/60 transition-colors group ${completingId === t.id ? "opacity-50" : ""}`}>
      <button
        onClick={() => complete(t.id)}
        disabled={completingId === t.id}
        className="w-5 h-5 rounded-full border-2 border-border hover:border-primary/40 hover:bg-info-soft flex-shrink-0 mt-0.5 transition-colors"
        title="Mark complete"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          {(() => {
            const Icon = TYPE_ICON[t.type] ?? Pin;
            return <Icon className="size-4 text-muted-foreground" />;
          })()}
          <p className="text-sm font-medium text-foreground leading-snug flex-1">{t.title}</p>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${PRIORITY_BADGE[t.priority]}`}>
            {t.priority}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {taskLabel(t) && (
            <button onClick={() => jumpTo(t)} className="text-xs text-primary hover:underline font-medium">
              {t.deal ? "Deal" : "Lead"}: {taskLabel(t)} ↗
            </button>
          )}
          <span className="text-xs text-muted-foreground">{fmtTime(t.dueDate)}</span>
          {reschedulingId === t.id ? (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="border border-border rounded px-1.5 py-0.5 text-xs bg-card focus:outline-none focus:border-ring"
              />
              <button onClick={() => reschedule(t.id)} className="text-xs text-primary font-semibold hover:underline">Save</button>
              <button onClick={() => { setReschedulingId(null); setNewDueDate(""); }} className="text-xs text-muted-foreground hover:underline">×</button>
            </span>
          ) : (
            <button
              onClick={() => { setReschedulingId(t.id); setNewDueDate(t.dueDate.slice(0, 10)); }}
              className="text-xs text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Reschedule
            </button>
          )}
        </div>
        {t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}
      </div>
    </div>
  );

  const Section = ({ title, tasks: sectionTasks, colorClass }: { title: string; tasks: Task[]; colorClass: string }) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className={`px-5 py-2.5 border-b border-border flex items-center justify-between ${colorClass}`}>
          <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
          <span className="text-xs font-semibold">{sectionTasks.length}</span>
        </div>
        <div className="divide-y divide-border">
          {sectionTasks.map(renderTask)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">My Tasks</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {overdue.length > 0 && <span className="text-destructive font-semibold">{overdue.length} overdue · </span>}
            {todayTasks.length} due today · {upcoming.length} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-card text-muted-foreground focus:outline-none"
          >
            <option value="ALL">All Types</option>
            {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g," ")}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-card text-muted-foreground focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            {["LOW","MEDIUM","HIGH","URGENT"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            + Add Task
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">New Task</h3>
          <input
            type="text"
            value={addForm.title}
            onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title *"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
              className="border border-border rounded-lg px-2 py-2 text-sm bg-muted/50 focus:outline-none">
              {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
            </select>
            <select value={addForm.priority} onChange={(e) => setAddForm((f) => ({ ...f, priority: e.target.value }))}
              className="border border-border rounded-lg px-2 py-2 text-sm bg-muted/50 focus:outline-none">
              {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="datetime-local" value={addForm.dueDate} onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="border border-border rounded-lg px-2 py-2 text-sm bg-muted/50 focus:outline-none" />
          </div>
          <textarea value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-2 text-xs bg-muted text-foreground rounded-lg hover:bg-muted">Cancel</button>
            <button
              onClick={addTask}
              disabled={!addForm.title.trim() || !addForm.dueDate || submitting}
              className="px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">No pending tasks</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Section title="Overdue" tasks={overdue} colorClass="text-destructive bg-destructive-soft" />
          <Section title="Due Today" tasks={todayTasks} colorClass="text-warning bg-warning-soft" />
          <Section title="This Week" tasks={upcoming} colorClass="text-muted-foreground bg-muted/50" />
        </div>
      )}
    </div>
  );
}
