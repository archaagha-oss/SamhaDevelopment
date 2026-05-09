import { useEffect, useMemo, useRef, useState } from "react";
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
import { useAgents } from "../hooks/useAgents";
import EmiratesIdScan from "../components/EmiratesIdScan";
import UnitInterestPicker from "../components/UnitInterestPicker";
import type { EmiratesIdFields } from "../utils/emiratesIdOcr";

// Permissive phone regex; the API normalises strictly. Client just rejects
// obvious junk so the user gets fast feedback.
const PHONE_RE = /^[+\d][\d\s().-]{5,}$/;

function leadFormSchema(opts: { isEdit: boolean }) {
  return z.object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone is required")
      .regex(PHONE_RE, "Enter a valid phone number, e.g. +971501234567"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email like name@example.com")
      .optional()
      .or(z.literal("")),
    assignedAgentId: z.string().min(1, "Pick an assigned agent"),
    consent: opts.isEdit
      ? z.boolean().optional()
      : z.literal(true, {
          errorMap: () => ({ message: "Consent is required before creating a lead" }),
        }),
  });
}

// LeadEditPage — handles both /leads/new (create) and /leads/:leadId/edit (edit).
// Replaces the inline <Modal title="Edit lead"> in LeadProfilePage and the dead
// LeadFormModal.tsx. Pattern matches MemberEditPage / DealEditPage from
// Phases B and C.1.
//
// QuickLeadModal stays in place for the fast-create path on LeadsPage —
// it's a deliberate ergonomic shortcut (5 fields), not a popup-edit.

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  source: string;
  budget?: number | null;
  notes?: string | null;
  stage: string;
  assignedAgent?: { id: string; name: string };
  assignedAgentId?: string | null;
  brokerCompany?: { id: string; name: string } | null;
  brokerCompanyId?: string | null;
  brokerAgentId?: string | null;
  address?: string | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  companyRegistrationNumber?: string | null;
  authorizedSignatory?: string | null;
  sourceOfFunds?: string | null;
  interests?: Array<{ id: string; unitId: string; isPrimary: boolean; unit: { unitNumber: string } }>;
}

interface BrokerCompany { id: string; name: string }
interface BrokerAgent   { id: string; name: string }

const inp = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-colors";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const SOURCE_OPTIONS = ["DIRECT", "BROKER", "WEBSITE", "REFERRAL", "WHATSAPP", "WALK_IN"];

const BLANK = {
  firstName: "", lastName: "", phone: "", email: "", nationality: "",
  source: "DIRECT", budget: "", notes: "",
  assignedAgentId: "",
  brokerCompanyId: "", brokerAgentId: "",
  address: "", emiratesId: "", passportNumber: "",
  companyRegistrationNumber: "", authorizedSignatory: "", sourceOfFunds: "",
};

const leadsCrumbs = [{ label: "Home", path: "/" }, { label: "Leads", path: "/leads" }];

export default function LeadEditPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const isEdit = !!leadId;

  const firstNameRef = useRef<HTMLInputElement>(null);
  const { data: agents = [] } = useAgents();

  const [lead,      setLead]      = useState<Lead | null>(null);
  const [loading,   setLoading]   = useState(isEdit);
  const [loadError, setLoadError] = useState(false);

  const [form, setForm] = useState(BLANK);
  // Create-only: required consent + KYC scan
  const [consent, setConsent] = useState(false);

  const [brokerCompanies, setBrokerCompanies] = useState<BrokerCompany[]>([]);
  const [brokerAgents,    setBrokerAgents]    = useState<BrokerAgent[]>([]);

  // Unit interest state
  const [selectedUnitIds,    setSelectedUnitIds]    = useState<Set<string>>(new Set());
  const [primaryUnitId,      setPrimaryUnitId]      = useState("");
  const [showUnitPicker,     setShowUnitPicker]     = useState(false);
  const [interestedUnitMeta, setInterestedUnitMeta] = useState<Record<string, { unitNumber: string }>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const validationSchema = useMemo(() => leadFormSchema({ isEdit }), [isEdit]);
  const { errors, validate, clearError } = useZodValidation(validationSchema);

  // Focus first field on mount (create mode only — edit mode loads async)
  useEffect(() => {
    if (!isEdit) firstNameRef.current?.focus();
  }, [isEdit]);

  // Load broker companies once
  useEffect(() => {
    axios.get("/api/brokers/companies")
      .then((r) => setBrokerCompanies(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // Load broker agents whenever broker company changes
  useEffect(() => {
    if (!form.brokerCompanyId) { setBrokerAgents([]); return; }
    axios.get(`/api/brokers/companies/${form.brokerCompanyId}/agents`)
      .then((r) => setBrokerAgents(r.data?.data ?? r.data ?? []))
      .catch(() => setBrokerAgents([]));
  }, [form.brokerCompanyId]);

  // Edit mode: load lead and pre-fill form
  useEffect(() => {
    if (!isEdit || !leadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`/api/leads/${leadId}`);
        if (cancelled) return;
        const l = r.data as Lead;
        setLead(l);
        setForm({
          firstName:                 l.firstName ?? "",
          lastName:                  l.lastName ?? "",
          phone:                     l.phone ?? "",
          email:                     l.email ?? "",
          nationality:               l.nationality ?? "",
          source:                    l.source ?? "DIRECT",
          budget:                    l.budget != null ? String(l.budget) : "",
          notes:                     l.notes ?? "",
          assignedAgentId:           l.assignedAgent?.id ?? l.assignedAgentId ?? "",
          brokerCompanyId:           l.brokerCompanyId ?? "",
          brokerAgentId:             l.brokerAgentId ?? "",
          address:                   l.address ?? "",
          emiratesId:                l.emiratesId ?? "",
          passportNumber:            l.passportNumber ?? "",
          companyRegistrationNumber: l.companyRegistrationNumber ?? "",
          authorizedSignatory:       l.authorizedSignatory ?? "",
          sourceOfFunds:             l.sourceOfFunds ?? "",
        });
        const ids = new Set((l.interests ?? []).map((i) => i.unitId));
        setSelectedUnitIds(ids);
        setPrimaryUnitId(((l.interests ?? []).find((i) => i.isPrimary))?.unitId ?? "");
        setInterestedUnitMeta(
          (l.interests ?? []).reduce<Record<string, { unitNumber: string }>>((acc, i) => {
            acc[i.unitId] = { unitNumber: i.unit.unitNumber };
            return acc;
          }, {}),
        );
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, leadId]);

  const set = (patch: Partial<typeof BLANK>) => {
    Object.keys(patch).forEach((k) => clearError(k));
    setForm((f) => ({ ...f, ...patch }));
  };

  const applyEmiratesId = (fields: EmiratesIdFields) => {
    const patch: Partial<typeof BLANK> = {};
    if (fields.fullName) {
      const parts = fields.fullName.split(/\s+/);
      patch.firstName = parts[0] || "";
      patch.lastName = parts.slice(1).join(" ") || "";
    }
    if (fields.nationality) patch.nationality = fields.nationality;
    if (Object.keys(patch).length) set(patch);
  };

  const cancelTo = isEdit && leadId ? `/leads/${leadId}` : "/leads";

  // Build PATCH payload for edit (diff against original)
  function diffPayload(): Record<string, unknown> {
    if (!lead) return {};
    const payload: Record<string, unknown> = {};
    const get = (k: keyof typeof BLANK) => form[k];
    const cmp = (k: keyof typeof BLANK, original: string | null | undefined, transform?: (v: string) => unknown) => {
      const v = get(k);
      const old = original ?? "";
      if (v !== old) payload[k] = transform ? transform(v) : (v || null);
    };
    cmp("firstName",                 lead.firstName,                 (v) => v);
    cmp("lastName",                  lead.lastName,                  (v) => v);
    cmp("phone",                     lead.phone,                     (v) => v);
    cmp("email",                     lead.email);
    cmp("nationality",               lead.nationality);
    cmp("source",                    lead.source,                    (v) => v);
    cmp("notes",                     lead.notes);
    const newBudget = form.budget !== "" ? parseFloat(form.budget) : null;
    if (newBudget !== (lead.budget ?? null)) payload.budget = newBudget;
    const oldAgent = lead.assignedAgent?.id ?? lead.assignedAgentId ?? "";
    if (form.assignedAgentId !== oldAgent) payload.assignedAgentId = form.assignedAgentId || null;
    cmp("brokerCompanyId",           lead.brokerCompanyId);
    cmp("brokerAgentId",             lead.brokerAgentId);
    cmp("address",                   lead.address);
    cmp("emiratesId",                lead.emiratesId);
    cmp("passportNumber",            lead.passportNumber);
    cmp("companyRegistrationNumber", lead.companyRegistrationNumber);
    cmp("authorizedSignatory",       lead.authorizedSignatory);
    cmp("sourceOfFunds",             lead.sourceOfFunds);
    return payload;
  }

  async function submit() {
    setSubmitError(null);
    if (!validate({ ...form, consent })) return;
    setSubmitting(true);
    try {
      if (isEdit && lead) {
        const payload = diffPayload();
        if (Object.keys(payload).length > 0) {
          await axios.patch(`/api/leads/${lead.id}`, payload);
        }
        toast.success("Lead updated");
        navigate(`/leads/${lead.id}`);
      } else {
        const r = await axios.post("/api/leads", {
          firstName:       form.firstName,
          lastName:        form.lastName,
          phone:           form.phone,
          email:           form.email || undefined,
          nationality:     form.nationality || undefined,
          source:          form.source,
          budget:          form.budget ? parseFloat(form.budget) : null,
          assignedAgentId: form.assignedAgentId || undefined,
          notes:           form.notes || undefined,
          brokerCompanyId: form.source === "BROKER" && form.brokerCompanyId ? form.brokerCompanyId : undefined,
          brokerAgentId:   form.source === "BROKER" && form.brokerAgentId ? form.brokerAgentId : undefined,
          consent,
          address:                   form.address || null,
          emiratesId:                form.emiratesId || null,
          passportNumber:            form.passportNumber || null,
          companyRegistrationNumber: form.companyRegistrationNumber || null,
          authorizedSignatory:       form.authorizedSignatory || null,
          sourceOfFunds:             form.sourceOfFunds || null,
        });
        const newId = r.data?.id;

        // Register interested units (and auto-create offers server-side)
        if (selectedUnitIds.size > 0 && newId) {
          await Promise.all(
            [...selectedUnitIds].map((unitId) =>
              axios.post(`/api/leads/${newId}/interests`, {
                unitId,
                isPrimary: unitId === primaryUnitId,
              }),
            ),
          );
        }

        toast.success("Lead created");
        navigate(newId ? `/leads/${newId}` : "/leads");
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || "Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  }

  // Edit mode: persist unit-interest changes immediately (matches LeadProfilePage's
  // existing UX where unit picker writes through, distinct from the form save).
  async function handleUnitsChange(selected: Set<string>, primary: string) {
    if (!isEdit || !leadId) {
      // Create mode: just update local state; submit() will register interests on POST.
      setSelectedUnitIds(selected);
      setPrimaryUnitId(primary);
      return;
    }
    setSelectedUnitIds(selected);
    setPrimaryUnitId(primary);
    try {
      const current = new Set(Object.keys(interestedUnitMeta));
      const toAdd    = [...selected].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !selected.has(id));

      await Promise.all([
        ...toAdd.map((unitId) =>
          axios.post(`/api/leads/${leadId}/interests`, { unitId, isPrimary: unitId === primary }),
        ),
        ...toRemove.map((unitId) =>
          axios.delete(`/api/leads/${leadId}/interests/${unitId}`),
        ),
      ]);
      // Re-pull interest meta
      const r = await axios.get(`/api/leads/${leadId}`);
      const updated = r.data as Lead;
      setInterestedUnitMeta(
        (updated.interests ?? []).reduce<Record<string, { unitNumber: string }>>((acc, i) => {
          acc[i.unitId] = { unitNumber: i.unit.unitNumber };
          return acc;
        }, {}),
      );
      toast.success("Unit interests updated");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update interests");
    }
  }

  if (loading) return <DetailPageLoading crumbs={leadsCrumbs} title="Loading lead…" />;

  if (isEdit && (loadError || !lead)) {
    return (
      <DetailPageNotFound
        crumbs={leadsCrumbs}
        title="Lead not found"
        message="This lead could not be loaded. It may have been deleted."
        backLabel="Back to leads"
        onBack={() => navigate("/leads")}
      />
    );
  }

  const isBroker = form.source === "BROKER";

  const crumbs = isEdit && lead
    ? [
        ...leadsCrumbs,
        { label: `${lead.firstName} ${lead.lastName}`, path: `/leads/${lead.id}` },
        { label: "Edit" },
      ]
    : [...leadsCrumbs, { label: "New lead" }];

  const title = isEdit && lead ? `Edit ${lead.firstName} ${lead.lastName}` : "Create lead";
  const subtitle = isEdit
    ? "Update profile, source, KYC, broker, and unit interests."
    : "Capture a new prospect. Fields marked * are required.";

  const selectedUnitArray = useMemo(() => Array.from(selectedUnitIds), [selectedUnitIds]);

  return (
    <>
      <DetailPageLayout
        crumbs={crumbs}
        title={title}
        subtitle={subtitle}
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create lead"}
            </Button>
          </>
        }
        main={
          <>
            {/* Identity */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identity</h3>

              {/* OCR scan — create mode only, optional */}
              {!isEdit && <EmiratesIdScan onExtracted={applyEmiratesId} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className={lbl}>First Name *</label>
                  <input
                    id="firstName"
                    name="firstName"
                    ref={firstNameRef}
                    value={form.firstName}
                    onChange={(e) => set({ firstName: e.target.value })}
                    className={errors.firstName ? `${inp} border-destructive focus:border-destructive` : inp}
                    placeholder="Ahmed"
                    aria-invalid={!!errors.firstName}
                  />
                  <FieldError errors={errors} name="firstName" />
                </div>
                <div>
                  <label htmlFor="lastName" className={lbl}>Last Name *</label>
                  <input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={(e) => set({ lastName: e.target.value })}
                    className={errors.lastName ? `${inp} border-destructive focus:border-destructive` : inp}
                    placeholder="Al Mansouri"
                    aria-invalid={!!errors.lastName}
                  />
                  <FieldError errors={errors} name="lastName" />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className={lbl}>Phone *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className={errors.phone ? `${inp} border-destructive focus:border-destructive` : inp}
                  placeholder="+971 50 000 0000"
                  aria-invalid={!!errors.phone}
                />
                <FieldError errors={errors} name="phone" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="email" className={lbl}>Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                    className={errors.email ? `${inp} border-destructive focus:border-destructive` : inp}
                    placeholder="optional"
                    aria-invalid={!!errors.email}
                  />
                  <FieldError errors={errors} name="email" />
                </div>
                <div>
                  <label htmlFor="nationality" className={lbl}>Nationality</label>
                  <input
                    id="nationality"
                    name="nationality"
                    value={form.nationality}
                    onChange={(e) => set({ nationality: e.target.value })}
                    className={inp}
                    placeholder="optional"
                  />
                </div>
              </div>
            </div>

            {/* Source & assignment */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Source & assignment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Lead Source *</label>
                  <select
                    required
                    value={form.source}
                    onChange={(e) => set({ source: e.target.value, brokerCompanyId: "", brokerAgentId: "" })}
                    className={inp}
                  >
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Budget (AED)</label>
                  <input
                    type="number" min={0} step={1000}
                    value={form.budget}
                    onChange={(e) => set({ budget: e.target.value })}
                    className={inp}
                    placeholder="optional"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="assignedAgentId" className={lbl}>Assigned Sales Agent *</label>
                <select
                  id="assignedAgentId"
                  name="assignedAgentId"
                  value={form.assignedAgentId}
                  onChange={(e) => set({ assignedAgentId: e.target.value })}
                  className={errors.assignedAgentId ? `${inp} border-destructive focus:border-destructive` : inp}
                  aria-invalid={!!errors.assignedAgentId}
                >
                  <option value="">Select agent…</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <FieldError errors={errors} name="assignedAgentId" />
              </div>

              {isBroker && (
                <div className="space-y-3 border border-chart-7/30 bg-chart-7/10 rounded-xl p-4">
                  <p className="text-xs font-semibold text-chart-7 uppercase tracking-wide">Broker</p>
                  <div>
                    <label className={lbl}>Broker Company</label>
                    <select
                      value={form.brokerCompanyId}
                      onChange={(e) => set({ brokerCompanyId: e.target.value, brokerAgentId: "" })}
                      className={inp}
                    >
                      <option value="">Select company…</option>
                      {brokerCompanies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {form.brokerCompanyId && (
                    <div>
                      <label className={lbl}>Broker Agent (optional)</label>
                      <select
                        value={form.brokerAgentId}
                        onChange={(e) => set({ brokerAgentId: e.target.value })}
                        className={inp}
                      >
                        <option value="">Select agent…</option>
                        {brokerAgents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={lbl}>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="Any additional context…"
                  className={inp + " resize-none"}
                />
              </div>
            </div>

            {/* KYC / SPA particulars */}
            <details className="bg-card rounded-xl border border-border" open={isEdit && !!(lead?.address || lead?.emiratesId)}>
              <summary className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
                KYC & SPA particulars
              </summary>
              <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
                <div>
                  <label className={lbl}>Residential Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => set({ address: e.target.value })}
                    placeholder="Country, city, neighbourhood, building, flat #"
                    className={inp}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Emirates ID</label>
                    <input
                      value={form.emiratesId}
                      onChange={(e) => set({ emiratesId: e.target.value })}
                      placeholder="784-…"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Passport Number</label>
                    <input
                      value={form.passportNumber}
                      onChange={(e) => set({ passportNumber: e.target.value })}
                      className={inp}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Company Registration No.</label>
                    <input
                      value={form.companyRegistrationNumber}
                      onChange={(e) => set({ companyRegistrationNumber: e.target.value })}
                      placeholder="For corporate purchasers"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Authorized Signatory</label>
                    <input
                      value={form.authorizedSignatory}
                      onChange={(e) => set({ authorizedSignatory: e.target.value })}
                      placeholder="Name printed on the signature block"
                      className={inp}
                    />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Source of Funds</label>
                  <input
                    value={form.sourceOfFunds}
                    onChange={(e) => set({ sourceOfFunds: e.target.value })}
                    placeholder="e.g. Salary, Inheritance"
                    className={inp}
                  />
                </div>
              </div>
            </details>

            {/* Unit interests */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Interested units {selectedUnitIds.size > 0 && (
                    <span className="ml-1 text-foreground">({selectedUnitIds.size})</span>
                  )}
                </h3>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowUnitPicker(true)}
                  className="h-auto p-0 text-xs text-success font-semibold"
                >
                  {selectedUnitIds.size > 0 ? "Manage" : "+ Add units"}
                </Button>
              </div>
              {selectedUnitIds.size > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUnitArray.map((unitId) => {
                    const meta = interestedUnitMeta[unitId];
                    const label = meta?.unitNumber ?? unitId.slice(0, 8);
                    const isPrimary = unitId === primaryUnitId;
                    return (
                      <span
                        key={unitId}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          isPrimary
                            ? "bg-success text-success-foreground"
                            : "bg-card text-foreground border border-border"
                        }`}
                      >
                        {isPrimary && "★ "}{label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No units linked yet. Optional.</p>
              )}
            </div>

            {/* Consent — create mode only */}
            {!isEdit && (
              <div className={`bg-card rounded-xl border p-4 ${errors.consent ? "border-destructive" : "border-border"}`}>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    id="consent"
                    name="consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => { clearError("consent"); setConsent(e.target.checked); }}
                    className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-ring"
                    aria-invalid={!!errors.consent}
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    The lead has consented to being contacted about properties and to data
                    processing under our privacy policy. <span className="text-destructive">*</span>
                  </span>
                </label>
                <FieldError errors={errors} name="consent" className="ml-6" />
              </div>
            )}

            {submitError && (
              <div role="alert" className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
                {submitError}
              </div>
            )}
          </>
        }
      />

      <UnitInterestPicker
        isOpen={showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        selectedUnitIds={selectedUnitIds}
        primaryUnitId={primaryUnitId}
        onUnitsChange={handleUnitsChange}
      />
    </>
  );
}
