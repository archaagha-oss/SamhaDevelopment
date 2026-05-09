import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";

// ContactEditPage — handles /contacts/new (create) and /contacts/:id/edit (edit).
// Replaces ContactFormModal.

interface Contact {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  jobTitle?: string;
  nationality?: string;
  source?: string;
  notes?: string;
  tags?: string;
}

const SOURCES = ["MANUAL", "LEAD", "BROKER", "REFERRAL", "IMPORT"];

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const BLANK: Contact = {
  firstName: "", lastName: "", email: "", phone: "", whatsapp: "",
  company: "", jobTitle: "", nationality: "", source: "MANUAL",
  notes: "", tags: "",
};

const contactsCrumbs = [{ label: "Home", path: "/" }, { label: "Contacts", path: "/contacts" }];

export default function ContactEditPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const isEdit = !!contactId;

  const [form,      setForm]      = useState<Contact>(BLANK);
  const [loading,   setLoading]   = useState(isEdit);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !contactId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`/api/contacts/${contactId}`);
        if (cancelled) return;
        const c = r.data as Contact;
        setForm({
          id:          c.id,
          firstName:   c.firstName ?? "",
          lastName:    c.lastName ?? "",
          email:       c.email ?? "",
          phone:       c.phone ?? "",
          whatsapp:    c.whatsapp ?? "",
          company:     c.company ?? "",
          jobTitle:    c.jobTitle ?? "",
          nationality: c.nationality ?? "",
          source:      c.source ?? "MANUAL",
          notes:       c.notes ?? "",
          tags:        c.tags ?? "",
        });
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, contactId]);

  const set = (key: keyof Contact, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const cancelTo = isEdit && contactId ? `/contacts/${contactId}` : "/contacts";

  async function submit() {
    if (!form.firstName.trim()) {
      setError("First name is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && contactId) {
        await axios.patch(`/api/contacts/${contactId}`, form);
        toast.success("Contact updated");
        navigate(`/contacts/${contactId}`);
      } else {
        const r = await axios.post("/api/contacts", form);
        const newId = r.data?.id;
        toast.success("Contact created");
        navigate(newId ? `/contacts/${newId}` : "/contacts");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <DetailPageLoading crumbs={contactsCrumbs} title="Loading contact…" />;
  if (isEdit && (loadError || !form.id)) {
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

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim() || "contact";
  const crumbs = isEdit
    ? [...contactsCrumbs, { label: fullName, path: `/contacts/${contactId}` }, { label: "Edit" }]
    : [...contactsCrumbs, { label: "New contact" }];

  return (
    <DetailPageLayout
      crumbs={crumbs}
      title={isEdit ? `Edit ${fullName}` : "Create contact"}
      subtitle={isEdit ? "Update contact details, communication channels, and metadata." : "Add a new contact to the address book."}
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate(cancelTo)}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create contact"}
          </button>
        </>
      }
      main={
        <>
          {/* Identity */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First Name *</label>
                <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inp} placeholder="e.g. Ahmed" />
              </div>
              <div>
                <label className={lbl}>Last Name</label>
                <input value={form.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} className={inp} placeholder="e.g. Al Rashidi" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nationality</label>
                <input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} className={inp} placeholder="e.g. UAE" />
              </div>
              <div>
                <label className={lbl}>Source</label>
                <select value={form.source ?? "MANUAL"} onChange={(e) => set("source", e.target.value)} className={inp}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Communication channels */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Communication channels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inp} placeholder="email@example.com" />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="+971501234567" />
              </div>
              <div>
                <label className={lbl}>WhatsApp</label>
                <input value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} className={inp} placeholder="+971501234567" />
              </div>
            </div>
          </div>

          {/* Affiliation */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Affiliation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Company</label>
                <input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} className={inp} placeholder="Company name" />
              </div>
              <div>
                <label className={lbl}>Job Title</label>
                <input value={form.jobTitle ?? ""} onChange={(e) => set("jobTitle", e.target.value)} className={inp} placeholder="CEO, Investor…" />
              </div>
            </div>
          </div>

          {/* Tags & notes */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tags & notes</h3>
            <div>
              <label className={lbl}>Tags (comma-separated)</label>
              <input value={form.tags ?? ""} onChange={(e) => set("tags", e.target.value)} className={inp} placeholder="VIP, investor, returning-client" />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
                className={inp + " resize-none"}
                placeholder="Any additional notes…"
              />
            </div>
          </div>

          {error && (
            <div className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </>
      }
    />
  );
}
