import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Member, Role, Status,
  ROLE_CFG, STATUS_CFG,
  fmtRelative,
  Avatar, inputCls,
  MemberFormModal,
} from "./team/shared";

export default function TeamPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search,       setSearch]       = useState("");
  const [filterRole,   setFilterRole]   = useState<Role | "">("");
  const [filterStatus, setFilterStatus] = useState<Status | "">("");

  // Add member modal
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get("/api/users");
      setMembers(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered people ──
  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (filterRole && m.role !== filterRole) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !m.email.toLowerCase().includes(q) &&
          !(m.jobTitle || "").toLowerCase().includes(q) &&
          !(m.employeeId || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [members, search, filterRole, filterStatus]);

  // ── KPIs ──
  const kpi = useMemo(() => {
    return {
      active:      members.filter((m) => m.status === "ACTIVE").length,
      managers:    members.filter((m) => m.role === "MANAGER" || m.role === "ADMIN").length,
      onLeave:     members.filter((m) => m.status === "ON_LEAVE").length,
      deactivated: members.filter((m) => m.status === "DEACTIVATED").length,
    };
  }, [members]);

  const hasFilter = !!(filterRole || filterStatus || search);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Team Management</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Manage members, roles, and reporting structure</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
            Refresh
          </button>
          <button onClick={() => setAddOpen(true)}
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-2 transition-colors">
            + Add Member
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Active Members" value={kpi.active}      accent="success" />
        <KpiCard label="Managers"       value={kpi.managers}    accent="primary" />
        <KpiCard label="On Leave"       value={kpi.onLeave}     accent="warning" />
        <KpiCard label="Deactivated"    value={kpi.deactivated} accent="muted" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" placeholder="Search name, email, title, ID..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} w-72`} />
        <select value={filterRole} onChange={(e) => setFilterRole((e.target.value || "") as Role | "")} className={`${inputCls} w-32`}>
          <option value="">All roles</option>
          {(Object.keys(ROLE_CFG) as Role[]).map((r) => <option key={r} value={r}>{ROLE_CFG[r].label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus((e.target.value || "") as Status | "")} className={`${inputCls} w-32`}>
          <option value="">All status</option>
          {(Object.keys(STATUS_CFG) as Status[]).map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
        </select>
        {hasFilter && (
          <button onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {members.length}</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {hasFilter ? "No members match your filters" : "No team members yet"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Member", "Job Title", "Manager", "Role", "Status", "Employee ID", "Last Active"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => {
                  const roleCfg   = ROLE_CFG[m.role];
                  const statusCfg = STATUS_CFG[m.status];
                  return (
                    <tr key={m.id} onClick={() => navigate(`/team/${m.id}`)}
                      className="hover:bg-muted/60 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name} url={m.avatarUrl} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{m.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{m.jobTitle || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.manager?.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${roleCfg.chip}`}>
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{m.employeeId || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtRelative(m.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <MemberFormModal
          allMembers={members}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Page-only sub-components ─────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: number; accent: "primary" | "success" | "warning" | "muted" }) {
  const dot = accent === "primary" ? "bg-primary" : accent === "success" ? "bg-success" : accent === "warning" ? "bg-warning" : "bg-neutral-400";
  return (
    <div className="rounded-xl p-4 bg-card border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
