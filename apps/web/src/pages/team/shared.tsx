// ─── Shared types ─────────────────────────────────────────────────────────────

export type Role    = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
export type Status  = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "DEACTIVATED";
export type EmpType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  status: Status;
  phone: string | null;
  avatarUrl: string | null;
  employeeId: string | null;
  employmentType: EmpType | null;
  joinedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  manager: { id: string; name: string; email: string } | null;
  _count?: { assignedLeads: number; reports: number };
}

// ─── Display config ───────────────────────────────────────────────────────────

export const ROLE_CFG: Record<Role, { label: string; chip: string; dot: string; description: string }> = {
  ADMIN:   { label: "Admin",   chip: "bg-destructive-soft text-destructive", dot: "bg-destructive", description: "Full system access" },
  MANAGER: { label: "Manager", chip: "bg-info-soft text-primary",            dot: "bg-primary",     description: "Team management + finance sign-off" },
  MEMBER:  { label: "Member",  chip: "bg-success-soft text-success",         dot: "bg-success",     description: "Standard team member access" },
  VIEWER:  { label: "Viewer",  chip: "bg-muted text-muted-foreground",       dot: "bg-neutral-400", description: "Read-only access" },
};

export const STATUS_CFG: Record<Status, { label: string; chip: string; dot: string }> = {
  ACTIVE:      { label: "Active",      chip: "bg-success-soft text-success",         dot: "bg-success" },
  ON_LEAVE:    { label: "On Leave",    chip: "bg-warning-soft text-warning",         dot: "bg-warning" },
  SUSPENDED:   { label: "Suspended",   chip: "bg-destructive-soft text-destructive", dot: "bg-destructive" },
  DEACTIVATED: { label: "Deactivated", chip: "bg-muted text-muted-foreground",       dot: "bg-neutral-400" },
};

export const EMP_LABEL: Record<EmpType, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT:  "Contract",
  INTERN:    "Intern",
};

// ─── Format helpers ───────────────────────────────────────────────────────────

export const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtRelative = (d: string | null) => {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" | "xl" }) {
  const px =
    size === "sm" ? "w-7 h-7 text-[10px]" :
    size === "lg" ? "w-16 h-16 text-lg"   :
    size === "xl" ? "w-20 h-20 text-xl"   :
                    "w-9 h-9 text-xs";
  if (url) return <img src={url} alt={name} className={`${px} rounded-full object-cover bg-muted`} />;
  const colors = ["bg-primary", "bg-success", "bg-warning", "bg-chart-7", "bg-destructive"];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={`${px} ${colors[idx]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ─── Form layout primitives ───────────────────────────────────────────────────

export const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}{required && " *"}</label>
      {children}
    </div>
  );
}

export function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function DetailRow({ label, value, mono }: { label: string; value?: string | null | number; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-sm text-foreground text-right ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</span>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

// MemberFormModal was removed in Phase B — see pages/MemberEditPage.tsx for
// the replacement (full detail page at /team/new and /team/:userId/edit).
