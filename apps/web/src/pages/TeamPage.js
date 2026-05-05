import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
const ROLES = ["ADMIN", "SALES_AGENT", "OPERATIONS", "FINANCE", "DEVELOPER"];
const ROLE_CONFIG = {
    ADMIN: { label: "Admin", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
    SALES_AGENT: { label: "Sales Agent", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
    OPERATIONS: { label: "Operations", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
    FINANCE: { label: "Finance", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
    DEVELOPER: { label: "Developer", badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
function initials(name) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function UserFormModal({ user, onClose, onSaved }) {
    const isEdit = !!user;
    const [name, setName] = useState(user?.name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [role, setRole] = useState(user?.role || "SALES_AGENT");
    const [phone, setPhone] = useState(user?.phone || "");
    const [department, setDepartment] = useState(user?.department || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function submit() {
        if (!name.trim() || (!isEdit && !email.trim())) {
            setError("Name and email are required");
            return;
        }
        setError("");
        setLoading(true);
        try {
            if (isEdit) {
                await axios.patch(`/api/users/${user.id}`, { name, role, phone: phone || undefined, department: department || undefined });
            }
            else {
                await axios.post("/api/users", { name, email, role, phone: phone || undefined, department: department || undefined });
            }
            onSaved();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to save user");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl w-full max-w-md", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsx("h2", { className: "font-semibold text-slate-900 text-sm", children: isEdit ? "Edit Team Member" : "Add Team Member" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-lg leading-none", children: "\u2715" })] }), _jsxs("div", { className: "px-6 py-5 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Full Name *" }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. Ahmed Al Mansoori", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), !isEdit && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Email *" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "e.g. ahmed@samha.ae", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Role *" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: ROLES.map((r) => {
                                        const cfg = ROLE_CONFIG[r];
                                        return (_jsxs("label", { className: `flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${role === r ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-slate-300"}`, children: [_jsx("input", { type: "radio", name: "role", value: r, checked: role === r, onChange: () => setRole(r), className: "hidden" }), _jsx("span", { className: `w-2 h-2 rounded-full ${cfg.dot}` }), _jsx("span", { className: "text-xs font-medium text-slate-700", children: cfg.label })] }, r));
                                    }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Phone" }), _jsx("input", { type: "tel", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: "+971 50 000 0000", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 mb-1", children: "Department" }), _jsx("input", { type: "text", value: department, onChange: (e) => setDepartment(e.target.value), placeholder: "e.g. Sales", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] }), !isEdit && (_jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700", children: "The user will be added to the system. Send them their login credentials separately via your authentication provider." })), error && _jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700", children: error })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-600 hover:text-slate-900", children: "Cancel" }), _jsx("button", { onClick: submit, disabled: loading, className: "px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors", children: loading ? "Saving..." : isEdit ? "Save Changes" : "Add Member" })] })] }) }));
}
// ─── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirmModal({ user, onClose, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function confirm() {
        setLoading(true);
        try {
            await axios.delete(`/api/users/${user.id}`);
            onDeleted();
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to delete user");
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl w-full max-w-sm p-6", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "font-semibold text-slate-900 mb-2", children: "Remove Team Member" }), _jsxs("p", { className: "text-sm text-slate-600 mb-4", children: ["Are you sure you want to remove ", _jsx("strong", { children: user.name }), "? This cannot be undone and will unassign them from all leads and tasks."] }), error && _jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 mb-3", children: error }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-600 hover:text-slate-900", children: "Cancel" }), _jsx("button", { onClick: confirm, disabled: loading, className: "px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors", children: loading ? "Removing..." : "Remove" })] })] }) }));
}
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState("ALL");
    const [search, setSearch] = useState("");
    const [formModal, setFormModal] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const load = useCallback(() => {
        setLoading(true);
        axios.get("/api/users")
            .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);
    const filtered = users.filter((u) => {
        if (filterRole !== "ALL" && u.role !== filterRole)
            return false;
        if (search) {
            const q = search.toLowerCase();
            if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department || "").toLowerCase().includes(q))
                return false;
        }
        return true;
    });
    // Role counts for KPIs
    const roleCounts = ROLES.reduce((acc, r) => {
        acc[r] = users.filter((u) => u.role === r).length;
        return acc;
    }, {});
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Team Management" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "Manage team members, roles, and access" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: load, className: "text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors", children: "Refresh" }), _jsx("button", { onClick: () => setFormModal({}), className: "text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors", children: "+ Add Member" })] })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-5 gap-3", children: ROLES.map((role) => {
                    const cfg = ROLE_CONFIG[role];
                    const isActive = filterRole === role;
                    return (_jsxs("button", { onClick: () => setFilterRole(isActive ? "ALL" : role), className: `rounded-xl p-4 text-left border-2 bg-white transition-all ${isActive ? "border-slate-800 shadow-sm" : "border-transparent hover:border-slate-300"}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-full ${cfg.dot}` }), _jsx("span", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: cfg.label })] }), _jsx("p", { className: "text-2xl font-bold text-slate-800", children: roleCounts[role] ?? 0 })] }, role));
                }) }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("input", { type: "text", placeholder: "Search by name, email, department...", value: search, onChange: (e) => setSearch(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72" }), (filterRole !== "ALL" || search) && (_jsx("button", { onClick: () => { setFilterRole("ALL"); setSearch(""); }, className: "text-xs text-slate-500 hover:text-slate-800 underline", children: "Clear filters" })), _jsxs("span", { className: "text-xs text-slate-400 ml-auto", children: [filtered.length, " member", filtered.length !== 1 ? "s" : ""] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-40", children: _jsx("div", { className: "w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : filtered.length === 0 ? (_jsx("div", { className: "py-16 text-center text-slate-400 text-sm", children: "No team members found" })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 border-b border-slate-100", children: _jsx("tr", { children: ["Member", "Role", "Department", "Phone", "Leads", "Joined", "Actions"].map((h) => (_jsx("th", { className: "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: filtered.map((user) => {
                                const cfg = ROLE_CONFIG[user.role] || { label: user.role, badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
                                return (_jsxs("tr", { className: "hover:bg-slate-50/80 transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${cfg.dot}`, children: initials(user.name) }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-800", children: user.name }), _jsx("p", { className: "text-xs text-slate-400", children: user.email })] })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`, children: cfg.label }) }), _jsx("td", { className: "px-4 py-3 text-slate-500 text-xs", children: user.department || "—" }), _jsx("td", { className: "px-4 py-3 text-slate-500 text-xs", children: user.phone || "—" }), _jsx("td", { className: "px-4 py-3 text-slate-600 text-sm", children: user._count?.assignedLeads ?? 0 }), _jsx("td", { className: "px-4 py-3 text-slate-400 text-xs", children: fmtDate(user.createdAt) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("button", { onClick: () => setFormModal({ user }), className: "text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors", children: "Edit" }), _jsx("button", { onClick: () => setDeleteModal(user), className: "text-xs font-medium px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors", children: "Remove" })] }) })] }, user.id));
                            }) })] })) }), formModal !== null && (_jsx(UserFormModal, { user: formModal.user, onClose: () => setFormModal(null), onSaved: () => { setFormModal(null); load(); } })), deleteModal && (_jsx(DeleteConfirmModal, { user: deleteModal, onClose: () => setDeleteModal(null), onDeleted: () => { setDeleteModal(null); load(); } }))] }));
}
