import { useState } from "react";
import axios from "axios";

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

interface Props {
  contact?: Contact;
  onClose: () => void;
  onSaved: () => void;
}

const SOURCES = ["MANUAL", "LEAD", "BROKER", "REFERRAL", "IMPORT"];

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

export default function ContactFormModal({ contact, onClose, onSaved }: Props) {
  const isEdit = !!contact?.id;
  const [form, setForm] = useState<Contact>({
    firstName:   contact?.firstName   ?? "",
    lastName:    contact?.lastName    ?? "",
    email:       contact?.email       ?? "",
    phone:       contact?.phone       ?? "",
    whatsapp:    contact?.whatsapp    ?? "",
    company:     contact?.company     ?? "",
    jobTitle:    contact?.jobTitle    ?? "",
    nationality: contact?.nationality ?? "",
    source:      contact?.source      ?? "MANUAL",
    notes:       contact?.notes       ?? "",
    tags:        contact?.tags        ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Contact, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) { setError("First name is required"); return; }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await axios.patch(`/api/contacts/${contact!.id}`, form);
      } else {
        await axios.post("/api/contacts", form);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-bold text-foreground">{isEdit ? "Edit contact" : "Create contact"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>First Name *</label>
              <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inp} placeholder="e.g. Ahmed" />
            </div>
            <div>
              <label className={lbl}>Last Name</label>
              <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inp} placeholder="e.g. Al Rashidi" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inp} placeholder="email@example.com" />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="+971501234567" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>WhatsApp</label>
              <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inp} placeholder="+971501234567" />
            </div>
            <div>
              <label className={lbl}>Nationality</label>
              <input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inp} placeholder="e.g. UAE" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Company</label>
              <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inp} placeholder="Company name" />
            </div>
            <div>
              <label className={lbl}>Job Title</label>
              <input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} className={inp} placeholder="CEO, Investor..." />
            </div>
          </div>

          <div>
            <label className={lbl}>Source</label>
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className={inp}>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inp} placeholder="VIP, investor, returning-client" />
          </div>

          <div>
            <label className={lbl}>Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          {error && <p className="text-sm text-destructive bg-destructive-soft px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50">
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
