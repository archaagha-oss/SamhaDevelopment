import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { DetailPageLayout } from "../components/layout";
import { Button } from "@/components/ui/button";

// DealCreatePage — 4-step wizard for creating a deal at /deals/new.
// Replaces DealFormModal. Same logic, same step gating, just on a real route.
//
// Pre-select a lead via ?leadId=... — preserves the defaultLeadId behavior the
// modal had via its prop, but works as a deep link from anywhere in the app.

interface Lead    { id: string; firstName: string; lastName: string; phone: string }
interface Project { id: string; name: string }
interface Unit    { id: string; unitNumber: string; type: string; floor: number; area: number; price: number; view: string }
interface Milestone   { label: string; percentage: number; isDLDFee: boolean; isAdminFee: boolean; triggerType: string }
interface PaymentPlan { id: string; name: string; description?: string; isActive?: boolean; milestones?: Milestone[] }
interface BrokerCompany { id: string; name: string; agents: { id: string; name: string }[] }

const STEPS = ["Lead", "Unit & Price", "Payment Plan", "Broker & Incentives"] as const;

const inp = "w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide";

const fmtArea = (a: number) => `${a.toLocaleString()} sqft`;

const dealsCrumbs = [{ label: "Home", path: "/" }, { label: "Deals", path: "/deals" }];

export default function DealCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultLeadId = searchParams.get("leadId") ?? "";

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leadId,                 setLeadId]                 = useState(defaultLeadId);
  const [leadSearch,             setLeadSearch]             = useState("");
  const [projectId,              setProjectId]              = useState("");
  const [unitId,                 setUnitId]                 = useState("");
  const [salePrice,              setSalePrice]              = useState("");
  const [discount,               setDiscount]               = useState("");
  const [paymentPlanId,          setPaymentPlanId]          = useState("");
  const [brokerCompanyId,        setBrokerCompanyId]        = useState("");
  const [brokerAgentId,          setBrokerAgentId]          = useState("");
  const [commissionRateOverride, setCommissionRateOverride] = useState("");
  const [adminFeeWaived,         setAdminFeeWaived]         = useState(false);
  const [adminFeeWaivedReason,   setAdminFeeWaivedReason]   = useState("");
  const [dldPaidBy,              setDldPaidBy]              = useState<"BUYER" | "DEVELOPER">("BUYER");
  const [dldWaivedReason,        setDldWaivedReason]        = useState("");

  const [leads,           setLeads]           = useState<Lead[]>([]);
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [units,           setUnits]           = useState<Unit[]>([]);
  const [paymentPlans,    setPaymentPlans]    = useState<PaymentPlan[]>([]);
  const [brokerCompanies, setBrokerCompanies] = useState<BrokerCompany[]>([]);
  const [loadingUnits,    setLoadingUnits]    = useState(false);

  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    axios.get("/api/leads", { params: { page: 1, limit: 500 } }).then((r) => setLeads(r.data.data || [])).catch(() => {});
    axios.get("/api/projects").then((r) => setProjects(r.data.data || r.data || [])).catch(() => {});
    axios.get("/api/payment-plans").then((r) => setPaymentPlans(r.data || [])).catch(() => {});
    axios.get("/api/brokers/companies").then((r) => setBrokerCompanies(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) { setUnits([]); setUnitId(""); return; }
    setLoadingUnits(true);
    axios.get("/api/units", { params: { projectId, status: "AVAILABLE", limit: 500 } })
      .then((r) => setUnits(r.data.data || []))
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [projectId]);

  const selectedUnit = units.find((u) => u.id === unitId);
  useEffect(() => {
    if (selectedUnit && !salePrice) setSalePrice(String(selectedUnit.price));
  }, [selectedUnit]);

  const selectedLead    = leads.find((l) => l.id === leadId);
  const selectedPlan    = paymentPlans.find((p) => p.id === paymentPlanId);
  const selectedCompany = brokerCompanies.find((c) => c.id === brokerCompanyId);
  const brokerAgents    = selectedCompany?.agents ?? [];
  const netPrice        = (parseFloat(salePrice) || 0) - (parseFloat(discount) || 0);

  const filteredLeads = leads.filter((l) => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) || l.phone.includes(q);
  });

  const canAdvance = [
    leadId.length > 0,
    unitId.length > 0 && parseFloat(salePrice) > 0,
    paymentPlanId.length > 0,
    true,
  ];

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const r = await axios.post("/api/deals", {
        leadId,
        unitId,
        salePrice:              parseFloat(salePrice),
        discount:               parseFloat(discount) || 0,
        paymentPlanId,
        brokerCompanyId:        brokerCompanyId || undefined,
        brokerAgentId:          brokerAgentId || undefined,
        commissionRateOverride: brokerCompanyId && commissionRateOverride ? parseFloat(commissionRateOverride) : undefined,
        adminFeeWaived:         adminFeeWaived || undefined,
        adminFeeWaivedReason:   adminFeeWaived ? adminFeeWaivedReason || undefined : undefined,
        dldPaidBy:              dldPaidBy !== "BUYER" ? dldPaidBy : undefined,
        dldWaivedReason:        dldPaidBy === "DEVELOPER" ? dldWaivedReason || undefined : undefined,
      });
      const newId = r.data?.id;
      toast.success("Deal created");
      navigate(newId ? `/deals/${newId}` : "/deals");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create deal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DetailPageLayout
      crumbs={[...dealsCrumbs, { label: "New deal" }]}
      title="Create deal"
      subtitle="4-step wizard: lead → unit → payment plan → broker & incentives"
      actions={
        <>
          <Button type="button" variant="secondary" onClick={() => navigate("/deals")} disabled={submitting}>
            Cancel
          </Button>
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
              ← Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance[step]}
            >
              Next →
            </Button>
          ) : (
            <Button
              type="button"
              variant="success"
              onClick={submit}
              disabled={submitting || !canAdvance.slice(0, 3).every(Boolean)}
            >
              {submitting ? "Creating…" : "Create deal"}
            </Button>
          )}
        </>
      }
      hero={
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => {
              const done    = i < step;
              const current = i === step;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => done && setStep(i)}
                    disabled={!done}
                    className="flex flex-col items-center gap-1 group disabled:cursor-default"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                      done    ? "bg-primary border-primary text-primary-foreground" :
                      current ? "bg-background border-primary text-primary" :
                                "bg-muted border-border text-muted-foreground"
                    }`}>
                      {done ? <Check className="size-4" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold whitespace-nowrap ${
                      current ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"
                    }`}>
                      {label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < step ? "bg-primary/70" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      }
      main={
        <>
          {/* Step 0 — Lead */}
          {step === 0 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Who is this deal for?</p>
                <p className="text-xs text-muted-foreground">Select the lead that will become the buyer.</p>
              </div>
              <div>
                <label className={lbl}>Search leads</label>
                <input
                  ref={(el) => { firstFieldRef.current = el; }}
                  autoFocus
                  type="text"
                  placeholder="Name or phone number…"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className={inp}
                />
              </div>
              <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {filteredLeads.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No leads found</p>
                ) : filteredLeads.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLeadId(l.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-0 ${
                      leadId === l.id ? "bg-info-soft border-l-4 border-l-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      leadId === l.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {l.firstName[0]}{l.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{l.firstName} {l.lastName}</p>
                      <p className="text-xs text-muted-foreground">{l.phone}</p>
                    </div>
                    {leadId === l.id && <Check className="ml-auto size-4 text-primary" />}
                  </button>
                ))}
              </div>
              {leadId && !leadSearch && selectedLead && (
                <div className="bg-info-soft border border-primary/40 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {selectedLead.firstName[0]}{selectedLead.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-info-soft-foreground">{selectedLead.firstName} {selectedLead.lastName}</p>
                    <p className="text-xs text-primary">{selectedLead.phone}</p>
                  </div>
                  <button type="button" onClick={() => { setLeadId(""); setLeadSearch(""); }} className="ml-auto text-primary hover:text-primary/80 text-lg leading-none">×</button>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Unit & Price */}
          {step === 1 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Which unit?</p>
                <p className="text-xs text-muted-foreground">Select a project, then pick an available unit.</p>
              </div>
              <div>
                <label className={lbl}>Project</label>
                <select
                  autoFocus
                  value={projectId}
                  onChange={(e) => { setProjectId(e.target.value); setUnitId(""); setSalePrice(""); }}
                  className={inp}
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {projectId && (
                <div>
                  <label className={lbl}>
                    Available Unit {loadingUnits ? "— loading…" : `(${units.length} available)`}
                  </label>
                  {loadingUnits ? (
                    <div className="flex items-center justify-center h-20">
                      <div className="w-5 h-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : units.length === 0 ? (
                    <div className="border border-border rounded-xl px-4 py-6 text-center">
                      <p className="text-sm text-muted-foreground">No available units in this project</p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      {units.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setUnitId(u.id); setSalePrice(String(u.price)); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-0 ${
                            unitId === u.id ? "bg-info-soft border-l-4 border-l-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            unitId === u.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}>
                            {u.unitNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{u.type.replace(/_/g, " ")} · Floor {u.floor}</p>
                            <p className="text-xs text-muted-foreground">{fmtArea(u.area)} · {u.view}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-foreground tabular-nums">AED {u.price.toLocaleString()}</p>
                          </div>
                          {unitId === u.id && <Check className="size-4 text-primary ml-1" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {unitId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className={lbl}>Sale Price (AED)</label>
                    <input
                      required type="number" min={1} step={1}
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className={inp}
                    />
                    {selectedUnit && parseFloat(salePrice) !== selectedUnit.price && (
                      <p className="text-xs text-muted-foreground mt-1">Listed: AED {selectedUnit.price.toLocaleString()}</p>
                    )}
                  </div>
                  <div>
                    <label className={lbl}>Discount (AED)</label>
                    <input
                      type="number" min={0} step={1} placeholder="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className={inp}
                    />
                  </div>
                </div>
              )}

              {unitId && parseFloat(salePrice) > 0 && (
                <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Sale Price</p>
                    <p className="font-bold text-foreground tabular-nums">AED {(parseFloat(salePrice) || 0).toLocaleString()}</p>
                  </div>
                  {parseFloat(discount) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Discount</p>
                      <p className="font-bold text-success tabular-nums">− AED {(parseFloat(discount) || 0).toLocaleString()}</p>
                    </div>
                  )}
                  <div className={parseFloat(discount) > 0 ? "" : "col-span-2"}>
                    <p className="text-xs text-muted-foreground mb-0.5">Net Price</p>
                    <p className="font-bold text-primary text-base tabular-nums">AED {netPrice.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Payment Plan */}
          {step === 2 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Choose a payment plan</p>
                <p className="text-xs text-muted-foreground">
                  This defines when and how the buyer pays. Milestone amounts are calculated from the net price.
                </p>
              </div>
              <div className="space-y-2">
                {paymentPlans.filter((p) => p.isActive !== false).map((plan) => {
                  const isSelected = paymentPlanId === plan.id;
                  return (
                    <div key={plan.id} className={`border-2 rounded-xl overflow-hidden transition-all ${isSelected ? "border-primary/40 shadow-sm" : "border-border hover:border-border"}`}>
                      <button
                        type="button"
                        onClick={() => setPaymentPlanId(plan.id)}
                        className="w-full flex items-center gap-4 px-4 py-3 text-left"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? "border-primary/40 bg-primary" : "border-border"
                        }`}>
                          {isSelected && <Check className="size-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{plan.name}</p>
                          {plan.description && <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {plan.milestones?.length ?? 0} milestones
                        </span>
                      </button>

                      {isSelected && plan.milestones && plan.milestones.length > 0 && (
                        <div className="border-t border-border bg-muted/50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left">
                                <th className="px-4 py-2 font-semibold text-muted-foreground">Milestone</th>
                                <th className="px-4 py-2 font-semibold text-muted-foreground text-right">%</th>
                                {netPrice > 0 && <th className="px-4 py-2 font-semibold text-muted-foreground text-right">Amount</th>}
                                <th className="px-4 py-2 font-semibold text-muted-foreground">Trigger</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {plan.milestones.map((m, i) => {
                                const amt = netPrice > 0 ? Math.round(netPrice * m.percentage / 100) : null;
                                return (
                                  <tr key={i}>
                                    <td className="px-4 py-2 text-foreground font-medium">
                                      {m.label}
                                      {m.isDLDFee  && <span className="ml-1 px-1 py-0.5 rounded bg-warning-soft text-warning text-[10px]">DLD</span>}
                                      {m.isAdminFee && <span className="ml-1 px-1 py-0.5 rounded bg-info-soft text-primary text-[10px]">Admin</span>}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-foreground tabular-nums">{m.percentage}%</td>
                                    {netPrice > 0 && (
                                      <td className="px-4 py-2 text-right font-bold text-primary tabular-nums">
                                        {amt !== null ? `AED ${amt.toLocaleString()}` : "—"}
                                      </td>
                                    )}
                                    <td className="px-4 py-2 text-muted-foreground">{m.triggerType?.replace(/_/g, " ")}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {netPrice <= 0 && (
                            <p className="px-4 py-2 text-xs text-warning bg-warning-soft border-t border-warning/30">
                              Set sale price in step 2 to see AED amounts
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3 — Broker & Incentives */}
          {step === 3 && (
            <>
              <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Broker & deal incentives</p>
                  <p className="text-xs text-muted-foreground">All fields on this step are optional. Skip if this is a direct sale.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Broker Company</label>
                    <select
                      value={brokerCompanyId}
                      onChange={(e) => { setBrokerCompanyId(e.target.value); setBrokerAgentId(""); }}
                      className={inp}
                    >
                      <option value="">None — direct sale</option>
                      {brokerCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Broker Agent</label>
                    <select
                      value={brokerAgentId}
                      onChange={(e) => setBrokerAgentId(e.target.value)}
                      disabled={!brokerCompanyId}
                      className={inp}
                    >
                      <option value="">Select agent…</option>
                      {brokerAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                {brokerCompanyId && (
                  <div>
                    <label className={lbl}>Commission Rate Override (%)</label>
                    <input
                      type="number" step={0.1} min={0} max={20}
                      placeholder="Leave blank to use company's default rate"
                      value={commissionRateOverride}
                      onChange={(e) => setCommissionRateOverride(e.target.value)}
                      className={inp}
                    />
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Fee overrides</p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setAdminFeeWaived((v) => !v)}
                    className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${adminFeeWaived ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-card rounded-full shadow transition-all ${adminFeeWaived ? "left-4" : "left-0.5"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Waive Admin Fee</p>
                    {adminFeeWaived && (
                      <input
                        autoFocus
                        placeholder="Reason for admin fee waiver…"
                        value={adminFeeWaivedReason}
                        onChange={(e) => setAdminFeeWaivedReason(e.target.value)}
                        className="mt-1.5 w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                      />
                    )}
                  </div>
                </label>

                <div>
                  <label className={lbl}>DLD Fee Paid By</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {(["BUYER", "DEVELOPER"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDldPaidBy(opt)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                          dldPaidBy === opt ? "border-primary/40 bg-info-soft text-primary" : "border-border text-muted-foreground hover:border-border"
                        }`}
                      >
                        {opt === "BUYER" ? "Buyer pays" : "Developer pays (waived for buyer)"}
                      </button>
                    ))}
                  </div>
                  {dldPaidBy === "DEVELOPER" && (
                    <input
                      className={`${inp} mt-2`}
                      placeholder="Reason for DLD waiver…"
                      value={dldWaivedReason}
                      onChange={(e) => setDldWaivedReason(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Summary card */}
              <div className="bg-info-soft border border-primary/40 rounded-xl px-5 py-4 space-y-2 text-sm">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-3">Deal summary</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <div><span className="text-muted-foreground">Buyer</span></div>
                  <div className="font-semibold text-foreground">
                    {selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : "—"}
                  </div>
                  <div><span className="text-muted-foreground">Unit</span></div>
                  <div className="font-semibold text-foreground">
                    {selectedUnit ? `${selectedUnit.unitNumber} · Fl. ${selectedUnit.floor}` : "—"}
                  </div>
                  <div><span className="text-muted-foreground">Net Price</span></div>
                  <div className="font-bold text-primary tabular-nums">AED {netPrice.toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Payment Plan</span></div>
                  <div className="font-semibold text-foreground">{selectedPlan?.name || "—"}</div>
                  {brokerCompanyId && (
                    <>
                      <div><span className="text-muted-foreground">Broker</span></div>
                      <div className="font-semibold text-foreground">{selectedCompany?.name}</div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

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
