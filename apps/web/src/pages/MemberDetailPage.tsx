import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";
import { Button } from "../components/ui/button";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  Avatar, Member, Role, Status, EmpType,
  ROLE_CFG, STATUS_CFG, EMP_LABEL,
  fmtDate, fmtRelative,
  DetailGroup, DetailRow, Stat,
} from "./team/shared";

interface MemberDetail extends Member {
  reports?: Array<{
    id: string; name: string; email: string;
    jobTitle: string | null; status: Status; avatarUrl: string | null;
  }>;
  manager: { id: string; name: string; email: string; jobTitle: string | null } | null;
  _count?: { assignedLeads: number; assignedUnits?: number; tasks?: number; reports: number };
}

const teamCrumbs = [{ label: "Home", path: "/" }, { label: "Team", path: "/team" }];

export default function MemberDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [member,  setMember]  = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/users/${userId}`);
      setMember(res.data);
    } catch {
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function deactivate() {
    if (!member) return;
    setConfirmDeactivate(false);
    setActing(true);
    try {
      await axios.delete(`/api/users/${member.id}`);
      toast.success(`${member.name} deactivated`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to deactivate member");
    } finally {
      setActing(false);
    }
  }

  async function reactivate() {
    if (!member) return;
    setActing(true);
    try {
      await axios.patch(`/api/users/${member.id}`, { status: "ACTIVE" });
      toast.success(`${member.name} reactivated`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reactivate member");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <DetailPageLoading crumbs={teamCrumbs} title="Loading member…" />;

  if (!member) {
    return (
      <DetailPageNotFound
        crumbs={teamCrumbs}
        title="Member not found"
        message="This member could not be loaded. They may have been deleted."
        backLabel="Back to team"
        onBack={() => navigate("/team")}
      />
    );
  }

  const roleCfg   = ROLE_CFG[member.role as Role];
  const statusCfg = STATUS_CFG[member.status as Status];

  const crumbs = [
    ...teamCrumbs,
    ...(member.manager ? [{ label: member.manager.name, path: `/team/${member.manager.id}` }] : []),
    { label: member.name },
  ];

  return (
    <>
    <DetailPageLayout
      crumbs={crumbs}
      title={member.name}
      subtitle={member.jobTitle || "—"}
      actions={
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => navigate(`/team/${member.id}/edit`)}
          >
            Edit
          </Button>
          {member.status === "DEACTIVATED" ? (
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={reactivate}
              disabled={acting}
            >
              {acting ? "Reactivating…" : "Reactivate"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDeactivate(true)}
              disabled={acting}
            >
              {acting ? "Deactivating…" : "Deactivate"}
            </Button>
          )}
        </>
      }
      hero={
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-5 min-w-0">
            <Avatar name={member.name} url={member.avatarUrl} size="xl" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">{member.name}</h2>
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
        </div>
      }
      kpis={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Direct Reports" value={member._count?.reports        ?? 0} />
          <Stat label="Leads"          value={member._count?.assignedLeads  ?? 0} />
          <Stat label="Units"          value={member._count?.assignedUnits  ?? 0} />
          <Stat label="Tasks"          value={member._count?.tasks          ?? 0} />
        </div>
      }
      main={
        <>
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
                  <Link
                    to={`/team/${member.manager.id}`}
                    className="text-sm text-primary hover:underline text-right"
                  >
                    {member.manager.name}
                    {member.manager.jobTitle && (
                      <span className="text-xs text-muted-foreground"> · {member.manager.jobTitle}</span>
                    )}
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
              <DetailRow
                label="Employment Type"
                value={member.employmentType ? EMP_LABEL[member.employmentType as EmpType] : null}
              />
              <DetailRow label="Joined" value={fmtDate(member.joinedAt)} />
              <DetailRow label="Account Created" value={fmtDate(member.createdAt)} />
              <DetailRow label="Last Seen" value={fmtRelative(member.lastSeenAt)} />
            </DetailGroup>
          </div>
        </>
      }
      aside={
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Direct Reports {member._count?.reports ? `(${member._count.reports})` : ""}
          </h3>
          {member.reports && member.reports.length > 0 ? (
            <div className="space-y-2">
              {member.reports.map((r) => (
                <Link
                  key={r.id}
                  to={`/team/${r.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors"
                >
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
      }
    />
    <ConfirmDialog
      open={confirmDeactivate}
      title="Deactivate member?"
      message={`${member.name} will lose access to the CRM. Their assignments and history are preserved and they can be reactivated later.`}
      confirmLabel="Deactivate"
      cancelLabel="Keep active"
      variant="danger"
      onConfirm={deactivate}
      onCancel={() => setConfirmDeactivate(false)}
    />
    </>
  );
}
