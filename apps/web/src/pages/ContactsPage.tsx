import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import ContactFormModal from "../components/ContactFormModal";

interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  jobTitle?: string;
  source: string;
  tags?: string;
  _count?: { activities: number };
  createdAt: string;
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL:   "bg-slate-100 text-slate-600",
  LEAD:     "bg-blue-100 text-blue-700",
  BROKER:   "bg-purple-100 text-purple-700",
  REFERRAL: "bg-emerald-100 text-emerald-700",
  IMPORT:   "bg-amber-100 text-amber-700",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [showCreate, setShowCreate] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = { page, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (filterSource !== "ALL") params.source = filterSource;

    axios.get("/api/contacts", { params })
      .then((r) => {
        setContacts(r.data.data || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, filterSource]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await axios.delete(`/api/contacts/${id}`);
      load();
    } catch (err) {
      const msg = (err as any)?.response?.data?.error || "Failed to delete contact";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
            <p className="text-xs text-slate-400 mt-0.5">{total.toLocaleString()} contacts · address book for communication</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + New Contact
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, phone, company…"
            className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
          />
          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="ALL">All Sources</option>
            {["MANUAL","LEAD","BROKER","REFERRAL","IMPORT"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-slate-500 font-medium">No contacts found</p>
              <p className="text-slate-400 text-sm mt-1">
                {search || filterSource !== "ALL" ? "Try adjusting your filters" : "Add your first contact to get started"}
              </p>
              {!search && filterSource === "ALL" && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  + New Contact
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Activities</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Added</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 group transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {c.firstName[0]}{c.lastName?.[0] ?? ""}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">
                            {c.firstName} {c.lastName ?? ""}
                          </p>
                          {c.jobTitle && <p className="text-xs text-slate-400">{c.jobTitle}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {c.email && <p className="text-xs text-slate-600">{c.email}</p>}
                        {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                        {c.whatsapp && !c.phone && <p className="text-xs text-emerald-600">{c.whatsapp}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.company ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[c.source] ?? "bg-slate-100 text-slate-600"}`}>
                        {c.source.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c._count?.activities ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingContact(c)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <ContactFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {editingContact && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSaved={() => { setEditingContact(null); load(); }}
        />
      )}
    </div>
  );
}
