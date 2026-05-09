import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Avatar, Member, Role, Status, EmpType,
  ROLE_CFG, STATUS_CFG, EMP_LABEL,
  fmtDate, fmtRelative,
  DetailGroup, DetailRow, Stat,
  MemberFormModal,
} from "./team/shared";

interface MemberDetail extends Member {
  reports?: Array<{
    id: string; name: string; email: string;
    jobTitle: string | null; status: Status; avatarUrl: string | null;
  }>;
  manager: { id: string; name: string; email: string; jobTitle: string | null } | null;
  _count?: { assignedLeads: number; assignedUnits?: number; tasks?: number; reports: number };
}

export default function MemberDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [member,     setMember]     = useState<MemberDetail | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editOpen,   setEditOpen]   = useState(false);
  const [acting,     setActing]     = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [detailRes, listRes] = await Promise.all([
        axios.get(`/api/users/${userId}`),
        axios.get("/api/users"),
      ]);
      setMember(detailRes.data);
      setAllMembers(Array.isArray(listRes.data) ? listRes.data : []);
    } catch {
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function deactivate() {
    if (!member) return;
    if (!confirm(`Deactivate ${member.name}? They will lose access but their data is preserved.`)) return;
    setActing(true);
    try {
      await axios.delete(`/api/users/${member.id}`);
      load();
    } finally {
      setActing(false);
    }
  }

  async function reactivate() {
    if (!member) return;
    setActing(true);
    try {
      await axios.patch(`/api/users/${member.id}`, { status: "ACTIVE" });
      load();
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-card rounded-xl border border-border flex items-center justify-center h-72">
          <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-card rounded-xl border border-border py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Member not found</p>
          <button onClick={() => navigate("/team")} className="text-xs text-primary hover:underline">
            ← Back to Team
          </button>
        </div>
      </div>
    );
  }

  const roleCfg   = ROLE_CFG[member.role as Role];
  const statusCfg = STATUS_CFG[member.status as Status];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/team" className="hover:text-foreground transition-colors">Team</Link>
        <span>/</span>
        {member.manager && (
          <>
            <Link to={`/team/${member.manager.id}`} className="hover:text-foreground transition-colors">
              {member.manager.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">{member.name}</span>
      </nav>

      {/* Hero header */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5 min-w-0 flex-1">
            <Avatar name={member.name} url={member.avatarUrl} size="xl" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">{member.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{member.jobTitle || "—"}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${roleCfg.chip}`}>
                  {roleCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
                {member.employeeId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {member.employeeId}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate("/team")}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
              ← Back
            </button>
            <button onClick={() => setEditOpen(true)}
              className="text-xs font-medium bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-2 transition-colors">
              Edit
            </button>
            {member.status === "DEACTIVATED" ? (
              <button onClick={reactivate} disabled={acting}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-success/30 bg-success-soft text-success hover:opacity-90 disabled:opacity-50 transition-colors">
                Reactivate
              </button>
            ) : (
              <button onClick={deactivate} disabled={acting}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-destructive/30 bg-destructive-soft text-destructive hover:opacity-90 disabled:opacity-50 transition-colors">
                Deactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workload KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Direct Reports" value={member._count?.reports        ?? 0} />
        <Stat label="Leads"          value={member._count?.assignedLeads  ?? 0} />
        <Stat label="Units"          value={member._count?.assignedUnits  ?? 0} />
        <Stat label="Tasks"          value={member._count?.tasks          ?? 0} />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: details */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <DetailGroup title="Identity">
              <DetailRow label="Email" value={member.email} mono />
              <DetailRow label="Phone" value={member.phone} />
              <DetailRow label="Employee ID" value={member.employeeId} mono />
            </DetailGroup>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <DetailGroup title="Position">
              <DetailRow label="Job Title" value={member.jobTitle} />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted-foreground">Reports To</span>
                {member.manager ? (
                  <Link to={`/team/${member.manager.id}`}
                    className="text-sm text-primary hover:underline text-right">
                    {member.manager.name} {member.manager.jobTitle && <span className="text-xs text-muted-foreground">· {member.manager.jobTitle}</span>}
                  </Link>
                ) : (
                  <span className="text-sm text-foreground">—</span>
                )}
              </div>
              <DetailRow label="Role" value={roleCfg.label} />
              <DetailRow label="Role Permissions" value={roleCfg.description} />
            </DetailGroup>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <DetailGroup title="Employment">
              <DetailRow label="Status" value={statusCfg.label} />
              <DetailRow label="Employment Type" value={member.employmentType ? EMP_LABEL[member.employmentType as EmpType] : null} />
              <DetailRow label="Joined" value={fmtDate(member.joinedAt)} />
              <DetailRow label="Account Created" value={fmtDate(member.createdAt)} />
              <DetailRow label="Last Seen" value={fmtRelative(member.lastSeenAt)} />
            </DetailGroup>
          </div>
        </div>

        {/* Right column: direct reports */}
        <div className="space-y-5">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Direct Reports {member._count?.reports ? `(${member._count.reports})` : ""}
            </h3>
            {member.reports && member.reports.length > 0 ? (
              <div className="space-y-2">
                {member.reports.map((r) => (
                  <Link key={r.id} to={`/team/${r.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                    <Avatar name={r.name} url={r.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.jobTitle || r.email}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CFG[r.status].chip}`}>
                      {STATUS_CFG[r.status].label}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No direct reports.</p>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <MemberFormModal
          member={member}
          allMembers={allMembers}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); load(); }}
        />
      )}
    </div>
  );
}
