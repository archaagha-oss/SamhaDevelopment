import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import LeadKycTab from "./LeadKycTab";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import { DetailPageLayout } from "./layout";
import UnitInterestPicker from "./UnitInterestPicker";
import { StageBadge } from "@/components/ui/stage-badge";
import ConversationThread, { ConversationReplyBox } from "./ConversationThread";
import { useEventStream } from "../hooks/useEventStream";
import { DirhamSign } from "@/components/ui/DirhamSign";
import { formatDirham } from "@/lib/money";
import { Phone, Mail, MessageCircle, Handshake, Building2, FileText, MoreHorizontal, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";
import { formatDateTime, formatTimestamp } from "../utils/format";
import NextStepCard from "@/components/ui/NextStepCard";

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
  // AML profile
  dateOfBirth?: string | null;
  pepFlag?: boolean;
  riskRating?: "LOW" | "MEDIUM" | "HIGH" | null;
  occupation?: string | null;
  residencyStatus?: "CITIZEN" | "RESIDENT" | "NON_RESIDENT" | null;
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

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  CALL: Phone, EMAIL: Mail, WHATSAPP: MessageCircle, MEETING: Handshake,
  SITE_VISIT: Building2, NOTE: FileText,
};

const SOURCE_OPTIONS = ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"] as const;

const inputCls  = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring";
const primaryBtn = "px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50";
const cancelBtn  = "px-4 py-2 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

// Activity-feed timestamps inside the detail page use the hybrid helper from
// utils/format.ts per UX_AUDIT_2 §R4: relative for ≤60min, absolute beyond.

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
  const [activeTab,  setActiveTab]  = useState<"offers" | "deals" | "activity" | "kyc">("offers");
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
  // `showStagePopover` opens the Change-stage Dialog (rendered with the
  // other modals). Triggered by NextStepCard's "Other stages" secondary.
  const [showStagePopover, setShowStagePopover] = useState(false);
  const activityFormRef = useRef<HTMLFormElement | null>(null);

  const openLogActivity = () => {
    setActiveTab("activity");
    setShowActForm(true);
    requestAnimationFrame(() => {
      activityFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

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

  // KYC record count (for tab badge)
  const [kycCount, setKycCount] = useState<number | null>(null);

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
      setAddingTask(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create task");
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

  // Fetch KYC document count for the tab badge.
  // KYC = lead-attached documents of type EMIRATES_ID / PASSPORT / VISA.
  useEffect(() => {
    if (!leadId || !kycEnabled) return;
    axios.get(`/api/documents/lead/${leadId}`)
      .then((r) => {
        const rows: any[] = r.data?.data ?? [];
        const kyc = rows.filter((d) => ["EMIRATES_ID", "PASSPORT", "VISA"].includes(d.type));
        setKycCount(kyc.length);
      })
      .catch(() => setKycCount(0));
  }, [leadId, kycEnabled]);

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

      // After offer acceptance, the obvious next step is to open the
      // reservation deal. The reservation modal is itself the confirmation
      // surface (it has its own Cancel button + form), so we skip the
      // intermediate window.confirm prompt per UX_AUDIT_2 §R5 — workflow
      // continuations don't need a confirmation gate.
      if (status === "ACCEPTED") {
        const accepted = updatedOffers.find((o: any) => o.id === offerId);
        if (accepted) openReservationFromOffer(accepted);
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
    <DetailPageLayout
      crumbs={[
        { label: "Leads", path: "/leads" },
        { label: `${lead.firstName} ${lead.lastName}` },
      ]}
      title={`${lead.firstName} ${lead.lastName}`}
      subtitle={(
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span className="tabular-nums">{lead.phone}</span>
          <StageBadge kind="lead" stage={lead.stage} />
        </span>
      )}
      actions={(
        <>
          <button
            onClick={openCreateDealModal}
            className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90"
          >
            Create Deal
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More actions"
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}/edit`)}>
                <Pencil className="size-3.5 mr-2" /> Edit lead
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDealForm(true)}>
                <SlidersHorizontal className="size-3.5 mr-2" /> New reservation…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={deleting}
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" /> {deleting ? "Deleting…" : "Delete lead"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      mobileBottomBar={validTransitions.length > 0 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStageChange(validTransitions[0])}
            disabled={changingStage}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            Move to {validTransitions[0].replace(/_/g, " ")}
          </button>
          {validTransitions.length > 1 && (
            <button
              type="button"
              onClick={() => setShowStagePopover(true)}
              className="px-3 py-2.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Other ({validTransitions.length - 1})
            </button>
          )}
        </div>
      ) : null}
      tabs={(
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
          <button
            onClick={() => setActiveTab("kyc")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "kyc"
                ? "border-primary/40 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            KYC
            <span className={`ml-1.5 text-[11px] ${activeTab === "kyc" ? "text-primary" : "text-muted-foreground"}`}>
              ({kycCount ?? "—"})
            </span>
          </button>
        )}
      </div>
      )}
      kpis={(() => {
        const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const touchpoints30d = activities.filter((a) => {
          const t = new Date(a.activityDate ?? a.createdAt).getTime();
          return t >= thirtyDaysAgoMs;
        }).length;
        const latest = activities.length > 0
          ? activities.reduce((acc, a) => {
              const aT = new Date(a.activityDate ?? a.createdAt).getTime();
              const accT = new Date(acc.activityDate ?? acc.createdAt).getTime();
              return aT > accT ? a : acc;
            })
          : null;
        const budgetLabel = lead.budget
          ? lead.budget >= 1_000_000
            ? (
                <span className="inline-flex items-baseline gap-1">
                  <DirhamSign aria-hidden className="size-[0.9em] shrink-0 self-center" />
                  <span>{(lead.budget / 1_000_000).toFixed(1)}M</span>
                </span>
              )
            : formatDirham(lead.budget)
          : "—";
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Engagement</div>
              <div className="text-2xl font-bold text-foreground">{touchpoints30d}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Touchpoints (30d)</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Last Contact</div>
              <div
                className="text-xl font-bold text-foreground truncate"
                title={latest ? formatDateTime(latest.activityDate ?? latest.createdAt) : undefined}
              >
                {latest ? formatTimestamp(latest.activityDate ?? latest.createdAt) : "Never"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {latest?.type ? `via ${latest.type.replace(/_/g, " ").toLowerCase()}` : "No activity yet"}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Budget</div>
              <div className="text-2xl font-bold text-foreground">{budgetLabel}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{lead.source.replace(/_/g, " ")}</div>
            </div>
          </div>
        );
      })()}
      main={(
        <div className="space-y-4">
          {/* Tab content: Activity timeline */}
          {activeTab === "activity" && (
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
                <form ref={activityFormRef} onSubmit={handleLogActivity} className="px-5 py-4 bg-info-soft border-b border-primary/40 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"] as const).map((t) => {
                      const Icon = ACTIVITY_ICON[t] ?? FileText;
                      return (
                        <button
                          key={t} type="button" onClick={() => setActType(t)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 ${
                            actType === t ? "bg-primary text-white" : "bg-card text-muted-foreground border border-border hover:border-primary/40"
                          }`}
                        >
                          <Icon className="size-3.5" />
                          <span>{t.replace("_", " ")}</span>
                        </button>
                      );
                    })}
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
          )}

          {/* Tab content: Offers history */}
          {activeTab === "offers" && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Offers <span className="text-muted-foreground font-normal">({offers.length})</span>
              </h3>
              {offers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p>No offers generated yet.</p>
                  <p className="text-xs mt-1">Generate one from an interested unit below ↓</p>
                </div>
              ) : (
                <div className="divide-y divide-border -mx-1">
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
                      <div key={o.id} className="px-1 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-foreground inline-flex items-baseline gap-1">v{version} — {formatDirham(o.offeredPrice)}</p>
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

          {/* Tab content: Deals */}
          {activeTab === "deals" && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Deals <span className="text-muted-foreground font-normal">({lead.deals?.length ?? 0})</span>
              </h3>
              {(!lead.deals || lead.deals.length === 0) ? (
                <div className="text-sm text-muted-foreground">
                  <p>No deals yet.</p>
                  <button onClick={openCreateDealModal} className="text-xs text-primary hover:underline mt-1 font-medium">
                    Create the first deal →
                  </button>
                </div>
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
                        {formatDirham(d.salePrice)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab content: KYC */}
          {activeTab === "kyc" && (
            <LeadKycTab
              leadId={leadId}
              lead={lead}
              onLeadUpdated={(patch) => setLead((prev) => prev ? ({ ...prev, ...patch } as Lead) : prev)}
              onCountChange={setKycCount}
            />
          )}

          {/* Interested units (always visible) */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Interested Units <span className="text-muted-foreground font-normal">({lead.interests.length})</span>
            </h3>
            {lead.interests.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>No units linked yet.</p>
                <button onClick={() => navigate(`/leads/${lead.id}/edit`)} className="text-xs text-primary hover:underline mt-1 font-medium">
                  Add interested units →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <p className="text-sm font-bold text-primary">{formatDirham(i.unit.price)}</p>
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
        </div>
      )}
      aside={(
        <div className="space-y-4">
          {validTransitions.length > 0 && (
            <NextStepCard
              // Hidden on mobile — surfaced above tabs there instead.
              className="hidden lg:block"
              label={`Move to ${validTransitions[0].replace(/_/g, " ")}`}
              description={
                lead.stage === "NEW"
                  ? "Confirm first contact happened, then advance."
                  : lead.stage === "CONTACTED"
                  ? "If they qualify, move them forward."
                  : "Pick the next stage to advance the lead."
              }
              onClick={() => handleStageChange(validTransitions[0])}
              disabled={changingStage}
              secondary={
                validTransitions.length > 1
                  ? {
                      label: `Other stages (${validTransitions.length - 1})`,
                      onClick: () => setShowStagePopover(true),
                    }
                  : undefined
              }
            />
          )}

          {/* Lead info */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lead Info</h3>
            <div className="space-y-2.5">
              {/* Source + Budget intentionally omitted — both live in the
                  KPI strip above so we don't duplicate the same number twice
                  on the page. */}
              {([
                ["Nationality", lead.nationality || "—"],
                ["Agent",       lead.assignedAgent?.name || "Unassigned"],
              ] as Array<[string, React.ReactNode]>).map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
              {lead.brokerCompany && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Broker</span>
                  <span className="font-medium text-foreground text-right">
                    {lead.brokerCompany.name}
                    {lead.brokerAgent && (
                      <span className="block text-xs text-muted-foreground">{lead.brokerAgent.name}</span>
                    )}
                  </span>
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
              <div className="text-sm text-muted-foreground">
                <p>No open tasks.</p>
                <button onClick={() => setAddingTask(true)} className="text-xs text-primary hover:underline mt-1 font-medium">
                  Schedule a follow-up →
                </button>
              </div>
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
      )}
    >
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
                                Unit {u.unitNumber} — {u.type.replace(/_/g, " ")} — {formatDirham(u.price)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Other Available Units">
                            {others.map((u) => (
                              <option key={u.id} value={u.id}>
                                Unit {u.unitNumber} — {u.type.replace(/_/g, " ")} — {formatDirham(u.price)}
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
                              {u.unitNumber} · {u.type} · {formatDirham(u.price)}{u.status === "ON_HOLD" ? " (On Hold)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label="Other Available Units">
                          {others.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber} · {u.type} · {formatDirham(u.price)}{u.status === "ON_HOLD" ? " (On Hold)" : ""}
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sale Price *</label>
                <div className="relative">
                  <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input required type="number" min={0} value={dealForm.salePrice} onChange={(e) => setDealForm((p) => ({ ...p, salePrice: e.target.value }))} placeholder="e.g. 1200000" className={`${inputCls} pl-9`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount</label>
                <div className="relative">
                  <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input type="number" min={0} value={dealForm.discount} onChange={(e) => setDealForm((p) => ({ ...p, discount: e.target.value }))} className={`${inputCls} pl-9`} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reservation Amount *</label>
              <div className="relative">
                <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input required type="number" min={0} value={dealForm.reservationAmount} onChange={(e) => setDealForm((p) => ({ ...p, reservationAmount: e.target.value }))} placeholder="e.g. 50000" className={`${inputCls} pl-9`} />
              </div>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Offered Price *</label>
                <div className="relative">
                  <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    required type="number" min={0} step="any"
                    value={offerForm.offeredPrice}
                    onChange={(e) => setOfferForm((p) => ({ ...p, offeredPrice: e.target.value }))}
                    placeholder="e.g. 1200000"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Discount</label>
                <div className="relative">
                  <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="number" min={0} step="any"
                    value={offerForm.discountAmount}
                    onChange={(e) => setOfferForm((p) => ({ ...p, discountAmount: e.target.value }))}
                    className={`${inputCls} pl-9`}
                  />
                </div>
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

      {/* ── Change-stage Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showStagePopover} onOpenChange={(o) => { if (!o) { setShowStagePopover(false); setStageReason(""); } }}>
        <DialogContent className="max-w-md p-0 gap-0" aria-describedby="stage-dialog-desc">
          <div className="px-6 py-4 border-b border-border">
            <DialogTitle className="text-base font-bold text-foreground">Change stage</DialogTitle>
            <DialogDescription id="stage-dialog-desc" className="text-xs text-muted-foreground mt-0.5">
              Move {lead.firstName} {lead.lastName} to a different pipeline stage.
            </DialogDescription>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {validTransitions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={changingStage}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-sm font-medium text-foreground disabled:opacity-50"
                >
                  Move to {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                placeholder="e.g. Budget confirmed in last call"
                value={stageReason}
                onChange={(e) => setStageReason(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Lead"
        message="Delete this lead? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </DetailPageLayout>
  );
}
