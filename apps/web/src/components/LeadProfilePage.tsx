import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import Breadcrumbs from "./Breadcrumbs";
import UnitInterestPicker from "./UnitInterestPicker";
import { StageBadge } from "@/components/ui/stage-badge";
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
  // SPA / KYC fields
  address?: string | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  companyRegistrationNumber?: string | null;
  authorizedSignatory?: string | null;
  sourceOfFunds?: string | null;
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

const SOURCE_OPTIONS = ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"] as const;

const inputCls  = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring";
const primaryBtn = "px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50";
const cancelBtn  = "px-4 py-2 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `Today ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
  if (diff < 172800) return `Yesterday ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
  return `${new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })} ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-base">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
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
  const kycEnabled = useFeatureFlag("kycVerification", true);
  const handleBack = onBack ?? (() => navigate("/leads"));

  // Core data
  const [lead,       setLead]       = useState<Lead | null>(null);
  const [activeTab,  setActiveTab]  = useState<"offers" | "deals" | "activity">("offers");
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
  // Edit-modal state removed in Phase C.2 — edit lives at /leads/:id/edit now.

  // Unit picker (for editing interests)
  // Unit-picker state removed in Phase C.2 — unit interests are managed from
  // /leads/:id/edit (LeadEditPage), which renders its own UnitInterestPicker.

  // Offers
  const [offers, setOffers] = useState<{
    id: string; unitId: string; offeredPrice: number; discountAmount: number;
    status: string; createdAt: string; expiresAt?: string | null; notes?: string;
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
      axios.get("/api/users"),
      axios.get("/api/payment-plans"),
      axios.get("/api/brokers/companies"),
      axios.get("/api/tasks", { params: { leadId, status: "PENDING" } }),
      axios.get("/api/offers", { params: { leadId } }),
    ]).then(([lRes, aRes, agRes, ppRes, bcRes, tRes, oRes]) => {
      setLead(lRes.data);
      setActivities(aRes.data);
      setTasks(tRes.data || []);
      setOffers(oRes.data ?? []);
      // /api/users returns a bare array of all users; filter to active
      // non-viewers — matches the useAgents hook used elsewhere.
      const users = Array.isArray(agRes.data) ? agRes.data : (agRes.data?.data ?? []);
      setAgents(users.filter((u: any) => u.status === "ACTIVE" && u.role !== "VIEWER"));
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

  // Pre-fill edit-form effect removed in Phase C.2 — LeadEditPage owns this now.

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

  // handleEditSubmit removed in Phase C.2 — LeadEditPage owns the lead-edit
  // PATCH flow now (with the same diff-based payload).

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

  // handleUnitsChange removed in Phase C.2 — unit-interest editing lives at
  // /leads/:id/edit (LeadEditPage), which renders UnitInterestPicker inline.

  const openOfferModal = (unitId: string, existing?: typeof offers[0]) => {
    setOfferModalUnit(unitId);
    setRevisingOffer(existing?.id ?? null);
    const unit = lead?.interests.find((i) => i.unitId === unitId)?.unit;
    const defaultExpiry = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    setOfferForm({
      offeredPrice:   existing ? String(existing.offeredPrice) : (unit ? String(unit.price) : ""),
      discountAmount: existing ? String(existing.discountAmount) : "0",
      paymentPlanId:  existing?.paymentPlan?.id ?? "",
      expiresAt:      existing?.expiresAt ? new Date(existing.expiresAt).toISOString().slice(0,10) : defaultExpiry,
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
      const updatedOffers = r.data ?? [];
      setOffers(updatedOffers);
      toast.success(`Offer ${status.toLowerCase()}`);

      // Prompt to create a deal immediately after acceptance
      if (status === "ACCEPTED") {
        const accepted = updatedOffers.find((o: any) => o.id === offerId);
        if (accepted && window.confirm("Offer accepted. Create a reservation deal now?")) {
          openReservationFromOffer(accepted);
        }
      }
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
      <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeDeals   = lead.deals?.filter((d) => d.isActive) ?? [];
  const inactiveDeals = lead.deals?.filter((d) => !d.isActive) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Breadcrumbs crumbs={[
        { label: "Leads", path: "/leads" },
        { label: lead ? `${lead.firstName} ${lead.lastName}` : "Lead" },
      ]} />

      {/* Profile header */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-info-soft rounded-2xl flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
              {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{lead.firstName} {lead.lastName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-muted-foreground">{lead.phone}</span>
                {lead.email && <span className="text-sm text-muted-foreground">{lead.email}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Stage badge + change popover */}
            <div className="relative">
              <button
                onClick={() => setShowStagePopover(!showStagePopover)}
                className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
              >
                <StageBadge kind="lead" stage={lead.stage} className="text-sm px-3 py-1" />
                {validTransitions.length > 0 && <span className="text-xs text-muted-foreground">▾</span>}
              </button>
              {showStagePopover && validTransitions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 w-56 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Move to:</p>
                  {validTransitions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStageChange(s)}
                      disabled={changingStage}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-muted/50 text-foreground disabled:opacity-50"
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                  <input
                    placeholder="Reason (optional)"
                    value={stageReason}
                    onChange={(e) => setStageReason(e.target.value)}
                    className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted/50 focus:outline-none focus:border-ring mt-1"
                  />
                  <button
                    onClick={() => setShowStagePopover(false)}
                    className="text-xs text-muted-foreground hover:text-foreground mt-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => navigate(`/leads/${lead.id}/edit`)} className="px-3 py-1.5 text-sm text-muted-foreground font-medium border border-border rounded-lg hover:bg-muted/50">
              Edit
            </button>
            <button
              onClick={openCreateDealModal}
              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 flex items-center gap-1.5"
            >
              Create Deal
            </button>
            <button onClick={() => setShowDealForm(true)} className="px-3 py-1.5 text-sm text-muted-foreground font-medium border border-border rounded-lg hover:bg-muted/50">
              Advanced
            </button>
            <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm text-destructive font-medium border border-destructive/30 rounded-lg hover:bg-destructive-soft disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs: Offers / Deals / Activity (+ KYC sub-route when flag enabled) */}
      <div className="border-b border-border flex items-center gap-1">
        {([
          { key: "offers",   label: "Offers",   count: offers.length },
          { key: "deals",    label: "Deals",    count: lead.deals?.length ?? 0 },
          { key: "activity", label: "Activity", count: activities.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-primary/40 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[11px] ${activeTab === t.key ? "text-primary" : "text-muted-foreground"}`}>
              ({t.count})
            </span>
          </button>
        ))}
        {kycEnabled && (
          <Link
            to={`/leads/${leadId}/kyc`}
            className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
          >
            KYC <span className="ml-1.5 text-[11px] text-muted-foreground">→</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Lead info */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lead Info</h3>
            <div className="space-y-2.5">
              {[
                ["Source",      lead.source],
                ["Nationality", lead.nationality || "—"],
                ["Budget",      lead.budget ? `AED ${lead.budget.toLocaleString()}` : "—"],
                ["Agent",       lead.assignedAgent?.name || "Unassigned"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
              {lead.brokerCompany && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Broker</span>
                  <span className="font-medium text-foreground">{lead.brokerCompany.name}</span>
                </div>
              )}
              {lead.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground leading-relaxed">{lead.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Communication Preference */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Comm. Preference</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Preferred Channel</label>
                <select
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 focus:outline-none focus:border-ring"
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
              <div className="space-y-1.5 pt-1 border-t border-border">
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
                        <span className={optedOut ? "text-muted-foreground line-through" : "text-foreground"}>
                          {ch === "email" ? "Email" : ch === "whatsapp" ? "WhatsApp" : "SMS"} opt-out
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {sent}{sent > 0 ? ` · ${replies} replies` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interested units */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Interested Units</h3>
            {lead.interests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units linked</p>
            ) : (
              <div className="space-y-2">
                {lead.interests.map((i) => {
                  const offer = offers.find((o) => o.unitId === i.unitId && o.status === "ACTIVE");
                  return (
                    <div key={i.id} className="p-2.5 bg-muted/50 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground">{i.unit.unitNumber}</p>
                            {i.isPrimary && (
                              <span className="text-[10px] bg-success-soft text-success px-1.5 py-0.5 rounded font-semibold">Primary</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{i.unit.type.replace(/_/g, " ")} · Floor {i.unit.floor}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">AED {i.unit.price.toLocaleString()}</p>
                      </div>
                      {offer ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openReservationFromOffer(offer)}
                            className="flex-1 text-center py-1.5 text-xs font-semibold text-white bg-success rounded-lg hover:bg-success/90 transition-colors"
                          >
                            Create Reservation
                          </button>
                          <button
                            onClick={() => openOfferModal(i.unitId, offer)}
                            className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors"
                          >
                            Revise
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openOfferModal(i.unitId)}
                          className="w-full text-center py-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors"
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
          {activeTab === "deals" && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Deals <span className="text-muted-foreground font-normal">({lead.deals?.length ?? 0})</span>
            </h3>
            {(!lead.deals || lead.deals.length === 0) ? (
              <p className="text-sm text-muted-foreground">No deals yet</p>
            ) : (
              <div className="space-y-2">
                {[...activeDeals, ...inactiveDeals].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/deals/${d.id}`)}
                    className="w-full text-left p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/40 hover:bg-info-soft/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary">{d.dealNumber}</span>
                      <StageBadge kind="deal" stage={d.stage} className="text-[10px]" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Unit {d.unit.unitNumber} · {d.unit.type}
                    </p>
                    <p className="text-xs font-medium text-foreground mt-0.5">
                      AED {d.salePrice.toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Offers history */}
          {activeTab === "offers" && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Offers <span className="text-muted-foreground font-normal">({offers.length})</span>
            </h3>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers generated yet</p>
            ) : (
              <div className="space-y-2">
                {offers.map((o, idx) => {
                  const version = offers.length - idx;
                  const statusColor: Record<string, string> = {
                    ACTIVE:    "bg-info-soft text-primary",
                    ACCEPTED:  "bg-success-soft text-success",
                    REJECTED:  "bg-destructive-soft text-destructive",
                    EXPIRED:   "bg-muted text-muted-foreground",
                    WITHDRAWN: "bg-warning-soft text-warning",
                  };
                  return (
                    <div key={o.id} className="p-2.5 bg-muted/50 rounded-lg border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-foreground">v{version} — AED {o.offeredPrice.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {(o as any).unit?.unitNumber}
                            {o.paymentPlan ? ` · ${o.paymentPlan.name}` : ""}
                            {" · "}{fmtDate(o.createdAt)}
                          </p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[o.status] || "bg-muted text-muted-foreground"}`}>
                          {o.status}
                        </span>
                      </div>
                      {o.status === "ACTIVE" && (
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOfferStatus(o.id, "ACCEPTED")}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-success rounded-md hover:bg-success/90"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleOfferStatus(o.id, "REJECTED")}
                            className="px-2.5 py-1 text-[11px] font-semibold text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openOfferModal(o.unitId, o)}
                            className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-card border border-border rounded-md hover:bg-muted"
                          >
                            Revise
                          </button>
                          <button
                            onClick={() => handleOfferStatus(o.id, "WITHDRAWN")}
                            className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-card border border-border rounded-md hover:bg-muted"
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
          )}
        </div>

        <div>
          {/* Tasks */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tasks <span className="text-muted-foreground font-normal">({tasks.length})</span>
              </h3>
              <button
                onClick={() => setAddingTask((v) => !v)}
                className="text-xs text-primary hover:underline font-semibold"
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
                    className="border border-border rounded-lg px-2 py-1.5 text-xs bg-muted/50 focus:outline-none">
                    {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                  </select>
                  <input type="datetime-local" value={quickTask.dueDate}
                    onChange={(e) => setQuickTask((f) => ({ ...f, dueDate: e.target.value }))}
                    className="border border-border rounded-lg px-2 py-1.5 text-xs bg-muted/50 focus:outline-none" />
                </div>
                <button
                  onClick={submitQuickTask}
                  disabled={!quickTask.title.trim() || !quickTask.dueDate}
                  className="w-full py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            )}
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => {
                  const isOverdue = new Date(t.dueDate) < new Date();
                  return (
                    <div key={t.id} className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg border border-border">
                      <button
                        onClick={() => completeTask(t.id)}
                        disabled={completingTaskId === t.id}
                        className="w-4 h-4 rounded-full border-2 border-border hover:border-primary/40 flex-shrink-0 mt-0.5 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug">{t.title}</p>
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
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
        {activeTab === "activity" && (
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">Activity Timeline</h3>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">{activities.length}</span>
              </div>
              <button
                onClick={() => setShowActForm(!showActForm)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90"
              >
                + Log Activity
              </button>
            </div>

            {showActForm && (
              <form onSubmit={handleLogActivity} className="px-5 py-4 bg-info-soft border-b border-primary/40 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"] as const).map((t) => (
                    <button
                      key={t} type="button" onClick={() => setActType(t)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        actType === t ? "bg-primary text-white" : "bg-card text-muted-foreground border border-border hover:border-primary/40"
                      }`}
                    >
                      {ACTIVITY_ICON[t]} {t.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <textarea
                  required placeholder="Summary *" value={summary}
                  onChange={(e) => setSummary(e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Outcome (optional)" value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring"
                  />
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Follow-up date</label>
                    <input
                      type="datetime-local" value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-ring"
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
        )}
      </div>

      {/* The inline Edit Lead modal was removed in Phase C.2.
          Edit flow now lives at /leads/:leadId/edit (LeadEditPage). The Edit
          button at the top of this page navigates there. */}

      {/* ── Create Deal Modal ───────────────────────────────────────────────────── */}
      {showCreateDealModal && (
        <Modal title="Create Deal" onClose={() => setShowCreateDealModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A deal will be created and linked to this lead. Agent and contact are carried forward automatically.
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unit (optional)</label>
              {loadingDealUnits ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <div className="w-4 h-4 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional)</label>
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unit *</label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sale Price (AED) *</label>
                <input required type="number" min={0} value={dealForm.salePrice} onChange={(e) => setDealForm((p) => ({ ...p, salePrice: e.target.value }))} placeholder="e.g. 1200000" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (AED)</label>
                <input type="number" min={0} value={dealForm.discount} onChange={(e) => setDealForm((p) => ({ ...p, discount: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reservation Amount (AED) *</label>
              <input required type="number" min={0} value={dealForm.reservationAmount} onChange={(e) => setDealForm((p) => ({ ...p, reservationAmount: e.target.value }))} placeholder="e.g. 50000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Plan *</label>
              <select required value={dealForm.paymentPlanId} onChange={(e) => setDealForm((p) => ({ ...p, paymentPlanId: e.target.value }))} className={inputCls}>
                <option value="">— Select a plan —</option>
                {paymentPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Broker Company <span className="text-muted-foreground font-normal">(optional)</span></label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Broker Agent</label>
                <select value={dealForm.brokerAgentId} onChange={(e) => setDealForm((p) => ({ ...p, brokerAgentId: e.target.value }))} className={inputCls}>
                  <option value="">— None —</option>
                  {brokerAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Lead: <span className="font-medium text-muted-foreground">{lead.firstName} {lead.lastName}</span></p>
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
              <p className="text-sm font-semibold text-foreground">
                {lead.interests.find((i) => i.unitId === offerModalUnit)?.unit.unitNumber ?? offerModalUnit}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Offered Price (AED) *</label>
                <input
                  required type="number" min={0} step="any"
                  value={offerForm.offeredPrice}
                  onChange={(e) => setOfferForm((p) => ({ ...p, offeredPrice: e.target.value }))}
                  placeholder="e.g. 1200000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (AED)</label>
                <input
                  type="number" min={0} step="any"
                  value={offerForm.discountAmount}
                  onChange={(e) => setOfferForm((p) => ({ ...p, discountAmount: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Plan</label>
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Offer Expiry <span className="text-muted-foreground font-normal">(default 7 days)</span></label>
              <input
                type="date"
                value={offerForm.expiresAt}
                onChange={(e) => setOfferForm((p) => ({ ...p, expiresAt: e.target.value }))}
                className={inputCls}
              />
              {offerForm.expiresAt && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Expires {new Date(offerForm.expiresAt).toLocaleDateString("en-AE", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
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
