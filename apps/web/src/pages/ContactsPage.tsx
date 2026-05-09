import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { SkeletonTableRows } from "../components/Skeleton";
import { PageContainer, PageHeader } from "../components/layout";
import {
  FilterBar,
  ActiveFilterChips,
  Pagination,
  type ActiveFilterChip,
} from "../components/data";
import { Button } from "../components/ui/button";

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
  MANUAL:   "bg-muted text-muted-foreground",
  LEAD:     "bg-info-soft text-primary",
  BROKER:   "bg-chart-7/15 text-chart-7",
  REFERRAL: "bg-success-soft text-success",
  IMPORT:   "bg-warning-soft text-warning",
};

const SOURCES = ["MANUAL", "LEAD", "BROKER", "REFERRAL", "IMPORT"] as const;
const SOURCE_OPTIONS = [
  { value: "ALL", label: "All sources" },
  ...SOURCES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
];

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("ALL");
  const [page, setPage] = useState(1);

  // Create/edit-modal state removed in Phase C.4 — both flows are routes now
  // (/contacts/new, /contacts/:contactId/edit). Row click → /contacts/:contactId.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);

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
      .catch((err) => {
        toast.error(err?.response?.data?.message || "Failed to load contacts");
      })
      .finally(() => setLoading(false));
  }, [page, search, filterSource]);

  useEffect(() => { load(); }, [load]);

  const performDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await axios.delete(`/api/contacts/${id}`);
      toast.success("Contact deleted");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete contact");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const initials = (c: Contact) => {
    const first = c.firstName?.trim()?.[0] ?? "";
    const last = c.lastName?.trim()?.[0] ?? "";
    return (first + last).toUpperCase() || "?";
  };

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search) {
      chips.push({
        key: "search",
        label: "Search",
        value: search,
        onRemove: () => { setSearch(""); setPage(1); },
      });
    }
    if (filterSource !== "ALL") {
      chips.push({
        key: "source",
        label: "Source",
        value: filterSource.replace(/_/g, " "),
        onRemove: () => { setFilterSource("ALL"); setPage(1); },
      });
    }
    return chips;
  }, [search, filterSource]);

  const resetFilters = () => {
    setSearch("");
    setFilterSource("ALL");
    setPage(1);
  };

  const hasFilters = activeChips.length > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Contacts" }]}
        title="Contacts"
        subtitle={`${total.toLocaleString()} contacts · address book for communication`}
        actions={<Button onClick={() => navigate("/contacts/new")}>Create contact</Button>}
      />

      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-4">
            <FilterBar
              search={{
                value: search,
                onChange: (v) => { setSearch(v); setPage(1); },
                placeholder: "Search name, email, phone, company…",
                ariaLabel: "Search contacts",
              }}
              filters={[
                {
                  key: "source",
                  label: "Source",
                  value: filterSource,
                  onChange: (v) => { setFilterSource(v); setPage(1); },
                  options: SOURCE_OPTIONS,
                },
              ]}
            />

            <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {loading ? (
                <table className="w-full text-sm">
                  <tbody>
                    <SkeletonTableRows rows={6} cols={7} />
                  </tbody>
                </table>
              ) : contacts.length === 0 ? (
                <EmptyState
                  icon="◉"
                  title="No contacts found"
                  description={
                    hasFilters
                      ? "Try adjusting your filters or clearing your search."
                      : "Add your first contact to get started."
                  }
                  action={
                    !hasFilters
                      ? { label: "Create contact", onClick: () => navigate("/contacts/new") }
                      : undefined
                  }
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activities</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Added</th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contacts.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        className="hover:bg-muted/50 group transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-info-soft text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {initials(c)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">
                                {(c.firstName || "Unnamed").trim()} {c.lastName ?? ""}
                              </p>
                              {c.jobTitle && <p className="text-xs text-muted-foreground">{c.jobTitle}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                            {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                            {c.whatsapp && !c.phone && <p className="text-xs text-success">{c.whatsapp}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.company ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[c.source] ?? "bg-muted text-muted-foreground"}`}>
                            {c.source.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c._count?.activities ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/contacts/${c.id}/edit`)}
                              className="h-7 px-2 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDelete(c)}
                              disabled={deletingId === c.id}
                              aria-label={`Delete ${c.firstName ?? "contact"}`}
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        </PageContainer>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete contact?"
        message={`This will permanently delete "${[confirmDelete?.firstName, confirmDelete?.lastName].filter(Boolean).join(" ") || "this contact"}". This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => confirmDelete && performDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
