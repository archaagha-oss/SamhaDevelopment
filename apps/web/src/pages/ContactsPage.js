import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ContactFormModal from "../components/ContactFormModal";
const SOURCE_COLORS = {
    MANUAL: "bg-slate-100 text-slate-600",
    LEAD: "bg-blue-100 text-blue-700",
    BROKER: "bg-purple-100 text-purple-700",
    REFERRAL: "bg-emerald-100 text-emerald-700",
    IMPORT: "bg-amber-100 text-amber-700",
};
export default function ContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterSource, setFilterSource] = useState("ALL");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;
    const [showCreate, setShowCreate] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const load = useCallback(() => {
        setLoading(true);
        const params = { page, limit: PAGE_SIZE };
        if (search)
            params.search = search;
        if (filterSource !== "ALL")
            params.source = filterSource;
        axios.get("/api/contacts", { params })
            .then((r) => {
            setContacts(r.data.data || []);
            setTotal(r.data.total || 0);
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [page, search, filterSource]);
    useEffect(() => { load(); }, [load]);
    const handleDelete = async (id) => {
        if (!confirm("Delete this contact? This cannot be undone."))
            return;
        setDeletingId(id);
        try {
            await axios.delete(`/api/contacts/${id}`);
            load();
        }
        catch { }
        finally {
            setDeletingId(null);
        }
    };
    const totalPages = Math.ceil(total / PAGE_SIZE);
    return (_jsxs("div", { className: "min-h-screen bg-slate-50", children: [_jsx("div", { className: "bg-white border-b border-slate-200 sticky top-0 z-10", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-900", children: "Contacts" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [total.toLocaleString(), " contacts \u00B7 address book for communication"] })] }), _jsx("button", { onClick: () => setShowCreate(true), className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors", children: "+ New Contact" })] }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-5", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4 flex-wrap", children: [_jsx("input", { value: search, onChange: (e) => { setSearch(e.target.value); setPage(1); }, placeholder: "Search name, email, phone, company\u2026", className: "flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400" }), _jsxs("select", { value: filterSource, onChange: (e) => { setFilterSource(e.target.value); setPage(1); }, className: "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "ALL", children: "All Sources" }), ["MANUAL", "LEAD", "BROKER", "REFERRAL", "IMPORT"].map((s) => (_jsx("option", { value: s, children: s.replace(/_/g, " ") }, s)))] })] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : contacts.length === 0 ? (_jsxs("div", { className: "text-center py-16", children: [_jsx("p", { className: "text-3xl mb-3", children: "\uD83D\uDCCB" }), _jsx("p", { className: "text-slate-500 font-medium", children: "No contacts found" }), _jsx("p", { className: "text-slate-400 text-sm mt-1", children: search || filterSource !== "ALL" ? "Try adjusting your filters" : "Add your first contact to get started" }), !search && filterSource === "ALL" && (_jsx("button", { onClick: () => setShowCreate(true), className: "mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700", children: "+ New Contact" }))] })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "sticky top-0 bg-slate-50 border-b border-slate-200 z-10", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Name" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Contact" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Company" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Source" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Activities" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Added" }), _jsx("th", { className: "px-4 py-3 w-20" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: contacts.map((c) => (_jsxs("tr", { className: "hover:bg-slate-50 group transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0", children: [c.firstName[0], c.lastName?.[0] ?? ""] }), _jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-slate-800 text-sm", children: [c.firstName, " ", c.lastName ?? ""] }), c.jobTitle && _jsx("p", { className: "text-xs text-slate-400", children: c.jobTitle })] })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "space-y-0.5", children: [c.email && _jsx("p", { className: "text-xs text-slate-600", children: c.email }), c.phone && _jsx("p", { className: "text-xs text-slate-500", children: c.phone }), c.whatsapp && !c.phone && _jsx("p", { className: "text-xs text-emerald-600", children: c.whatsapp })] }) }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-600", children: c.company ?? "—" }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[c.source] ?? "bg-slate-100 text-slate-600"}`, children: c.source.replace(/_/g, " ") }) }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-500", children: c._count?.activities ?? 0 }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-400", children: new Date(c.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { onClick: () => setEditingContact(c), className: "px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors", children: "Edit" }), _jsx("button", { onClick: () => handleDelete(c.id), disabled: deletingId === c.id, className: "px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50", children: "Del" })] }) })] }, c.id))) })] })) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between mt-4", children: [_jsxs("p", { className: "text-xs text-slate-500", children: ["Showing ", ((page - 1) * PAGE_SIZE) + 1, "\u2013", Math.min(page * PAGE_SIZE, total), " of ", total] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, className: "px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40", children: "\u2190 Prev" }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40", children: "Next \u2192" })] })] }))] }), showCreate && (_jsx(ContactFormModal, { onClose: () => setShowCreate(false), onSaved: () => { setShowCreate(false); load(); } })), editingContact && (_jsx(ContactFormModal, { contact: editingContact, onClose: () => setEditingContact(null), onSaved: () => { setEditingContact(null); load(); } }))] }));
}
