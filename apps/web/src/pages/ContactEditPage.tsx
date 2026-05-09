import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { z } from "zod";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";
import { Button } from "../components/ui/button";
import FieldError from "../components/ui/field-error";
import { useZodValidation } from "../lib/validation";

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

// Phone-ish regex — permissive: accepts +-?digits, spaces, parens, dashes.
// API does the strict normalisation; client just refuses obvious junk so the
// user gets a fast feedback loop.
const PHONE_RE = /^[+\d][\d\s().-]{5,}$/;

const contactFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().max(100).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Enter a valid email like name@example.com")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(PHONE_RE, "Enter a valid phone number, e.g. +971501234567")
    .optional()
    .or(z.literal("")),
  whatsapp: z
    .string()
    .trim()
    .regex(PHONE_RE, "Enter a valid number, e.g. +971501234567")
    .optional()
    .or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  nationality: z.string().trim().max(80).optional().or(z.literal("")),
  source: z.string().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tags: z.string().max(500).optional().or(z.literal("")),
});

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card";
const inpInvalid = "border-destructive focus:border-destructive";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

function fieldClasses(base: string, invalid: boolean): string {
  return invalid ? `${base} ${inpInvalid}` : base;
}

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { errors, validate, clearError } = useZodValidation(contactFormSchema);

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

  const set = (key: keyof Contact, val: string) => {
    clearError(key);
    setForm((f) => ({ ...f, [key]: val }));
  };

  const cancelTo = isEdit && contactId ? `/contacts/${contactId}` : "/contacts";

  async function submit() {
    if (!validate(form)) return;
    setSubmitError(null);
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
      setSubmitError(err.response?.data?.error || "Failed to save contact");
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(cancelTo)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create contact"}
          </Button>
        </>
      }
      main={
        <>
          {/* Identity */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className={lbl}>First Name *</label>
                <input
                  id="firstName"
                  name="firstName"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  className={fieldClasses(inp, !!errors.firstName)}
                  placeholder="e.g. Ahmed"
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? "firstName-error" : undefined}
                />
                <FieldError errors={errors} name="firstName" />
              </div>
              <div>
                <label htmlFor="lastName" className={lbl}>Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  value={form.lastName ?? ""}
                  onChange={(e) => set("lastName", e.target.value)}
                  className={fieldClasses(inp, !!errors.lastName)}
                  placeholder="e.g. Al Rashidi"
                />
                <FieldError errors={errors} name="lastName" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="nationality" className={lbl}>Nationality</label>
                <input
                  id="nationality"
                  name="nationality"
                  value={form.nationality ?? ""}
                  onChange={(e) => set("nationality", e.target.value)}
                  className={fieldClasses(inp, !!errors.nationality)}
                  placeholder="e.g. UAE"
                />
                <FieldError errors={errors} name="nationality" />
              </div>
              <div>
                <label htmlFor="source" className={lbl}>Source</label>
                <select
                  id="source"
                  name="source"
                  value={form.source ?? "MANUAL"}
                  onChange={(e) => set("source", e.target.value)}
                  className={inp}
                >
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
                <label htmlFor="email" className={lbl}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                  className={fieldClasses(inp, !!errors.email)}
                  placeholder="email@example.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                <FieldError errors={errors} name="email" />
              </div>
              <div>
                <label htmlFor="phone" className={lbl}>Phone</label>
                <input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  className={fieldClasses(inp, !!errors.phone)}
                  placeholder="+971501234567"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                />
                <FieldError errors={errors} name="phone" />
              </div>
              <div>
                <label htmlFor="whatsapp" className={lbl}>WhatsApp</label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  inputMode="tel"
                  value={form.whatsapp ?? ""}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  className={fieldClasses(inp, !!errors.whatsapp)}
                  placeholder="+971501234567"
                  aria-invalid={!!errors.whatsapp}
                  aria-describedby={errors.whatsapp ? "whatsapp-error" : undefined}
                />
                <FieldError errors={errors} name="whatsapp" />
              </div>
            </div>
          </div>

          {/* Affiliation */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Affiliation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="company" className={lbl}>Company</label>
                <input
                  id="company"
                  name="company"
                  value={form.company ?? ""}
                  onChange={(e) => set("company", e.target.value)}
                  className={fieldClasses(inp, !!errors.company)}
                  placeholder="Company name"
                />
                <FieldError errors={errors} name="company" />
              </div>
              <div>
                <label htmlFor="jobTitle" className={lbl}>Job Title</label>
                <input
                  id="jobTitle"
                  name="jobTitle"
                  value={form.jobTitle ?? ""}
                  onChange={(e) => set("jobTitle", e.target.value)}
                  className={fieldClasses(inp, !!errors.jobTitle)}
                  placeholder="CEO, Investor…"
                />
                <FieldError errors={errors} name="jobTitle" />
              </div>
            </div>
          </div>

          {/* Tags & notes */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tags & notes</h3>
            <div>
              <label htmlFor="tags" className={lbl}>Tags (comma-separated)</label>
              <input
                id="tags"
                name="tags"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                className={inp}
                placeholder="VIP, investor, returning-client"
              />
            </div>
            <div>
              <label htmlFor="notes" className={lbl}>Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
                className={inp + " resize-none"}
                placeholder="Any additional notes…"
              />
            </div>
          </div>

          {submitError && (
            <div role="alert" className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </>
      }
    />
  );
}
