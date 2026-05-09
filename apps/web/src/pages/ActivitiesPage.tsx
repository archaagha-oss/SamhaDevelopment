import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import Modal from "../components/Modal";
import { PageContainer, PageHeader } from "../components/layout";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string; name: string; email: string; role: string;
}

interface Task {
  kind: "task";
  id: string; title: string; type: string; priority: string; status: string;
  dueDate: string; notes?: string; completedAt?: string;
  assignedToId?: string;
  assignedTo?: { id: string; name: string };
  lead?: { id: string; firstName: string; lastName: string };
  deal?: { id: string; dealNumber: string };
}

interface Activity {
  kind: "activity";
  id: string; type: string; summary: string; outcome?: string;
  activityDate: string; followUpDate?: string;
  createdBy: string; callDuration?: number;
  lead?: { id: string; firstName: string; lastName: string };
  deal?: { id: string; dealNumber: string };
  unit?: { id: string; unitNumber: string };
}

type Item = Task | Activity;

// ─── Config ───────────────────────────────────────────────────────────────────

const TASK_TYPE_BADGES: Record<string, string> = {
  CALL:       "bg-info-soft text-primary",
  MEETING:    "bg-chart-7/15 text-chart-7",
  FOLLOW_UP:  "bg-warning-soft text-warning",
  DOCUMENT:   "bg-muted text-foreground",
  PAYMENT:    "bg-success-soft text-success",
};

const ACTIVITY_TYPE_BADGES: Record<string, string> = {
  CALL:        "bg-info-soft text-primary",
  EMAIL:       "bg-stage-active text-stage-active-foreground",
  WHATSAPP:    "bg-success-soft text-success",
  MEETING:     "bg-chart-7/15 text-chart-7",
  SITE_VISIT:  "bg-warning-soft text-warning",
  NOTE:        "bg-muted text-muted-foreground",
  STAGE_CHANGE:"bg-destructive-soft text-destructive",
};

const PRIORITY_BADGES: Record<string, string> = {
  LOW:    "bg-muted text-muted-foreground",
  MEDIUM: "bg-warning-soft text-warning",
  HIGH:   "bg-warning-soft text-warning",
  URGENT: "bg-destructive-soft text-destructive",
};

const TASK_TYPES = ["CALL", "MEETING", "FOLLOW_UP", "DOCUMENT", "PAYMENT"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const today   = () => isoDate(new Date());

function itemDate(item: Item) {
  return item.kind === "task" ? item.dueDate : item.activityDate;
}

function groupByDate(items: Item[]): Record<string, Item[]> {
  const groups: Record<string, Item[]> = {};
  items.forEach((item) => {
    const key = isoDate(new Date(itemDate(item)));
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff < -1) return `${fmtDate(dateStr)} (Overdue)`;
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `${d.toLocaleDateString("en-AE", { weekday: "long" })} · ${fmtDate(dateStr)}`;
  return fmtDate(dateStr);
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function TaskCard({ task, users, onComplete, onDelete, onReassign }: {
  task: Task;
  users: User[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onReassign: (id: string, userId: string) => void;
}) {
  const [reassigning, setReassigning] = useState(false);
  const isOverdue = task.status !== "COMPLETED" && new Date(task.dueDate) < new Date();

  return (
    <div className={`bg-card rounded-xl border p-4 flex items-start gap-3 group transition-all ${
      task.status === "COMPLETED" ? "border-border opacity-60" : isOverdue ? "border-destructive/30" : "border-border"
    }`}>
      <button
        onClick={() => onComplete(task.id)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          task.status === "COMPLETED" ? "bg-success border-success/30 text-white" : "border-border hover:border-success/30"
        }`}
      >
        {task.status === "COMPLETED" && <span className="text-[10px]">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${TASK_TYPE_BADGES[task.type] || "bg-muted text-muted-foreground"}`}>
            {task.type.replace(/_/g, " ")}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGES[task.priority]}`}>
            {task.priority}
          </span>
          {isOverdue && task.status !== "COMPLETED" && (
            <span className="text-[10px] font-semibold text-destructive">OVERDUE</span>
          )}
        </div>
        <p className={`text-sm font-medium ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
        {task.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.notes}</p>}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{fmtDate(task.dueDate)} {fmtTime(task.dueDate)}</span>
          {task.lead && (
            <span className="text-xs text-muted-foreground">Lead: {task.lead.firstName} {task.lead.lastName}</span>
          )}
          {task.deal && (
            <span className="text-xs text-muted-foreground">Deal: {task.deal.dealNumber}</span>
          )}

          {/* Assign user */}
          <div className="flex items-center gap-1">
            {reassigning ? (
              <select
                autoFocus
                onChange={(e) => { onReassign(task.id, e.target.value); setReassigning(false); }}
                onBlur={() => setReassigning(false)}
                defaultValue={task.assignedToId || ""}
                className="text-xs border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : (
              <button
                onClick={() => setReassigning(true)}
                className="text-xs text-primary hover:underline"
              >
                {task.assignedTo ? `@${task.assignedTo.name}` : "Assign"}
              </button>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-foreground/80 hover:text-destructive transition-all text-xs"
      >
        ✕
      </button>
    </div>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${ACTIVITY_TYPE_BADGES[activity.type] || "bg-muted text-muted-foreground"}`}>
              {activity.type.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted-foreground">{fmtDate(activity.activityDate)} {fmtTime(activity.activityDate)}</span>
            {activity.callDuration && (
              <span className="text-xs text-muted-foreground">{activity.callDuration}min</span>
            )}
          </div>
          <p className="text-sm text-foreground line-clamp-2">{activity.summary}</p>
          {activity.outcome && (
            <p className="text-xs text-muted-foreground mt-1 italic">{activity.outcome}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {activity.lead && (
              <span className="text-xs text-muted-foreground">Lead: {activity.lead.firstName} {activity.lead.lastName}</span>
            )}
            {activity.deal && (
              <span className="text-xs text-muted-foreground">Deal: {activity.deal.dealNumber}</span>
            )}
            {activity.unit && (
              <span className="text-xs text-muted-foreground">Unit: {activity.unit.unitNumber}</span>
            )}
            <span className="text-xs text-muted-foreground">by {activity.createdBy.split("@")[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function CalendarView({ items }: { items: Item[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const year  = month.getFullYear();
  const mon   = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, mon, 1).getDay(); // 0=Sun

  const grouped = groupByDate(items);
  const todayStr = today();

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const [selected, setSelected] = useState<string | null>(null);
  const selectedItems = selected ? (grouped[selected] || []) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-5 py-3">
        <button
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
          className="text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
        >
          ‹
        </button>
        <span className="font-semibold text-foreground">
          {month.toLocaleDateString("en-AE", { month: "long", year: "numeric" })}
        </span>
        <button
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
          className="text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
        >
          ›
        </button>
      </div>

      <div className="flex gap-4">
        {/* Grid */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="border-b border-r border-border h-24" />;
              const dateStr = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayItems = grouped[dateStr] || [];
              const isToday  = dateStr === todayStr;
              const isSel    = dateStr === selected;
              const tasks    = dayItems.filter((i) => i.kind === "task");
              const acts     = dayItems.filter((i) => i.kind === "activity");

              return (
                <div
                  key={day}
                  onClick={() => setSelected(isSel ? null : dateStr)}
                  className={`border-b border-r border-border h-24 p-1.5 cursor-pointer transition-colors ${
                    isSel ? "bg-info-soft" : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday ? "bg-primary text-white" : "text-muted-foreground"
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {tasks.slice(0, 2).map((t) => (
                      <div key={t.id} className={`text-[10px] px-1 py-0.5 rounded truncate font-medium ${
                        (t as Task).status === "COMPLETED" ? "bg-success-soft text-success" :
                        new Date(t.dueDate!) < new Date() ? "bg-destructive-soft text-destructive" :
                        "bg-warning-soft text-warning"
                      }`}>
                        {(t as Task).title}
                      </div>
                    ))}
                    {acts.slice(0, tasks.length >= 2 ? 0 : 2 - tasks.length).map((a) => (
                      <div key={a.id} className="text-[10px] px-1 py-0.5 rounded truncate bg-info-soft text-primary">
                        {(a as Activity).type}: {(a as Activity).summary.slice(0, 20)}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-card rounded-xl border border-border p-4 space-y-3 overflow-y-auto max-h-[600px]">
            <p className="text-sm font-semibold text-foreground">{fmtDate(selected)}</p>
            {selectedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No items on this day</p>
            ) : (
              selectedItems.map((item) => (
                <div key={item.id} className="border-l-2 pl-3 py-1 border-border">
                  <p className="text-xs font-medium text-foreground">
                    {item.kind === "task" ? (item as Task).title : `${item.type}: ${(item as Activity).summary.slice(0, 60)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {item.kind === "task" ? `Task · ${(item as Task).priority}` : `Activity`}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

function CreateTaskModal({ users, onClose, onCreated }: {
  users: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle]         = useState("");
  const [type, setType]           = useState("FOLLOW_UP");
  const [priority, setPriority]   = useState("MEDIUM");
  const [dueDate, setDueDate]     = useState(today() + "T09:00");
  const [notes, setNotes]         = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function submit() {
    if (!title.trim()) { setError("Title is required"); return; }
    setError(""); setLoading(true);
    try {
      await axios.post("/api/tasks", {
        title, type, priority, dueDate, notes: notes || undefined,
        assignedToId: assignedToId || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => { if (!loading) onClose(); }}
      title="Create Task"
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors">
            {loading ? "Creating..." : "Create Task"}
          </button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" autoFocus
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {TASK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Due Date *</label>
          <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Assign To</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {error && <div role="alert" className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">{error}</div>}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [view, setView]             = useState<"list" | "calendar">("list");
  const [filterUser, setFilterUser] = useState("ALL");
  const [filterKind, setFilterKind] = useState<"ALL" | "tasks" | "activities">("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const taskParams: any = { limit: 300 };
      if (filterUser !== "ALL") taskParams.assignedToId = filterUser;
      if (filterStatus !== "ALL") taskParams.status = filterStatus;
      if (filterType !== "ALL" && filterKind !== "activities") taskParams.type = filterType;

      const actParams: any = { limit: 300 };
      if (filterType !== "ALL" && filterKind !== "tasks") actParams.type = filterType;

      const [tRes, aRes, uRes] = await Promise.all([
        filterKind !== "activities" ? axios.get("/api/tasks", { params: taskParams }) : Promise.resolve({ data: [] }),
        filterKind !== "tasks"      ? axios.get("/api/activities", { params: actParams }) : Promise.resolve({ data: { data: [] } }),
        axios.get("/api/users"),
      ]);

      setTasks(((Array.isArray(tRes.data) ? tRes.data : []) as any[]).map((t: any) => ({ ...t, kind: "task" })));
      setActivities(((aRes.data.data || []) as any[]).map((a: any) => ({ ...a, kind: "activity" })));
      setUsers(Array.isArray(uRes.data) ? uRes.data : (uRes.data.data || []));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterKind, filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function completeTask(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "COMPLETED") {
      await axios.patch(`/api/tasks/${id}/reopen`);
    } else {
      await axios.patch(`/api/tasks/${id}/complete`);
    }
    load();
  }

  async function deleteTask(id: string) {
    await axios.delete(`/api/tasks/${id}`);
    load();
  }

  async function reassignTask(id: string, userId: string) {
    await axios.patch(`/api/tasks/${id}`, { assignedToId: userId || null });
    load();
  }

  // Combine and sort
  const allItems: Item[] = [
    ...tasks,
    ...activities,
  ].sort((a, b) => new Date(itemDate(a)).getTime() - new Date(itemDate(b)).getTime());

  // List view grouped
  const grouped = groupByDate(allItems);
  const sortedDates = Object.keys(grouped).sort();

  // Stats
  const pendingTasks   = tasks.filter((t) => t.status === "PENDING").length;
  const overdueTasks   = tasks.filter((t) => t.status === "PENDING" && new Date(t.dueDate) < new Date()).length;
  const todayItems     = grouped[today()]?.length ?? 0;
  const totalActivities = activities.length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Activities" }]}
        title="Activities & Tasks"
        subtitle="Unified view of all tasks and logged activities"
        actions={
          <>
            <Button variant="outline" onClick={load}>Refresh</Button>
            <Button onClick={() => setShowCreate(true)}>Create task</Button>
          </>
        }
      />

      <PageContainer padding="default" className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending Tasks",  value: pendingTasks,    color: "text-warning",   bg: "bg-warning-soft" },
          { label: "Overdue",        value: overdueTasks,    color: "text-destructive",     bg: "bg-destructive-soft"   },
          { label: "Due Today",      value: todayItems,      color: "text-primary",    bg: "bg-info-soft"  },
          { label: "Activities",     value: totalActivities, color: "text-muted-foreground",   bg: "bg-muted/50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 ${bg} border border-transparent`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex bg-muted rounded-lg p-0.5">
          {(["list", "calendar"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {v === "list" ? "☰ List" : "▦ Calendar"}
            </button>
          ))}
        </div>

        {/* Kind filter */}
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value as any)}
          className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="ALL">All Items</option>
          <option value="tasks">Tasks only</option>
          <option value="activities">Activities only</option>
        </select>

        {/* Type filter */}
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="ALL">All Types</option>
          {filterKind !== "activities" && TASK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          {filterKind !== "tasks" && ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>

        {/* Status filter (tasks only) */}
        {filterKind !== "activities" && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        )}

        {/* User filter */}
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="ALL">All Users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {(filterKind !== "ALL" || filterType !== "ALL" || filterStatus !== "ALL" || filterUser !== "ALL") && (
          <button onClick={() => { setFilterKind("ALL"); setFilterType("ALL"); setFilterStatus("ALL"); setFilterUser("ALL"); }}
            className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear filters
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{allItems.length} item{allItems.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading activities">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : view === "calendar" ? (
        <CalendarView items={allItems} />
      ) : (
        <div className="space-y-6">
          {sortedDates.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-16 px-6 text-center">
              <p className="text-3xl mb-3 opacity-50" aria-hidden="true">◷</p>
              <h3 className="text-sm font-semibold text-foreground mb-1">No items found</h3>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mx-auto">
                {filterKind !== "ALL" || filterType !== "ALL" || filterStatus !== "ALL" || filterUser !== "ALL"
                  ? "Try clearing your filters to see more results."
                  : "Calls, meetings, and tasks will appear here as activity is logged."}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Create Task
              </button>
            </div>
          ) : (
            sortedDates.map((date) => {
              const t = new Date(); t.setHours(0, 0, 0, 0);
              const d = new Date(date);
              const isOverdueGroup = d < t;
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isOverdueGroup ? "text-destructive" : "text-muted-foreground"}`}>
                      {dateLabel(date)}
                    </span>
                    <div className="flex-1 h-px bg-muted" />
                    <span className="text-xs text-muted-foreground">{grouped[date].length} item{grouped[date].length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {grouped[date].map((item) =>
                      item.kind === "task" ? (
                        <TaskCard
                          key={item.id}
                          task={item as Task}
                          users={users}
                          onComplete={completeTask}
                          onDelete={deleteTask}
                          onReassign={reassignTask}
                        />
                      ) : (
                        <ActivityCard key={item.id} activity={item as Activity} />
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showCreate && (
        <CreateTaskModal
          users={users}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
      </PageContainer>
    </div>
  );
}
