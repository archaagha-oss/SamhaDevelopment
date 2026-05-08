import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import Breadcrumbs from "./Breadcrumbs";
import UnitInterestPicker from "./UnitInterestPicker";
import ConversationThread, { ConversationReplyBox } from "./ConversationThread";
import { useEventStream } from "../hooks/useEventStream";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id: string; type: string; summary: string; outcome?: string;
  activityDate?: string; createdAt: string;
  direction?: string | null;
  deliveryStatus?: string | null;
  providerMessageSid?: string | null;
}

interface DealSummary {
  id: string; dealNumber: string; stage: string;
  salePrice: number; isActive: boolean;
  unit: { unitNumber: string; type: string };
}

interface CommunicationPreference {
  id: string;
  preferredChannel: string | null;
  emailOptOut: boolean;
  whatsappOptOut: boolean;
  smsOptOut: boolean;
  emailSent: number;
  whatsappSent: number;
  smsSent: number;
  emailReplies: number;
  whatsappReplies: number;
  smsReplies: number;
}

interface Lead {
  id: string; firstName: string; lastName: string; phone: string; email?: string;
  nationality?: string; source: string; budget?: number; stage: string; notes?: string;
  assignedAgent?: { id: string; name: string };
  assignedAgentId?: string;
  brokerCompany?: { id: string; name: string } | null;
  brokerAgent?: { id: string; name: string } | null;
  brokerCompanyId?: string | null;
  brokerAgentId?: string | null;
  interests: { id: string; unitId: string; isPrimary: boolean; unit: { unitNumber: string; type: string; price: number; floor: number } }[];
  deals?: DealSummary[];
  communicationPreference?: CommunicationPreference | null;
}

interface Agent        { id: string; name: string; }
interface PaymentPlan  { id: string; name: string; isActive: boolean; }
interface BrokerCompany{ id: string; name: string; }
interface BrokerAgent  { id: string; name: string; companyId: string; }
interface UnitOption   { id: string; unitNumber: string; type: string; price: number; status?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, string> = {
  CALL: "📞", EMAIL: "✉️", WHATSAPP: "💬", MEETING: "🤝",
  SITE_VISIT: "🏢", NOTE: "📝",
};

const STAGE_BADGE: Record<string, string> = {
  NEW:         "bg-slate-100 text-slate-600",
  CONTACTED:   "bg-blue-100 text-blue-700",
  QUALIFIED:   "bg-indigo-100 text-indigo-700",
  OFFER_SENT:  "bg-violet-100 text-violet-700",
  SITE_VISIT:  "bg-cyan-100 text-cyan-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  CLOSED_WON:  "bg-emerald-100 text-emerald-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
};

const DEAL_STAGE_BADGE: Record<string, string> = {
  RESERVATION_PENDING:   "bg-slate-100 text-slate-600",
  RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
  SPA_PENDING:           "bg-violet-50 text-violet-600",
  SPA_SENT:              "bg-violet-100 text-violet-700",
  SPA_SIGNED:            "bg-purple-100 text-purple-700",
  OQOOD_PENDING:         "bg-amber-100 text-amber-700",
  OQOOD_REGISTERED:      "bg-emerald-100 text-emerald-700",
  INSTALLMENTS_ACTIVE:   "bg-cyan-100 text-cyan-700",
  HANDOVER_PENDING:      "bg-orange-100 text-orange-700",
  COMPLETED:             "bg-green-100 text-green-700",
  CANCELLED:             "bg-red-100 text-red-700",
};

const SOURCE_OPTIONS = ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"] as const;

const inputCls  = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400";
const primaryBtn = "px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50";
const cancelBtn  = "px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props { leadId?: string; onBack?: () => void; }

export default function LeadProfilePage({ leadId: leadIdProp, onBack }: Props) {
  const params   = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const leadId   = leadIdProp ?? params.leadId ?? "";
  const handleBack = onBack ?? (() => navigate("/leads"));

  // Core data
  const [lead,       setLead]       = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks,      setTasks]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [quickTask,  setQuickTask]  = useState({ title: "", type: "FOLLOW_UP", dueDate: "" });
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Lookups
  const [agents,         setAgents]         = useState<Agent[]>([]);
  const [paymentPlans,   setPaymentPlans]   = useState<PaymentPlan[]>([]);
  const [brokerCompanies,setBrokerCompanies] = useState<BrokerCompany[]>([]);
  const [brokerAgents,   setBrokerAgents]   = useState<BrokerAgent[]>([]);
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);

  // Stage change
  const [validTransitions, setValidTransitions] = useState<string[]>([]);
  const [changingStage,    setChangingStage]     = useState(false);
  const [stageReason,      setStageReason]       = useState("");
  const [showStagePopover, setShowStagePopover]  = useState(false);

  // Activity log
  const [showActForm, setShowActForm] = useState(false);
  const [actType,     setActType]     = useState("CALL");
  const [summary,     setSummary]     = useState("");
  const [outcome,     setOutcome]     = useState("");
  const [followUpDate,setFollowUpDate]= useState("");
  const [submitting,  setSubmitting]  = useState(false);

  // Edit lead
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    nationality: "", source: "DIRECT", budget: "", notes: "",
    assignedAgentId: "", brokerCompanyId: "", brokerAgentId: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Unit picker (for editing interests)
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [editingUnitIds, setEditingUnitIds] = useState(new Set<string>());
  const [editingPrimaryUnitId, setEditingPrimaryUnitId] = useState("");

  // Offers
  const [offers, setOffers] = useState<{
    id: string; unitId: string; offeredPrice: number; discountAmount: number;
    status: string; createdAt: string; notes?: string;
    paymentPlan?: { id: string; name: string } | null;
    unit?: { unitNumber: string; type: string; floor: number };
  }[]>([]);

  // Offer modal (generate / revise)
  const [showOfferModal, setShowOfferModal]   = useState(false);
  const [offerModalUnit, setOfferModalUnit]   = useState("");
  const [offerForm, setOfferForm] = useState({
    offeredPrice: "", discountAmount: "0", paymentPlanId: "", expiresAt: "", notes: "",
  });
  const [revisingOffer, setRevisingOffer] = useState<string | null>(null); // offerId being revised
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Create Deal modal
  const [showCreateDealModal, setShowCreateDealModal]   = useState(false);
  const [createDealForm, setCreateDealForm]             = useState({ unitId: "", notes: "" });
  const [createDealUnits, setCreateDealUnits]           = useState<UnitOption[]>([]);
  const [loadingDealUnits, setLoadingDealUnits]         = useState(false);
  const [creatingDealQuick, setCreatingDealQuick]       = useState(false);

  // Create reservation (deal)
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealForm, setDealForm] = useState({
    unitId: "", salePrice: "", discount: "0", reservationAmount: "0", paymentPlanId: "",
    brokerCompanyId: "", brokerAgentId: "",
  });
  const [creatingDeal, setCreatingDeal] = useState(false);

  // ── Live updates: refresh activities when an inbound message lands on this lead
  useEventStream("activity.inbound", async (data: { leadId?: string | null }) => {
    if (!leadId || data?.leadId !== leadId) return;
    try {
      const r = await axios.get(`/api/leads/${leadId}/activities`);
      setActivities(r.data);
    } catch {/* ignore */}
  });

  // ── Load ────────────────────────────────────────────────────────────────────

  const reloadLead = async () => {
    const [lRes, aRes, tRes] = await Promise.all([
      axios.get(`/api/leads/${leadId}`),
      axios.get(`/api/leads/${leadId}/activities`),
      axios.get("/api/tasks", { params: { leadId, status: "PENDING" } }),
    ]);
    setLead(lRes.data);
    setActivities(aRes.data);
    setTasks(tRes.data || []);
    axios.get("/api/offers", { params: { leadId } })
      .then((r) => setOffers(r.data ?? []))
      .catch(() => {});
  };

  const completeTask = async (id: string) => {
    setCompletingTaskId(id);
    try {
      await axios.patch(`/api/tasks/${id}/complete`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setCompletingTaskId(null);
    }
  };

  const submitQuickTask = async () => {
    if (!quickTask.title.trim() || !quickTask.dueDate) return;
    setAddingTask(true);
    try {
      const res = await axios.post("/api/tasks", {
        leadId,
        title: quickTask.title,
        type: quickTask.type,
        priority: "MEDIUM",
        dueDate: new Date(quickTask.dueDate).toISOString(),
      });
      setTasks((prev) => [...prev, res.data]);
      setQuickTask({ title: "", type: "FOLLOW_UP", dueDate: "" });
    } finally {
      setAddingTask(false);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    Promise.all([
      axios.get(`/api/leads/${leadId}`),
      axios.get(`/api/leads/${leadId}/activities`),
      axios.get("/api/agents"),
      axios.get("/api/payment-plans"),
      axios.get("/api/brokers/companies"),
      axios.get("/api/tasks", { params: { leadId, status: "PENDING" } }),
      axios.get("/api/offers", { params: { leadId } }),
    ]).then(([lRes, aRes, agRes, ppRes, bcRes, tRes, oRes]) => {
      setLead(lRes.data);
      setActivities(aRes.data);
      setTasks(tRes.data || []);
      setOffers(oRes.data ?? []);
      setAgents(agRes.data?.data ?? agRes.data ?? []);
      const plans = ppRes.data?.data ?? ppRes.data ?? [];
      setPaymentPlans(Array.isArray(plans) ? plans.filter((p: PaymentPlan) => p.isActive) : []);
      setBrokerCompanies(bcRes.data?.data ?? bcRes.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    if (!lead) return;
    axios.get(`/api/leads/${lead.id}/valid-transitions`)
      .then((r) => setValidTransitions(r.data.validNext ?? []))
      .catch(() => setValidTransitions([]));
  }, [lead?.stage, lead?.id]);

  // Load broker agents when company selected in deal or edit form
  const loadBrokerAgents = (companyId: string) => {
    if (!companyId) { setBrokerAgents([]); return; }
    axios.get(`/api/brokers/companies/${companyId}/agents`)
      .then((r) => setBrokerAgents(r.data?.data ?? r.data ?? []))
      .catch(() => setBrokerAgents([]));
  };

  useEffect(() => {
    if (showEditForm && lead) {
      setEditForm({
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        phone:           lead.phone,
        email:           lead.email ?? "",
        nationality:     lead.nationality ?? "",
        source:          lead.source,
        budget:          lead.budget != null ? String(lead.budget) : "",
        notes:           lead.notes ?? "",
        assignedAgentId: lead.assignedAgent?.id ?? lead.assignedAgentId ?? "",
        brokerCompanyId: lead.brokerCompanyId ?? "",
        brokerAgentId:   lead.brokerAgentId   ?? "",
      });
      // Initialize unit picker with current interests
      const unitIds = new Set(lead.interests.map((i) => i.unitId));
      setEditingUnitIds(unitIds);
      const primaryInterest = lead.interests.find((i) => i.isPrimary);
      setEditingPrimaryUnitId(primaryInterest?.unitId ?? "");
      if (lead.brokerCompanyId) loadBrokerAgents(lead.brokerCompanyId);
    }
  }, [showEditForm]);

  useEffect(() => {
    if (showDealForm && availableUnits.length === 0) {
      axios.get("/api/units", { params: { limit: 200 } })
        .then((r) => {
          const all: UnitOption[] = r.data.data ?? r.data ?? [];
          const selectable = all.filter((u) => u.status === "AVAILABLE" || u.status === "ON_HOLD");
          setAvailableUnits(selectable);
          // Pre-select the lead's primary interested unit if it's available/on-hold
          const primaryInterest = lead?.interests.find((i) => i.isPrimary) ?? lead?.interests[0];
          if (primaryInterest) {
            const match = selectable.find((u) => u.id === primaryInterest.unitId);
            if (match) {
              setDealForm((p) => ({ ...p, unitId: match.id, salePrice: String(match.price) }));
            }
          }
        })
        .catch(console.error);
    }
  }, [showDealForm]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStageChange = async (newStage: string) => {
    if (!lead) return;
    setChangingStage(true);
    try {
      await axios.patch(`/api/leads/${lead.id}/stage`, { newStage, reason: stageReason || undefined });
      toast.success(`Lead moved to ${newStage.replace(/_/g, " ")}`);
      setShowStagePopover(false);
      setStageReason("");
      await reloadLead();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to change stage");
    } finally {
      setChangingStage(false);
    }
  };

  const handlePreferenceChange = async (changes: Partial<CommunicationPreference & { preferredChannel: string | null }>) => {
    if (!lead) return;
    try {
      const r = await axios.patch(`/api/leads/${lead.id}/communication-preference`, changes);
      setLead((prev) => prev ? { ...prev, communicationPreference: r.data } : prev);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update preference");
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`/api/leads/${leadId}/activities`, {
        type: actType, summary, outcome: outcome || undefined,
        followUpDate: followUpDate || undefined,
      });
      const aRes = await axios.get(`/api/leads/${leadId}/activities`);
      setActivities(aRes.data);
      setSummary(""); setOutcome(""); setFollowUpDate("");
      setShowActForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to log activity");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      const get = (k: keyof typeof editForm) => editForm[k];
      if (get("firstName")       !== lead.firstName)                      payload.firstName       = get("firstName");
      if (get("lastName")        !== lead.lastName)                       payload.lastName        = get("lastName");
      if (get("phone")           !== lead.phone)                          payload.phone           = get("phone");
      if (get("email")           !== (lead.email ?? ""))                  payload.email           = get("email") || null;
      if (get("nationality")     !== (lead.nationality ?? ""))            payload.nationality     = get("nationality") || null;
      if (get("source")          !== lead.source)                         payload.source          = get("source");
      if (get("notes")           !== (lead.notes ?? ""))                  payload.notes           = get("notes") || null;
      const bv = get("budget") !== "" ? parseFloat(get("budget")) : null;
      if (bv !== (lead.budget ?? null))                                   payload.budget          = bv;
      const agentId = lead.assignedAgent?.id ?? lead.assignedAgentId ?? "";
      if (get("assignedAgentId") !== agentId)                             payload.assignedAgentId = get("assignedAgentId") || null;
      if (get("brokerCompanyId") !== (lead.brokerCompanyId ?? ""))        payload.brokerCompanyId = get("brokerCompanyId") || null;
      if (get("brokerAgentId")   !== (lead.brokerAgentId ?? ""))          payload.brokerAgentId   = get("brokerAgentId")   || null;

      if (Object.keys(payload).length > 0) {
        await axios.patch(`/api/leads/${lead.id}`, payload);
      }
      toast.success("Lead updated");
      await reloadLead();
      setShowEditForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update lead");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    setConfirmDelete(true);
  };

  const doDelete = async () => {
    if (!lead) return;
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await axios.delete(`/api/leads/${lead.id}`);
      handleBack();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete lead");
      setDeleting(false);
    }
  };

  const handleUnitsChange = async (selected: Set<string>, primary: string) => {
    if (!lead) return;
    try {
      // Get current interests
      const currentInterestIds = new Set(lead.interests.map((i) => i.unitId));

      // Remove units that are no longer selected
      const toRemove = [...currentInterestIds].filter((id) => !selected.has(id));
      for (const unitId of toRemove) {
        const interest = lead.interests.find((i) => i.unitId === unitId);
        if (interest) {
          await axios.delete(`/api/leads/${lead.id}/interests/${interest.id}`);
        }
      }

      // Add new units and update primary status
      const toAdd = [...selected].filter((id) => !currentInterestIds.has(id));
      for (const unitId of toAdd) {
        await axios.post(`/api/leads/${lead.id}/interests`, {
          unitId,
          isPrimary: unitId === primary,
        });
      }

      // Update primary status for existing units if changed
      for (const unitId of [...selected].filter((id) => currentInterestIds.has(id))) {
        const interest = lead.interests.find((i) => i.unitId === unitId);
        if (interest && interest.isPrimary !== (unitId === primary)) {
          await axios.patch(`/api/leads/${lead.id}/interests/${interest.id}`, {
            isPrimary: unitId === primary,
          });
        }
      }

      toast.success("Unit interests updated");
      await reloadLead();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update unit interests");
    }
  };

  const openOfferModal = (unitId: string, existing?: typeof offers[0]) => {
    setOfferModalUnit(unitId);
    setRevisingOffer(existing?.id ?? null);
    const unit = lead?.interests.find((i) => i.unitId === unitId)?.unit;
    setOfferForm({
      offeredPrice:   existing ? String(existing.offeredPrice) : (unit ? String(unit.price) : ""),
      discountAmount: existing ? String(existing.discountAmount) : "0",
      paymentPlanId:  existing?.paymentPlan?.id ?? "",
      expiresAt:      "",
      notes:          existing?.notes ?? "",
    });
    setShowOfferModal(true);
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setSubmittingOffer(true);
    try {
      await axios.post("/api/offers", {
        leadId:        lead.id,
        unitId:        offerModalUnit,
        offeredPrice:  parseFloat(offerForm.offeredPrice),
        discountAmount: parseFloat(offerForm.discountAmount) || 0,
        paymentPlanId: offerForm.paymentPlanId || undefined,
        expiresAt:     offerForm.expiresAt || undefined,
        notes:         offerForm.notes     || undefined,
      });
      toast.success(revisingOffer ? "New offer version created" : "Offer generated");
      setShowOfferModal(false);
      setOfferForm({ offeredPrice: "", discountAmount: "0", paymentPlanId: "", expiresAt: "", notes: "" });
      setRevisingOffer(null);
      const r = await axios.get("/api/offers", { params: { leadId: lead.id } });
      setOffers(r.data ?? []);
      await reloadLead();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create offer");
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleOfferStatus = async (offerId: string, status: string, rejectedReason?: string) => {
    try {
      await axios.patch(`/api/offers/${offerId}/status`, { status, rejectedReason });
      const r = await axios.get("/api/offers", { params: { leadId } });
      setOffers(r.data ?? []);
      toast.success(`Offer ${status.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update offer");
    }
  };

  const openReservationFromOffer = (offer: typeof offers[0]) => {
    if (availableUnits.length === 0) {
      axios.get("/api/units", { params: { limit: 200 } })
        .then((r) => {
          const all: UnitOption[] = r.data.data ?? r.data ?? [];
          setAvailableUnits(all.filter((u) => u.status === "AVAILABLE" || u.status === "ON_HOLD"));
        })
        .catch(console.error);
    }
    setDealForm({
      unitId:            offer.unitId,
      salePrice:         String(offer.offeredPrice),
      discount:          String(offer.discountAmount ?? 0),
      reservationAmount: "0",
      paymentPlanId:     offer.paymentPlan?.id ?? "",
      brokerCompanyId:   "",
      brokerAgentId:     "",
    });
    setShowDealForm(true);
  };

  const handleDealUnitChange = (unitId: string) => {
    const unit = availableUnits.find((u) => u.id === unitId);
    setDealForm((p) => ({ ...p, unitId, salePrice: unit ? String(unit.price) : p.salePrice }));
  };

  const handleDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !dealForm.paymentPlanId) { toast.error("Select a payment plan"); return; }
    setCreatingDeal(true);
    try {
      await axios.post("/api/deals", {
        leadId:            lead.id,
        unitId:            dealForm.unitId,
        salePrice:         parseFloat(dealForm.salePrice),
        discount:          parseFloat(dealForm.discount) || 0,
        reservationAmount: parseFloat(dealForm.reservationAmount) || 0,
        paymentPlanId:     dealForm.paymentPlanId,
        brokerCompanyId:   dealForm.brokerCompanyId || undefined,
        brokerAgentId:     dealForm.brokerAgentId   || undefined,
      });
      setShowDealForm(false);
      setDealForm({ unitId: "", salePrice: "", discount: "0", reservationAmount: "0", paymentPlanId: "", brokerCompanyId: "", brokerAgentId: "" });
      await reloadLead();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create reservation");
    } finally {
      setCreatingDeal(false);
    }
  };

  const openCreateDealModal = async () => {
    if (!lead) return;
    setCreateDealForm({ unitId: "", notes: "" });
    setShowCreateDealModal(true);
    if (createDealUnits.length === 0) {
      setLoadingDealUnits(true);
      try {
        const r = await axios.get("/api/units", { params: { limit: 300 } });
        const all: UnitOption[] = r.data.data ?? r.data ?? [];
        const selectable = all.filter((u) => u.status === "AVAILABLE" || u.status === "ON_HOLD");
        setCreateDealUnits(selectable);
        // Pre-select from lead's primary interest
        const primary = lead.interests.find((i) => i.isPrimary) ?? lead.interests[0];
        if (primary) {
          const match = selectable.find((u) => u.id === primary.unitId);
          if (match) setCreateDealForm((p) => ({ ...p, unitId: match.id }));
        }
      } catch {
        // silently ignore — user can still type or pick
      } finally {
        setLoadingDealUnits(false);
      }
    } else {
      // Pre-select even if units already loaded
      const primary = lead.interests.find((i) => i.isPrimary) ?? lead.interests[0];
      if (primary) {
        const match = createDealUnits.find((u) => u.id === primary.unitId);
        if (match) setCreateDealForm((p) => ({ ...p, unitId: match.id }));
      }
    }
  };

  const handleCreateDealSubmit = async () => {
    if (!lead) return;
    setCreatingDealQuick(true);
    try {
      const res = await axios.post(`/api/leads/${lead.id}/create-deal`, {
        unitId: createDealForm.unitId || undefined,
        notes:  createDealForm.notes  || undefined,
      });
      setShowCreateDealModal(false);
      navigate(`/deals/${res.data.id}`);
    } catch (err: any) {
      const existingId = err.response?.data?.existingDealId;
      if (existingId) {
        toast.error("Active deal already exists for this lead — opening it now.");
        setShowCreateDealModal(false);
        navigate(`/deals/${existingId}`);
      } else {
        toast.error(err.response?.data?.error || "Unable to create deal. Try again.");
      }
    } finally {
      setCreatingDealQuick(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading || !lead) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeDeals   = lead.deals?.filter((d) => d.isActive) ?? [];
  const inactiveDeals = lead.deals?.filter((d) => !d.isActive) ?? [];

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Breadcrumbs crumbs={[
        { label: "Leads", path: "/leads" },
        { label: lead ? `${lead.firstName} ${lead.lastName}` : "Lead" },
      ]} />

      {/* Profile header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 font-bold text-xl flex-shrink-0">
              {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{lead.firstName} {lead.lastName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-slate-500">{lead.phone}</span>
                {lead.email && <span className="text-sm text-slate-400">{lead.email}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Stage badge + change popover */}
            <div className="relative">
              <button
                onClick={() => setShowStagePopover(!showStagePopover)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${STAGE_BADGE[lead.stage] || "bg-slate-100 text-slate-600"}`}
              >
                {lead.stage.replace(/_/g, " ")}
                {validTransitions.length > 0 && <span className="text-xs opacity-60">▾</span>}
              </button>
              {showStagePopover && validTransitions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-56 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-500 mb-2">Move to:</p>
                  {validTransitions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStageChange(s)}
                      disabled={changingStage}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 text-slate-700 disabled:opacity-50"
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                  <input
                    placeholder="Reason (optional)"
                    value={stageReason}
                    onChange={(e) => setStageReason(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:border-blue-400 mt-1"
                  />
                  <button
                    onClick={() => setShowStagePopover(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 mt-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setShowEditForm(true)} className="px-3 py-1.5 text-sm text-slate-600 font-medium border border-slate-200 rounded-lg hover:bg-slate-50">
              Edit
            </button>
            <button
              onClick={openCreateDealModal}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
            >
              Create Deal
            </button>
            <button onClick={() => setShowDealForm(true)} className="px-3 py-1.5 text-sm text-slate-500 font-medium border border-slate-200 rounded-lg hover:bg-slate-50">
              Advanced
            </button>
            <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm text-red-500 font-medium border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Lead info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Lead Info</h3>
            <div className="space-y-2.5">
              {[
                ["Source",      lead.source],
                ["Nationality", lead.nationality || "—"],
                ["Budget",      lead.budget ? `AED ${lead.budget.toLocaleString()}` : "—"],
                ["Agent",       lead.assignedAgent?.name || "Unassigned"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
              {lead.brokerCompany && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Broker</span>
                  <span className="font-medium text-slate-800">{lead.brokerCompany.name}</span>
                </div>
              )}
              {lead.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{lead.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Communication Preference */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Comm. Preference</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Preferred Channel</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                  value={lead.communicationPreference?.preferredChannel ?? ""}
                  onChange={(e) =>
                    handlePreferenceChange({ preferredChannel: e.target.value === "" ? null : e.target.value })
                  }
                >
                  <option value="">Auto (learn from engagement)</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                {(["email", "whatsapp", "sms"] as const).map((ch) => {
                  const optKey  = `${ch}OptOut` as "emailOptOut" | "whatsappOptOut" | "smsOptOut";
                  const sentKey = `${ch}Sent`   as "emailSent" | "whatsappSent" | "smsSent";
                  const repKey  = `${ch}Replies` as "emailReplies" | "whatsappReplies" | "smsReplies";
                  const optedOut = lead.communicationPreference?.[optKey] ?? false;
                  const sent     = lead.communicationPreference?.[sentKey] ?? 0;
                  const replies  = lead.communicationPreference?.[repKey]  ?? 0;
                  return (
                    <label key={ch} className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={optedOut}
                          onChange={(e) => handlePreferenceChange({ [optKey]: e.target.checked } as Partial<CommunicationPreference>)}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className={optedOut ? "text-slate-400 line-through" : "text-slate-700"}>
                          {ch === "email" ? "Email" : ch === "whatsapp" ? "WhatsApp" : "SMS"} opt-out
                        </span>
                      </span>
                      <span className="text-slate-400">
                        {sent}{sent > 0 ? ` · ${replies} replies` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interested units */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Interested Units</h3>
            {lead.interests.length === 0 ? (
              <p className="text-sm text-slate-400">No units linked</p>
            ) : (
              <div className="space-y-2">
                {lead.interests.map((i) => {
                  const offer = offers.find((o) => o.unitId === i.unitId && o.status === "ACTIVE");
                  return (
                    <div key={i.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-slate-800">{i.unit.unitNumber}</p>
                            {i.isPrimary && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Primary</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{i.unit.type.replace(/_/g, " ")} · Floor {i.unit.floor}</p>
                        </div>
                        <p className="text-sm font-bold text-blue-600">AED {i.unit.price.toLocaleString()}</p>
                      </div>
                      {offer ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openReservationFromOffer(offer)}
                            className="flex-1 text-center py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Create Reservation
                          </button>
                          <button
                            onClick={() => openOfferModal(i.unitId, offer)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Revise
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openOfferModal(i.unitId)}
                          className="w-full text-center py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Generate Offer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deals */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Deals <span className="text-slate-400 font-normal">({lead.deals?.length ?? 0})</span>
            </h3>
            {(!lead.deals || lead.deals.length === 0) ? (
              <p className="text-sm text-slate-400">No deals yet</p>
            ) : (
              <div className="space-y-2">
                {[...activeDeals, ...inactiveDeals].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/deals/${d.id}`)}
                    className="w-full text-left p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{d.dealNumber}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DEAL_STAGE_BADGE[d.stage] || "bg-slate-100 text-slate-600"}`}>
                        {d.stage.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Unit {d.unit.unitNumber} · {d.unit.type}
                    </p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      AED {d.salePrice.toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Offers history */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Offers <span className="text-slate-400 font-normal">({offers.length})</span>
            </h3>
            {offers.length === 0 ? (
              <p className="text-sm text-slate-400">No offers generated yet</p>
            ) : (
              <div className="space-y-2">
                {offers.map((o, idx) => {
                  const version = offers.length - idx;
                  const statusColor: Record<string, string> = {
                    ACTIVE:    "bg-blue-100 text-blue-700",
                    ACCEPTED:  "bg-emerald-100 text-emerald-700",
                    REJECTED:  "bg-red-100 text-red-700",
                    EXPIRED:   "bg-slate-100 text-slate-500",
                    WITHDRAWN: "bg-amber-100 text-amber-700",
                  };
                  return (
                    <div key={o.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">v{version} — AED {o.offeredPrice.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">
                            {(o as any).unit?.unitNumber}
                            {o.paymentPlan ? ` · ${o.paymentPlan.name}` : ""}
                            {" · "}{fmtDate(o.createdAt)}
                          </p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[o.status] || "bg-slate-100 text-slate-500"}`}>
                          {o.status}
                        </span>
                      </div>
                      {o.status === "ACTIVE" && (
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOfferStatus(o.id, "ACCEPTED")}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleOfferStatus(o.id, "REJECTED")}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-500 rounded-md hover:bg-red-600"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openOfferModal(o.unitId, o)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                          >
                            Revise
                          </button>
                          <button
                            onClick={() => handleOfferStatus(o.id, "WITHDRAWN")}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                          >
                            Withdraw
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          {/* Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tasks <span className="text-slate-400 font-normal">({tasks.length})</span>
              </h3>
              <button
                onClick={() => setAddingTask((v) => !v)}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                {addingTask ? "−" : "+ Add"}
              </button>
            </div>
            {addingTask && (
              <div className="mb-3 space-y-2">
                <input
                  type="text"
                  value={quickTask.title}
                  onChange={(e) => setQuickTask((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Task title *"
                  className={inputCls + " text-xs"}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select value={quickTask.type} onChange={(e) => setQuickTask((f) => ({ ...f, type: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none">
                    {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                  </select>
                  <input type="datetime-local" value={quickTask.dueDate}
                    onChange={(e) => setQuickTask((f) => ({ ...f, dueDate: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none" />
                </div>
                <button
                  onClick={submitQuickTask}
                  disabled={!quickTask.title.trim() || !quickTask.dueDate}
                  className="w-full py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            )}
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No open tasks</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => {
                  const isOverdue = new Date(t.dueDate) < new Date();
                  return (
                    <div key={t.id} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <button
                        onClick={() => completeTask(t.id)}
                        disabled={completingTaskId === t.id}
                        className="w-4 h-4 rounded-full border-2 border-slate-300 hover:border-blue-500 flex-shrink-0 mt-0.5 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 leading-snug">{t.title}</p>
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                          {isOverdue ? "Overdue · " : ""}{fmtDate(t.dueDate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm">Activity Timeline</h3>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{activities.length}</span>
              </div>
              <button
                onClick={() => setShowActForm(!showActForm)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
              >
                + Log Activity
              </button>
            </div>

            {showActForm && (
              <form onSubmit={handleLogActivity} className="px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"] as const).map((t) => (
                    <button
                      key={t} type="button" onClick={() => setActType(t)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        actType === t ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {ACTIVITY_ICON[t]} {t.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <textarea
                  required placeholder="Summary *" value={summary}
                  onChange={(e) => setSummary(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Outcome (optional)" value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                  />
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Follow-up date</label>
                    <input
                      type="datetime-local" value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className={primaryBtn}>
                    {submitting ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setShowActForm(false)} className={cancelBtn}>Cancel</button>
                </div>
              </form>
            )}

            <ConversationThread activities={activities} />
            <ConversationReplyBox
              leadId={lead.id}
              availableChannels={(() => {
                const out: ("EMAIL" | "WHATSAPP" | "SMS")[] = [];
                const pref = lead.communicationPreference;
                if (lead.email && !pref?.emailOptOut) out.push("EMAIL");
                if (lead.phone && !pref?.whatsappOptOut) out.push("WHATSAPP");
                if (lead.phone && !pref?.smsOptOut) out.push("SMS");
                return out;
              })()}
              onSent={async () => {
                const aRes = await axios.get(`/api/leads/${leadId}/activities`);
                setActivities(aRes.data);
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Edit Lead Modal ─────────────────────────────────────────────────────── */}
      {showEditForm && (
        <Modal title="Edit Lead" onClose={() => setShowEditForm(false)}>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
                <input required value={editForm.firstName} onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                <input required value={editForm.lastName} onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input required value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label>
                <input value={editForm.nationality} onChange={(e) => setEditForm((p) => ({ ...p, nationality: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
                <select value={editForm.source} onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))} className={inputCls}>
                  {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Budget (AED)</label>
                <input type="number" min={0} value={editForm.budget} onChange={(e) => setEditForm((p) => ({ ...p, budget: e.target.value }))} placeholder="e.g. 1500000" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned Agent</label>
              <select value={editForm.assignedAgentId} onChange={(e) => setEditForm((p) => ({ ...p, assignedAgentId: e.target.value }))} className={inputCls}>
                <option value="">— Unassigned —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {editForm.source === "BROKER" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Broker Company</label>
                  <select
                    value={editForm.brokerCompanyId}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, brokerCompanyId: e.target.value, brokerAgentId: "" }));
                      loadBrokerAgents(e.target.value);
                    }}
                    className={inputCls}
                  >
                    <option value="">— None —</option>
                    {brokerCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {brokerAgents.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Broker Agent</label>
                    <select value={editForm.brokerAgentId} onChange={(e) => setEditForm((p) => ({ ...p, brokerAgentId: e.target.value }))} className={inputCls}>
                      <option value="">— None —</option>
                      {brokerAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
            </div>

            {/* Unit Interests */}
            <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-emerald-700">
                  Interested Units ({editingUnitIds.size})
                </label>
                <button
                  type="button"
                  onClick={() => setShowUnitPicker(true)}
                  className="text-xs text-emerald-700 font-semibold hover:text-emerald-900"
                >
                  {editingUnitIds.size > 0 ? "Edit" : "+ Add Units"}
                </button>
              </div>
              {editingUnitIds.size > 0 && lead?.interests && (
                <div className="flex flex-wrap gap-1">
                  {lead.interests
                    .filter((i) => editingUnitIds.has(i.unitId))
                    .map((i) => (
                      <span
                        key={i.unitId}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          i.unitId === editingPrimaryUnitId
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        {i.unitId === editingPrimaryUnitId && "★ "}
                        {i.unit.unitNumber}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={editSaving} className={primaryBtn}>{editSaving ? "Saving…" : "Save Changes"}</button>
              <button type="button" onClick={() => setShowEditForm(false)} className={cancelBtn}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Unit Interest Picker ────────────────────────────────────────────────── */}
      {showEditForm && (
        <UnitInterestPicker
          isOpen={showUnitPicker}
          onClose={() => setShowUnitPicker(false)}
          selectedUnitIds={editingUnitIds}
          primaryUnitId={editingPrimaryUnitId}
          onUnitsChange={async (selected, primary) => {
            setEditingUnitIds(selected);
            setEditingPrimaryUnitId(primary);
            await handleUnitsChange(selected, primary);
          }}
        />
      )}

      {/* ── Create Deal Modal ───────────────────────────────────────────────────── */}
      {showCreateDealModal && (
        <Modal title="Create Deal" onClose={() => setShowCreateDealModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              A deal will be created and linked to this lead. Agent and contact are carried forward automatically.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit (optional)</label>
              {loadingDealUnits ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Loading units…
                </div>
              ) : (
                <select
                  value={createDealForm.unitId}
                  onChange={(e) => setCreateDealForm((p) => ({ ...p, unitId: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Auto-select from lead interests —</option>
                  {(() => {
                    const interestIds = new Set(lead.interests.map((i) => i.unitId));
                    const interested  = createDealUnits.filter((u) => interestIds.has(u.id));
                    const others      = createDealUnits.filter((u) => !interestIds.has(u.id));
                    return (
                      <>
                        {interested.length > 0 && (
                          <optgroup label="Lead's Interested Units">
                            {interested.map((u) => (
                              <option key={u.id} value={u.id}>
                                Unit {u.unitNumber} — {u.type.replace(/_/g, " ")} — AED {u.price.toLocaleString()}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Other Available Units">
                            {others.map((u) => (
                              <option key={u.id} value={u.id}>
                                Unit {u.unitNumber} — {u.type.replace(/_/g, " ")} — AED {u.price.toLocaleString()}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea
                rows={3}
                value={createDealForm.notes}
                onChange={(e) => setCreateDealForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes to carry into the deal…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreateDealSubmit}
                disabled={creatingDealQuick || loadingDealUnits}
                className={`${primaryBtn} flex-1`}
              >
                {creatingDealQuick ? "Creating Deal…" : "Confirm — Create Deal"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateDealModal(false)}
                className={cancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Create Reservation Modal ────────────────────────────────────────────── */}
      {showDealForm && (
        <Modal title="Create Reservation" onClose={() => setShowDealForm(false)}>
          <form onSubmit={handleDealSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit *</label>
              <select required value={dealForm.unitId} onChange={(e) => handleDealUnitChange(e.target.value)} className={inputCls}>
                <option value="">— Select a unit —</option>
                {(() => {
                  const interestIds = new Set(lead?.interests.map((i) => i.unitId) ?? []);
                  const interested = availableUnits.filter((u) => interestIds.has(u.id));
                  const others     = availableUnits.filter((u) => !interestIds.has(u.id));
                  return (
                    <>
                      {interested.length > 0 && (
                        <optgroup label="Lead's Interested Units">
                          {interested.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber} · {u.type} · AED {u.price.toLocaleString()}{u.status === "ON_HOLD" ? " (On Hold)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label="Other Available Units">
                          {others.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber} · {u.type} · AED {u.price.toLocaleString()}{u.status === "ON_HOLD" ? " (On Hold)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sale Price (AED) *</label>
                <input required type="number" min={0} value={dealForm.salePrice} onChange={(e) => setDealForm((p) => ({ ...p, salePrice: e.target.value }))} placeholder="e.g. 1200000" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Discount (AED)</label>
                <input type="number" min={0} value={dealForm.discount} onChange={(e) => setDealForm((p) => ({ ...p, discount: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reservation Amount (AED) *</label>
              <input required type="number" min={0} value={dealForm.reservationAmount} onChange={(e) => setDealForm((p) => ({ ...p, reservationAmount: e.target.value }))} placeholder="e.g. 50000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Plan *</label>
              <select required value={dealForm.paymentPlanId} onChange={(e) => setDealForm((p) => ({ ...p, paymentPlanId: e.target.value }))} className={inputCls}>
                <option value="">— Select a plan —</option>
                {paymentPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Broker Company <span className="text-slate-400 font-normal">(optional)</span></label>
              <select
                value={dealForm.brokerCompanyId}
                onChange={(e) => {
                  setDealForm((p) => ({ ...p, brokerCompanyId: e.target.value, brokerAgentId: "" }));
                  loadBrokerAgents(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">— None —</option>
                {brokerCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {brokerAgents.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Broker Agent</label>
                <select value={dealForm.brokerAgentId} onChange={(e) => setDealForm((p) => ({ ...p, brokerAgentId: e.target.value }))} className={inputCls}>
                  <option value="">— None —</option>
                  {brokerAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <p className="text-xs text-slate-400 pt-1">Lead: <span className="font-medium text-slate-600">{lead.firstName} {lead.lastName}</span></p>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={creatingDeal} className={primaryBtn}>{creatingDeal ? "Creating…" : "Create Reservation"}</button>
              <button type="button" onClick={() => setShowDealForm(false)} className={cancelBtn}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Generate / Revise Offer Modal ──────────────────────────────────────── */}
      {showOfferModal && (
        <Modal
          title={revisingOffer ? "Revise Offer (New Version)" : "Generate Sales Offer"}
          onClose={() => { setShowOfferModal(false); setRevisingOffer(null); }}
        >
          <form onSubmit={handleOfferSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
              <p className="text-sm font-semibold text-slate-800">
                {lead.interests.find((i) => i.unitId === offerModalUnit)?.unit.unitNumber ?? offerModalUnit}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Offered Price (AED) *</label>
                <input
                  required type="number" min={0} step="any"
                  value={offerForm.offeredPrice}
                  onChange={(e) => setOfferForm((p) => ({ ...p, offeredPrice: e.target.value }))}
                  placeholder="e.g. 1200000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Discount (AED)</label>
                <input
                  type="number" min={0} step="any"
                  value={offerForm.discountAmount}
                  onChange={(e) => setOfferForm((p) => ({ ...p, discountAmount: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Plan</label>
              <select
                value={offerForm.paymentPlanId}
                onChange={(e) => setOfferForm((p) => ({ ...p, paymentPlanId: e.target.value }))}
                className={inputCls}
              >
                <option value="">— None —</option>
                {paymentPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Offer Expiry</label>
              <input
                type="date"
                value={offerForm.expiresAt}
                onChange={(e) => setOfferForm((p) => ({ ...p, expiresAt: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea
                rows={2}
                value={offerForm.notes}
                onChange={(e) => setOfferForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes for this offer…"
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submittingOffer} className={primaryBtn}>
                {submittingOffer ? "Saving…" : revisingOffer ? "Create New Version" : "Generate Offer"}
              </button>
              <button
                type="button"
                onClick={() => { setShowOfferModal(false); setRevisingOffer(null); }}
                className={cancelBtn}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Lead"
        message="Delete this lead? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
