import { useState, useEffect, useCallback } from "react";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  department?: string;
  createdAt: string;
  _count?: { assignedLeads: number };
}

const ROLES = ["ADMIN", "SALES_AGENT", "OPERATIONS", "FINANCE", "DEVELOPER"] as const;
type Role = typeof ROLES[number];

const ROLE_CONFIG: Record<Role, { label: string; badge: string; dot: string }> = {
  ADMIN:       { label: "Admin",       badge: "bg-red-100 text-red-700",      dot: "bg-red-500"    },
  SALES_AGENT: { label: "Sales Agent", badge: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"   },
  OPERATIONS:  { label: "Operations",  badge: "bg-orange-100 text-orange-700",dot: "bg-orange-500" },
  FINANCE:     { label: "Finance",     badge: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  DEVELOPER:   { label: "Developer",   badge: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// ─── User Form Modal ───────────────────────────────────────────────────────────

interface UserFormModalProps {
  user?: User;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ user, onClose, onSaved }: UserFormModalProps) {
  const isEdit = !!user;
  const [name,       setName]       = useState(user?.name       || "");
  const [email,      setEmail]      = useState(user?.email      || "");
  const [role,       setRole]       = useState<Role>((user?.role as Role) || "SALES_AGENT");
  const [phone,      setPhone]      = useState(user?.phone      || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  async function submit() {
    if (!name.trim() || (!isEdit && !email.trim())) {
      setError("Name and email are required"); return;
    }
    setError(""); setLoading(true);
    try {
      if (isEdit) {
        await axios.patch(`/api/users/${user!.id}`, { name, role, phone: phone || undefined, department: department || undefined });
      } else {
        await axios.post("/api/users", { name, email, role, phone: phone || undefined, department: department || undefined });
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">{isEdit ? "Edit Team Member" : "Add Team Member"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Al Mansoori"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. ahmed@samha.ae"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const cfg = ROLE_CONFIG[r];
                return (
                  <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    role === r ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-slate-300"
                  }`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="hidden" />
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-xs font-medium text-slate-700">{cfg.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Sales"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {!isEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700">
              The user will be added to the system. Send them their login credentials separately via your authentication provider.
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors">
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirmModal({ user, onClose, onDeleted }: { user: User; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function confirm() {
    setLoading(true);
    try {
      await axios.delete(`/api/users/${user.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete user");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-900 mb-2">Remove Team Member</h2>
        <p className="text-sm text-slate-600 mb-4">
          Are you sure you want to remove <strong>{user.name}</strong>? This cannot be undone and will unassign them from all leads and tasks.
        </p>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 mb-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={confirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors">
            {loading ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterRole,  setFilterRole]  = useState<Role | "ALL">("ALL");
  const [search,      setSearch]      = useState("");
  const [formModal,   setFormModal]   = useState<{ user?: User } | null>(null);
  const [deleteModal, setDeleteModal] = useState<User | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get("/api/users")
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    if (filterRole !== "ALL" && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Role counts for KPIs
  const roleCounts = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Team Management</h1>
          <p className="text-slate-400 text-xs mt-0.5">Manage team members, roles, and access</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
            Refresh
          </button>
          <button onClick={() => setFormModal({})}
            className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors">
            + Add Member
          </button>
        </div>
      </div>

      {/* Role KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ROLES.map((role) => {
          const cfg = ROLE_CONFIG[role];
          const isActive = filterRole === role;
          return (
            <button key={role} onClick={() => setFilterRole(isActive ? "ALL" : role)}
              className={`rounded-xl p-4 text-left border-2 bg-white transition-all ${
                isActive ? "border-slate-800 shadow-sm" : "border-transparent hover:border-slate-300"
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{roleCounts[role] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Search by name, email, department..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72" />
        {(filterRole !== "ALL" || search) && (
          <button onClick={() => { setFilterRole("ALL"); setSearch(""); }}
            className="text-xs text-slate-500 hover:text-slate-800 underline">
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No team members found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Member", "Role", "Department", "Phone", "Leads", "Joined", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((user) => {
                const cfg = ROLE_CONFIG[user.role as Role] || { label: user.role, badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${cfg.dot}`}>
                          {initials(user.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{user.department || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{user.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{user._count?.assignedLeads ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setFormModal({ user })}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
                          Edit
                        </button>
                        <button onClick={() => setDeleteModal(user)}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formModal !== null && (
        <UserFormModal
          user={formModal.user}
          onClose={() => setFormModal(null)}
          onSaved={() => { setFormModal(null); load(); }}
        />
      )}

      {deleteModal && (
        <DeleteConfirmModal
          user={deleteModal}
          onClose={() => setDeleteModal(null)}
          onDeleted={() => { setDeleteModal(null); load(); }}
        />
      )}
    </div>
  );
}
