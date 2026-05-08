import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAgents } from "../hooks/useAgents";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EmiratesIdScan from "./EmiratesIdScan";
import { EmiratesIdFields } from "../utils/emiratesIdOcr";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface BrokerCompany { id: string; name: string; }
interface BrokerAgent   { id: string; name: string; }
interface UnitOption    { id: string; unitNumber: string; type: string; price: number; floor: number; }

const inp = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-colors";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const BLANK = {
  firstName: "", lastName: "", phone: "", email: "", nationality: "",
  source: "DIRECT", budget: "", assignedAgentId: "", notes: "",
  brokerCompanyId: "", brokerAgentId: "",
  consent: false,
  // SPA / KYC fields — optional at lead creation, filled in before SPA generation
  address: "", emiratesId: "", passportNumber: "", companyRegistrationNumber: "",
  authorizedSignatory: "", sourceOfFunds: "",
};

export default function LeadFormModal({ onClose, onCreated }: Props) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const { data: agents = [] } = useAgents();

  const [form, setForm]              = useState(BLANK);
  const [brokerCompanies, setBCs]    = useState<BrokerCompany[]>([]);
  const [brokerAgents, setBAs]       = useState<BrokerAgent[]>([]);
  const [availableUnits, setUnits]   = useState<UnitOption[]>([]);
  const [selectedUnitIds, setSelected] = useState<Set<string>>(new Set());
  const [primaryUnitId, setPrimary]  = useState<string>("");
  const [unitSearch, setUnitSearch]  = useState("");
  const [showUnits, setShowUnits]    = useState(false);
  const [submitting, setSubmitting]  = useState(false);
  const [error, setError]            = useState<string | null>(null);
  const [dirty, setDirty]            = useState(false);

  useEffect(() => { firstNameRef.current?.focus(); }, []);
  useEffect(() => {
    axios.get("/api/brokers/companies").then((r) => setBCs(r.data || [])).catch(() => {});
    axios.get("/api/units", { params: { status: "AVAILABLE", limit: 200 } })
      .then((r) => setUnits(r.data?.data ?? r.data ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!form.brokerCompanyId) { setBAs([]); return; }
    axios.get(`/api/brokers/companies/${form.brokerCompanyId}/agents`)
      .then((r) => setBAs(r.data || [])).catch(() => setBAs([]));
  }, [form.brokerCompanyId]);

  const set = (patch: Partial<typeof BLANK>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const applyEmiratesId = (fields: EmiratesIdFields) => {
    const patch: Partial<typeof BLANK> = {};
    if (fields.fullName) {
      const parts = fields.fullName.split(/\s+/);
      patch.firstName = parts[0] || "";
      patch.lastName = parts.slice(1).join(" ") || "";
    }
    if (fields.nationality) patch.nationality = fields.nationality;
    if (Object.keys(patch).length > 0) set(patch);
  };

  const toggleUnit = (unitId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
        if (primaryUnitId === unitId) setPrimary("");
      } else {
        next.add(unitId);
        if (next.size === 1) setPrimary(unitId);
      }
      return next;
    });
    setDirty(true);
  };

  const handleClose = () => {
    if (dirty && !window.confirm("Discard this new lead?")) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.consent) {
      setError("Consent is required before creating a lead.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post("/api/leads", {
        firstName:      form.firstName,
        lastName:       form.lastName,
        phone:          form.phone,
        email:          form.email || undefined,
        nationality:    form.nationality || undefined,
        source:         form.source,
        budget:         form.budget ? parseFloat(form.budget) : null,
        assignedAgentId: form.assignedAgentId || undefined,
        notes:          form.notes || undefined,
        brokerCompanyId: form.source === "BROKER" && form.brokerCompanyId ? form.brokerCompanyId : undefined,
        brokerAgentId:   form.source === "BROKER" && form.brokerAgentId   ? form.brokerAgentId   : undefined,
        consent:         form.consent,
        address:                   form.address || null,
        emiratesId:                form.emiratesId || null,
        passportNumber:            form.passportNumber || null,
        companyRegistrationNumber: form.companyRegistrationNumber || null,
        authorizedSignatory:       form.authorizedSignatory || null,
        sourceOfFunds:             form.sourceOfFunds || null,
      });

      const leadId = res.data.id;

      // Register interested units (and auto-create offers server-side)
      if (selectedUnitIds.size > 0) {
        await Promise.all(
          [...selectedUnitIds].map((unitId) =>
            axios.post(`/api/leads/${leadId}/interests`, {
              unitId,
              isPrimary: unitId === primaryUnitId,
            })
          )
        );
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  };

  const isBroker = form.source === "BROKER";

  const filteredUnits = availableUnits.filter((u) =>
    unitSearch === "" ||
    u.unitNumber.toLowerCase().includes(unitSearch.toLowerCase()) ||
    u.type.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const selectedUnits = availableUnits.filter((u) => selectedUnitIds.has(u.id));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="font-bold text-foreground text-lg">New Lead</h2>
            <p className="text-muted-foreground text-xs mt-0.5">Fields marked * are required</p>
          </div>
        </div>

        <form id="lead-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Emirates ID quick-scan (optional) */}
          <EmiratesIdScan onExtracted={applyEmiratesId} />

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>First Name *</label>
              <input
                ref={firstNameRef} required
                value={form.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                className={inp}
                placeholder="Ahmed"
              />
            </div>
            <div>
              <label className={lbl}>Last Name *</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
                className={inp}
                placeholder="Al Mansouri"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={lbl}>Phone *</label>
            <div className="relative">
              <input
                required type="tel"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                className={inp + " pr-24"}
                placeholder="+971 50 000 0000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">UAE format</span>
            </div>
          </div>

          {/* Email + Nationality */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                className={inp}
                placeholder="optional"
              />
            </div>
            <div>
              <label className={lbl}>Nationality</label>
              <input
                value={form.nationality}
                onChange={(e) => set({ nationality: e.target.value })}
                className={inp}
                placeholder="optional"
              />
            </div>
          </div>

          {/* Source + Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Lead Source *</label>
              <select
                required
                value={form.source}
                onChange={(e) => set({ source: e.target.value, brokerCompanyId: "", brokerAgentId: "" })}
                className={inp}
              >
                <option value="DIRECT">Direct</option>
                <option value="BROKER">Broker</option>
                <option value="WEBSITE">Website</option>
                <option value="REFERRAL">Referral</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Budget (AED)</label>
              <input
                type="number" min="0" step="1000"
                value={form.budget}
                onChange={(e) => set({ budget: e.target.value })}
                className={inp}
                placeholder="optional"
              />
            </div>
          </div>

          {/* Broker fields — only when source = BROKER */}
          {isBroker && (
            <div className="space-y-3 border border-purple-100 bg-purple-50/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Broker Details</p>
              <div>
                <label className={lbl}>Broker Company</label>
                <select
                  value={form.brokerCompanyId}
                  onChange={(e) => set({ brokerCompanyId: e.target.value, brokerAgentId: "" })}
                  className={inp}
                >
                  <option value="">Select company…</option>
                  {brokerCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    {brokerAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Assigned agent */}
          <div>
            <label className={lbl}>Assigned Sales Agent *</label>
            <select
              required
              value={form.assignedAgentId}
              onChange={(e) => set({ assignedAgentId: e.target.value })}
              className={inp}
            >
              <option value="">Select agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={lbl}>Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Any additional context…"
              className={inp + " resize-none"}
            />
          </div>

          {/* KYC / SPA particulars — optional at lead creation, required before SPA generation */}
          <details className="border border-slate-200 rounded-lg">
            <summary className="px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              KYC & SPA particulars
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">
              <div>
                <label className={lbl}>Residential Address</label>
                <input
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  placeholder="Country, city, neighbourhood, building, flat #"
                  className={inp}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                  placeholder="e.g. Salary, Husband Savings, Inheritance"
                  className={inp}
                />
              </div>
            </div>
          </details>

          {/* Unit Interests */}
          <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Interested Units
                {selectedUnitIds.size > 0 && (
                  <span className="ml-2 bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">
                    {selectedUnitIds.size}
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowUnits((v) => !v)}
                className="text-xs text-emerald-700 font-semibold hover:text-emerald-900"
              >
                {showUnits ? "− Hide" : "+ Add Units"}
              </button>
            </div>

            {/* Selected unit chips */}
            {selectedUnits.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUnits.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${
                      primaryUnitId === u.id
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPrimary(u.id)}
                      title="Set as primary interest"
                      className="flex items-center gap-1"
                    >
                      {primaryUnitId === u.id && <span className="text-[10px]">★</span>}
                      {u.unitNumber} · {u.type.replace(/_/g, " ")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleUnit(u.id)}
                      className="opacity-60 hover:opacity-100 ml-0.5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showUnits && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search by unit number or type…"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-emerald-400"
                />
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-50">
                  {filteredUnits.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No available units found</p>
                  ) : (
                    filteredUnits.map((u) => {
                      const checked = selectedUnitIds.has(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUnit(u.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-slate-800">{u.unitNumber}</span>
                            <span className="text-xs text-slate-400 ml-2">{u.type.replace(/_/g, " ")} · Floor {u.floor}</span>
                          </div>
                          <span className="text-xs font-bold text-blue-600 flex-shrink-0">
                            AED {u.price.toLocaleString()}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedUnitIds.size > 0 && (
                  <p className="text-[10px] text-slate-400">
                    Click a selected unit above to set it as the primary interest (★)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Consent */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => set({ consent: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                The lead has consented to being contacted about properties and consents to data
                processing under our privacy policy. <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3 flex-shrink-0">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
          <Button form="lead-form" type="submit" className="flex-1" disabled={submitting}>
            {submitting ? "Creating…" : "Create Lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
