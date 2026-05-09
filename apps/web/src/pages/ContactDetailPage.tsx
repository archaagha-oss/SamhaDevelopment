import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";
import ConfirmDialog from "../components/ConfirmDialog";

interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  jobTitle?: string;
  nationality?: string;
  source: string;
  notes?: string;
  tags?: string;
  _count?: { activities: number };
  createdAt: string;
  updatedAt?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL:   "bg-muted text-muted-foreground",
  LEAD:     "bg-info-soft text-primary",
  BROKER:   "bg-chart-7/15 text-chart-7",
  REFERRAL: "bg-success-soft text-success",
  IMPORT:   "bg-warning-soft text-warning",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const contactsCrumbs = [{ label: "Home", path: "/" }, { label: "Contacts", path: "/contacts" }];

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-sm text-foreground text-right break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`/api/contacts/${contactId}`);
        if (cancelled) return;
        setContact(r.data);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId]);

  async function performDelete() {
    if (!contact) return;
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await axios.delete(`/api/contacts/${contact.id}`);
      toast.success("Contact deleted");
      navigate("/contacts");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete contact");
      setDeleting(false);
    }
  }

  if (loading) return <DetailPageLoading crumbs={contactsCrumbs} title="Loading contact…" />;
  if (loadError || !contact) {
    return (
      <DetailPageNotFound
        crumbs={contactsCrumbs}
        title="Contact not found"
        message="This contact could not be loaded. It may have been deleted."
        backLabel="Back to contacts"
        onBack={() => navigate("/contacts")}
      />
    );
  }

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || "Unnamed";
  const initials = (
    (contact.firstName?.[0] ?? "") + (contact.lastName?.[0] ?? "")
  ).toUpperCase() || "?";

  const tags = (contact.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <>
      <DetailPageLayout
        crumbs={[...contactsCrumbs, { label: fullName }]}
        title={fullName}
        subtitle={contact.jobTitle || (contact.company ? contact.company : "Contact details")}
        actions={
          <>
            <button
              onClick={() => navigate(`/contacts/${contact.id}/edit`)}
              className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-destructive/30 bg-destructive-soft text-destructive hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          </>
        }
        hero={
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-start gap-5 min-w-0">
              <div className="w-20 h-20 rounded-full bg-info-soft text-primary text-xl font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">{fullName}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {contact.jobTitle || "—"}{contact.company ? ` · ${contact.company}` : ""}
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[contact.source] ?? "bg-muted text-muted-foreground"}`}>
                    {contact.source.replace(/_/g, " ")}
                  </span>
                  {tags.map((t) => (
                    <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
        main={
          <>
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Communication channels</h3>
              <div className="space-y-2">
                <DetailRow label="Email"    value={contact.email}    mono />
                <DetailRow label="Phone"    value={contact.phone}    mono />
                <DetailRow label="WhatsApp" value={contact.whatsapp} mono />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Affiliation</h3>
              <div className="space-y-2">
                <DetailRow label="Company"     value={contact.company} />
                <DetailRow label="Job Title"   value={contact.jobTitle} />
                <DetailRow label="Nationality" value={contact.nationality} />
              </div>
            </div>

            {contact.notes && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </>
        }
        aside={
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Activity</h3>
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-foreground tabular-nums">{contact._count?.activities ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Logged activities</p>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border">
              <DetailRow label="Added"   value={fmtDate(contact.createdAt)} />
              {contact.updatedAt && <DetailRow label="Updated" value={fmtDate(contact.updatedAt)} />}
            </div>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete contact?"
        message={`This will permanently delete "${fullName}". This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
