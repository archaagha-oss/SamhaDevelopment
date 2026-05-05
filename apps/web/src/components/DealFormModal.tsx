import { useState, useEffect, useRef } from "react";
import axios from "axios";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultLeadId?: string;
}

interface Lead    { id: string; firstName: string; lastName: string; phone: string; }
interface Project { id: string; name: string; }
interface Unit    { id: string; unitNumber: string; type: string; floor: number; area: number; price: number; view: string; }
interface Milestone { label: string; percentage: number; isDLDFee: boolean; isAdminFee: boolean; triggerType: string; }
interface PaymentPlan { id: string; name: string; description?: string; milestones?: Milestone[]; }
interface BrokerCompany { id: string; name: string; agents: { id: string; name: string }[]; }

const inp = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const lbl = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

const STEPS = ["Lead", "Unit & Price", "Payment Plan", "Broker & Incentives"] as const;

function fmtArea(a: number) { return `${a.toLocaleString()} sqft`; }

export default function DealFormModal({ onClose, onCreated, defaultLeadId }: Props) {
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [leadId,       setLeadId]       = useState(defaultLeadId ?? "");
  const [leadSearch,   setLeadSearch]   = useState("");
  const [projectId,    setProjectId]    = useState("");
  const [unitId,       setUnitId]       = useState("");
  const [salePrice,    setSalePrice]    = useState("");
  const [discount,     setDiscount]     = useState("");
  const [paymentPlanId, setPaymentPlanId] = useState("");
  const [brokerCompanyId, setBrokerCompanyId] = useState("");
  const [brokerAgentId,   setBrokerAgentId]   = useState("");
  const [commissionRateOverride, setCommissionRateOverride] = useState("");
  const [adminFeeWaived, setAdminFeeWaived] = useState(false);
  const [adminFeeWaivedReason, setAdminFeeWaivedReason] = useState("");
  const [dldPaidBy,    setDldPaidBy]    = useState<"BUYER" | "DEVELOPER">("BUYER");
  const [dldWaivedReason, setDldWaivedReason] = useState("");

  // Data
  const [leads,          setLeads]          = useState<Lead[]>([]);
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [units,          setUnits]          = useState<Unit[]>([]);
  const [paymentPlans,   setPaymentPlans]   = useState<PaymentPlan[]>([]);
  const [brokerCompanies, setBrokerCompanies] = useState<BrokerCompany[]>([]);
  const [loadingUnits,   setLoadingUnits]   = useState(false);

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

  // Auto-fill price from selected unit
  const selectedUnit = units.find((u) => u.id === unitId);
  useEffect(() => {
    if (selectedUnit && !salePrice) setSalePrice(String(selectedUnit.price));
  }, [selectedUnit]);

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
    true, // broker step is optional
  ];

  const handleClose = () => {
    if (dirty && !window.confirm("Discard unsaved deal?")) return;
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await axios.post("/api/deals", {
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
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create deal");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLead = leads.find((l) => l.id === leadId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-lg">New Deal</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none transition-colors">×</button>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => {
              const done    = i < step;
              const current = i === step;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => done && setStep(i)}
                    disabled={!done}
                    className="flex flex-col items-center gap-1 group disabled:cursor-default"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                      done    ? "bg-blue-600 border-blue-600 text-white" :
                      current ? "bg-white border-blue-600 text-blue-600" :
                                "bg-slate-100 border-slate-200 text-slate-400"
                    }`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold whitespace-nowrap ${current ? "text-blue-700" : done ? "text-blue-500" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < step ? "bg-blue-500" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 0 — Lead */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Who is this deal for?</p>
                <p className="text-xs text-slate-400 mb-4">Select the lead that will become the buyer.</p>
              </div>
              <div>
                <label className={lbl}>Search leads</label>
                <input
                  ref={(el) => { firstFieldRef.current = el; }}
                  autoFocus
                  type="text"
                  placeholder="Name or phone number…"
                  value={leadSearch}
                  onChange={(e) => { setLeadSearch(e.target.value); setDirty(true); }}
                  className={inp}
                />
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {filteredLeads.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No leads found</p>
                ) : filteredLeads.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setLeadId(l.id); setDirty(true); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-50 last:border-0 ${
                      leadId === l.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${leadId === l.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                      {l.firstName[0]}{l.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{l.firstName} {l.lastName}</p>
                      <p className="text-xs text-slate-400">{l.phone}</p>
                    </div>
                    {leadId === l.id && <span className="ml-auto text-blue-600 text-sm">✓</span>}
                  </button>
                ))}
              </div>
              {leadId && !leadSearch && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {selectedLead?.firstName[0]}{selectedLead?.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{selectedLead?.firstName} {selectedLead?.lastName}</p>
                    <p className="text-xs text-blue-600">{selectedLead?.phone}</p>
                  </div>
                  <button onClick={() => { setLeadId(""); setLeadSearch(""); }} className="ml-auto text-blue-400 hover:text-blue-600 text-lg leading-none">×</button>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Unit & Price */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Which unit?</p>
                <p className="text-xs text-slate-400 mb-4">Select a project, then pick an available unit.</p>
              </div>

              <div>
                <label className={lbl}>Project</label>
                <select
                  autoFocus
                  value={projectId}
                  onChange={(e) => { setProjectId(e.target.value); setUnitId(""); setSalePrice(""); setDirty(true); }}
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
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : units.length === 0 ? (
                    <div className="border border-slate-200 rounded-xl px-4 py-6 text-center">
                      <p className="text-sm text-slate-400">No available units in this project</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      {units.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setUnitId(u.id); setSalePrice(String(u.price)); setDirty(true); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-50 last:border-0 ${
                            unitId === u.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${unitId === u.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                            {u.unitNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{u.type.replace(/_/g, " ")} · Floor {u.floor}</p>
                            <p className="text-xs text-slate-400">{fmtArea(u.area)} · {u.view}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-slate-800">AED {u.price.toLocaleString()}</p>
                          </div>
                          {unitId === u.id && <span className="text-blue-600 text-sm ml-1">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {unitId && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className={lbl}>Sale Price (AED)</label>
                    <input
                      required type="number" min="1" step="1"
                      value={salePrice}
                      onChange={(e) => { setSalePrice(e.target.value); setDirty(true); }}
                      className={inp}
                    />
                    {selectedUnit && parseFloat(salePrice) !== selectedUnit.price && (
                      <p className="text-xs text-slate-400 mt-1">Listed: AED {selectedUnit.price.toLocaleString()}</p>
                    )}
                  </div>
                  <div>
                    <label className={lbl}>Discount (AED)</label>
                    <input
                      type="number" min="0" step="1" placeholder="0"
                      value={discount}
                      onChange={(e) => { setDiscount(e.target.value); setDirty(true); }}
                      className={inp}
                    />
                  </div>
                </div>
              )}

              {unitId && parseFloat(salePrice) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Sale Price</p>
                    <p className="font-bold text-slate-800">AED {(parseFloat(salePrice) || 0).toLocaleString()}</p>
                  </div>
                  {parseFloat(discount) > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Discount</p>
                      <p className="font-bold text-emerald-600">− AED {(parseFloat(discount) || 0).toLocaleString()}</p>
                    </div>
                  )}
                  <div className={parseFloat(discount) > 0 ? "" : "col-span-2"}>
                    <p className="text-xs text-slate-400 mb-0.5">Net Price</p>
                    <p className="font-bold text-blue-700 text-base">AED {netPrice.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Payment Plan */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Choose a payment plan</p>
                <p className="text-xs text-slate-400 mb-4">This defines when and how the buyer pays. Milestone amounts are calculated from the net price.</p>
              </div>

              <div className="space-y-2">
                {paymentPlans.filter((p: any) => p.isActive !== false).map((plan) => {
                  const isSelected = paymentPlanId === plan.id;
                  return (
                    <div key={plan.id} className={`border-2 rounded-xl overflow-hidden transition-all ${isSelected ? "border-blue-500 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                      <button
                        type="button"
                        onClick={() => { setPaymentPlanId(plan.id); setDirty(true); }}
                        className="w-full flex items-center gap-4 px-4 py-3 text-left"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                          {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{plan.name}</p>
                          {plan.description && <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>}
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {plan.milestones?.length ?? 0} milestones
                        </span>
                      </button>

                      {/* Milestone preview — always visible when selected */}
                      {isSelected && plan.milestones && plan.milestones.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left">
                                <th className="px-4 py-2 font-semibold text-slate-500">Milestone</th>
                                <th className="px-4 py-2 font-semibold text-slate-500 text-right">%</th>
                                {netPrice > 0 && <th className="px-4 py-2 font-semibold text-slate-500 text-right">Amount</th>}
                                <th className="px-4 py-2 font-semibold text-slate-500">Trigger</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {plan.milestones.map((m, i) => {
                                const amt = netPrice > 0 ? Math.round(netPrice * m.percentage / 100) : null;
                                return (
                                  <tr key={i}>
                                    <td className="px-4 py-2 text-slate-700 font-medium">
                                      {m.label}
                                      {m.isDLDFee  && <span className="ml-1 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px]">DLD</span>}
                                      {m.isAdminFee && <span className="ml-1 px-1 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px]">Admin</span>}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-700">{m.percentage}%</td>
                                    {netPrice > 0 && (
                                      <td className="px-4 py-2 text-right font-bold text-blue-700">
                                        {amt !== null ? `AED ${amt.toLocaleString()}` : "—"}
                                      </td>
                                    )}
                                    <td className="px-4 py-2 text-slate-400">{m.triggerType?.replace(/_/g, " ")}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {netPrice <= 0 && (
                            <p className="px-4 py-2 text-xs text-amber-600 bg-amber-50 border-t border-amber-100">
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
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Broker & deal incentives</p>
                <p className="text-xs text-slate-400 mb-4">All fields on this step are optional. Skip if this is a direct sale.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Broker Company</label>
                  <select
                    value={brokerCompanyId}
                    onChange={(e) => { setBrokerCompanyId(e.target.value); setBrokerAgentId(""); setDirty(true); }}
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
                    onChange={(e) => { setBrokerAgentId(e.target.value); setDirty(true); }}
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
                    type="number" step="0.1" min="0" max="20"
                    placeholder="Leave blank to use company's default rate"
                    value={commissionRateOverride}
                    onChange={(e) => setCommissionRateOverride(e.target.value)}
                    className={inp}
                  />
                </div>
              )}

              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fee Overrides</p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setAdminFeeWaived((v) => !v)}
                    className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${adminFeeWaived ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${adminFeeWaived ? "left-4" : "left-0.5"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Waive Admin Fee</p>
                    {adminFeeWaived && (
                      <input
                        autoFocus
                        placeholder="Reason for admin fee waiver…"
                        value={adminFeeWaivedReason}
                        onChange={(e) => setAdminFeeWaivedReason(e.target.value)}
                        className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                      />
                    )}
                  </div>
                </label>

                <div>
                  <label className={lbl}>DLD Fee Paid By</label>
                  <div className="flex gap-2">
                    {(["BUYER", "DEVELOPER"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDldPaidBy(opt)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                          dldPaidBy === opt ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
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
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 space-y-2 text-sm">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Deal Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <div><span className="text-slate-500">Buyer</span></div>
                  <div className="font-semibold text-slate-800">{selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : "—"}</div>
                  <div><span className="text-slate-500">Unit</span></div>
                  <div className="font-semibold text-slate-800">{selectedUnit ? `${selectedUnit.unitNumber} · Fl.${selectedUnit.floor}` : "—"}</div>
                  <div><span className="text-slate-500">Net Price</span></div>
                  <div className="font-bold text-blue-700">AED {netPrice.toLocaleString()}</div>
                  <div><span className="text-slate-500">Payment Plan</span></div>
                  <div className="font-semibold text-slate-800">{selectedPlan?.name || "—"}</div>
                  {brokerCompanyId && (
                    <>
                      <div><span className="text-slate-500">Broker</span></div>
                      <div className="font-semibold text-slate-800">{selectedCompany?.name}</div>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 text-sm transition-colors"
          >
            Cancel
          </button>
          <div className="flex-1 flex justify-end gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 text-sm transition-colors"
              >
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance[step]}
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !canAdvance.slice(0, 3).every(Boolean)}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Deal ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
