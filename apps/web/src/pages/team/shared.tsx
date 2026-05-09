import { useMemo, useState } from "react";
import axios from "axios";

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
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Member Form Modal ────────────────────────────────────────────────────────

interface MemberFormProps {
  member?: Member;
  allMembers: Member[];
  onClose: () => void;
  onSaved: () => void;
}

export function MemberFormModal({ member, allMembers, onClose, onSaved }: MemberFormProps) {
  const isEdit = !!member;
  const [name,           setName]           = useState(member?.name           || "");
  const [email,          setEmail]          = useState(member?.email          || "");
  const [phone,          setPhone]          = useState(member?.phone          || "");
  const [avatarUrl,      setAvatarUrl]      = useState(member?.avatarUrl      || "");
  const [jobTitle,       setJobTitle]       = useState(member?.jobTitle       || "");
  const [managerId,      setManagerId]      = useState(member?.manager?.id    || "");
  const [role,           setRole]           = useState<Role>(member?.role     || "MEMBER");
  const [status,         setStatus]         = useState<Status>(member?.status || "ACTIVE");
  const [employeeId,     setEmployeeId]     = useState(member?.employeeId     || "");
  const [employmentType, setEmploymentType] = useState<EmpType | "">(member?.employmentType || "");
  const [joinedAt,       setJoinedAt]       = useState(member?.joinedAt ? member.joinedAt.slice(0, 10) : "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const managerCandidates = useMemo(
    () => allMembers.filter((u) => u.id !== member?.id && u.status !== "DEACTIVATED"),
    [allMembers, member?.id],
  );

  async function submit() {
    if (!name.trim() || (!isEdit && !email.trim())) {
      setError("Name and email are required"); return;
    }
    setError(""); setLoading(true);

    const payload: any = {
      name,
      role,
      status,
      phone:          phone          || null,
      avatarUrl:      avatarUrl      || null,
      jobTitle:       jobTitle       || null,
      managerId:      managerId      || null,
      employeeId:     employeeId     || null,
      employmentType: employmentType || null,
      joinedAt:       joinedAt       || null,
    };

    try {
      if (isEdit) {
        await axios.patch(`/api/users/${member!.id}`, payload);
      } else {
        await axios.post("/api/users", { ...payload, email });
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">{isEdit ? "Edit member" : "Create member"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Identity */}
          <Section title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Al Mansoori" className={inputCls} />
              </Field>
              <Field label="Email" required={!isEdit}>
                <input type="email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sara@samha.ae"
                  className={`${inputCls} ${isEdit ? "bg-muted/50 text-muted-foreground" : ""}`} />
              </Field>
              <Field label="Phone">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000" className={inputCls} />
              </Field>
              <Field label="Avatar URL">
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* Position */}
          <Section title="Position">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Job Title">
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Sales Agent" className={inputCls} />
              </Field>
              <Field label="Reports To (Manager)">
                <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputCls}>
                  <option value="">— None —</option>
                  {managerCandidates.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} {u.jobTitle ? `· ${u.jobTitle}` : ""}</option>
                  ))}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="Role" required>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(ROLE_CFG) as Role[]).map((r) => {
                      const cfg = ROLE_CFG[r];
                      return (
                        <label key={r} title={cfg.description}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                            role === r ? "border-primary/40 bg-info-soft" : "border-border hover:border-border"
                          }`}>
                          <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="hidden" />
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="text-xs font-medium text-foreground">{cfg.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{ROLE_CFG[role].description}</p>
                </Field>
              </div>
            </div>
          </Section>

          {/* Employment */}
          <Section title="Employment">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>
                  {(Object.keys(STATUS_CFG) as Status[]).map((s) => (
                    <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Employment Type">
                <select value={employmentType} onChange={(e) => setEmploymentType((e.target.value || "") as EmpType | "")} className={inputCls}>
                  <option value="">— None —</option>
                  {(Object.keys(EMP_LABEL) as EmpType[]).map((t) => (
                    <option key={t} value={t}>{EMP_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Employee ID">
                <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" className={inputCls} />
              </Field>
              <Field label="Joined Date">
                <input type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>

          {!isEdit && (
            <div className="bg-warning-soft border border-warning/30 rounded-lg px-4 py-2.5 text-xs text-warning">
              The user will be added to the system. Send them their login credentials separately via your authentication provider.
            </div>
          )}

          {error && <div className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors">
            {loading ? "Saving..." : isEdit ? "Save changes" : "Create member"}
          </button>
        </div>
      </div>
    </div>
  );
}
