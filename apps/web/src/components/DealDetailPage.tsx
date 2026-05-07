import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { formatArea } from "../utils/formatArea";
import DocumentUploadModal from "./DocumentUploadModal";
import DocumentBrowser from "./DocumentBrowser";
import DealEditModal from "./DealEditModal";
import ConfirmDialog from "./ConfirmDialog";
import Breadcrumbs from "./Breadcrumbs";

interface StageHistoryEntry {
  id: string; oldStage: string; newStage: string; changedBy: string;
  reason?: string; changedAt: string;
}

interface Deal {
  id: string; dealNumber: string; stage: string;
  salePrice: number; discount: number; dldFee: number; adminFee: number;
  reservationDate: string; oqoodDeadline: string;
  oqood: { deadline: string; daysRemaining: number; status: "green"|"yellow"|"red"|"overdue"; isOverdue: boolean; };
  lead: { id: string; firstName: string; lastName: string; phone: string; email?: string; };
  unit: { id: string; unitNumber: string; type: string; floor: number; area: number; price: number; status: string; };
  paymentPlan: { id: string; name: string; milestones: any[]; };
  payments: any[];
  commission?: { id: string; amount: number; rate: number; status: string; spaSignedMet: boolean; oqoodRegisteredMet: boolean; conditions?: { spaSignedMet: boolean; oqoodRegisteredMet: boolean; bothMet: boolean; }; };
  documents: Array<{ id: string; type: string; version: number; name: string; uploadedAt: string; softDeleted: boolean; uploadedBy: string; dataSnapshot?: any }>;
  stageHistory?: StageHistoryEntry[];
  brokerCompany?: { id: string; name: string } | null;
  brokerAgent?: { id: string; name: string } | null;
  assignedAgent?: { id: string; name: string } | null;
  dldPaidBy?: string;
  adminFeeWaived?: boolean;
  adminFeeWaivedReason?: string;
  dldWaivedReason?: string;
  commissionRateOverride?: number;
  remindersPaused?: boolean;
  remindersPausedReason?: string | null;
  remindersPausedUntil?: string | null;
}

interface Props { dealId?: string; onBack?: () => void; }

const VALID_DEAL_TRANSITIONS: Record<string, string[]> = {
  RESERVATION_PENDING:   ["RESERVATION_CONFIRMED", "CANCELLED"],
  RESERVATION_CONFIRMED: ["SPA_PENDING",           "CANCELLED"],
  SPA_PENDING:           ["SPA_SENT",              "CANCELLED"],
  SPA_SENT:              ["SPA_SIGNED",            "CANCELLED"],
  SPA_SIGNED:            ["OQOOD_PENDING",         "CANCELLED"],
  OQOOD_PENDING:         ["OQOOD_REGISTERED",      "CANCELLED"],
  OQOOD_REGISTERED:      ["INSTALLMENTS_ACTIVE",   "CANCELLED"],
  INSTALLMENTS_ACTIVE:   ["HANDOVER_PENDING",      "CANCELLED"],
  HANDOVER_PENDING:      ["COMPLETED",             "CANCELLED"],
  COMPLETED:             [],
  CANCELLED:             [],
};

const STAGE_BADGE: Record<string, string> = {
  RESERVATION_PENDING: "bg-slate-100 text-slate-600", RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
  SPA_PENDING: "bg-yellow-100 text-yellow-700", SPA_SENT: "bg-yellow-100 text-yellow-700",
  SPA_SIGNED: "bg-violet-100 text-violet-700", OQOOD_PENDING: "bg-orange-100 text-orange-700",
  OQOOD_REGISTERED: "bg-teal-100 text-teal-700", INSTALLMENTS_ACTIVE: "bg-indigo-100 text-indigo-700",
  HANDOVER_PENDING: "bg-emerald-100 text-emerald-700", COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const PAY_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700", PENDING: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-amber-100 text-amber-700", OVERDUE: "bg-red-100 text-red-700",
  PDC_PENDING: "bg-orange-100 text-orange-700",
  PDC_CLEARED: "bg-teal-100 text-teal-700", CANCELLED: "bg-slate-100 text-slate-500",
};
const OQOOD_COLOR: Record<string, string> = {
  green: "text-emerald-600 bg-emerald-50 border-emerald-200",
  yellow: "text-amber-600 bg-amber-50 border-amber-200",
  red: "text-red-600 bg-red-50 border-red-200",
  overdue: "text-red-700 bg-red-100 border-red-300",
};
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `Today ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
  if (diff < 172800) return `Yesterday ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
  return new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}

function activityIcon(type: string, summary: string): string {
  if (type === "CALL")       return "📞";
  if (type === "EMAIL")      return "✉️";
  if (type === "WHATSAPP")   return "💬";
  if (type === "MEETING")    return "🤝";
  if (type === "SITE_VISIT") return "🏢";
  const s = summary.toLowerCase();
  if (s.includes("reserved"))                   return "🔒";
  if (s.includes("generated") || s.includes("document")) return "📄";
  if (s.includes("stage changed") || s.includes("→"))    return "🔄";
  if (s.includes("created"))                    return "✅";
  if (s.includes("unit") && (s.includes("assign") || s.includes("changed"))) return "🏠";
  return "📝";
}

const SYSTEM_PATTERNS = ["generated for", "reserved for", "stage changed", "deal created", "unit assigned", "unit changed", "notes updated"];
function isSystemActivity(summary: string): boolean {
  const s = summary.toLowerCase();
  return SYSTEM_PATTERNS.some((p) => s.includes(p));
}

export default function DealDetailPage({ dealId: dealIdProp, onBack }: Props) {
  const params = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const dealId = dealIdProp ?? params.dealId ?? "";
  const handleBack = onBack ?? (() => navigate("/deals"));
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showStageSelect, setShowStageSelect] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [pdcId, setPdcId] = useState<string | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<string | null>(null);
  const [paidMethod, setPaidMethod] = useState("BANK_TRANSFER");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidRef, setPaidRef] = useState("");
  const [paidNotes, setPaidNotes] = useState("");
  const [showPartialModal, setShowPartialModal] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialMethod, setPartialMethod] = useState("BANK_TRANSFER");
  const [partialRef, setPartialRef] = useState("");
  const [partialNotes, setPartialNotes] = useState("");
  const [submittingPartial, setSubmittingPartial] = useState(false);
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
  const [documentKey, setDocumentKey] = useState(0);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [showReserveConfirm, setShowReserveConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Change Unit panel
  const [showChangeUnit, setShowChangeUnit]             = useState(false);
  const [changeUnitProjectId, setChangeUnitProjectId]   = useState("");
  const [changeUnitId, setChangeUnitId]                 = useState("");
  const [projects, setProjects]                         = useState<{ id: string; name: string }[]>([]);
  const [changeUnitList, setChangeUnitList]             = useState<{ id: string; unitNumber: string; type: string; price: number; floor: number }[]>([]);
  const [loadingChangeUnits, setLoadingChangeUnits]     = useState(false);
  const [assigningUnit, setAssigningUnit]               = useState(false);

  // Notes inline editing
  const [notesValue, setNotesValue]   = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved]   = useState(false);

  // Waive payment
  const [waiveId, setWaiveId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [submittingWaive, setSubmittingWaive] = useState(false);

  // Stage change confirmation
  const [pendingStage, setPendingStage] = useState<string | null>(null);

  // Regenerate Sales Offer confirmation
  const [showRegenSalesOffer, setShowRegenSalesOffer] = useState(false);

  // Copy deal ID feedback
  const [copiedDealId, setCopiedDealId] = useState(false);
  const copyDealId = () => {
    if (!deal) return;
    navigator.clipboard.writeText(deal.dealNumber);
    setCopiedDealId(true);
    setTimeout(() => setCopiedDealId(false), 1500);
  };

  // Pause reminders
  const [pausingReminders, setPausingReminders] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseUntil, setPauseUntil] = useState("");

  const togglePauseReminders = async (paused: boolean) => {
    setPausingReminders(true);
    try {
      await axios.patch(`/api/deals/${dealId}/pause-reminders`, {
        paused,
        reason: paused ? pauseReason : undefined,
        pausedUntil: paused && pauseUntil ? pauseUntil : undefined,
      });
      setShowPauseModal(false);
      setPauseReason("");
      setPauseUntil("");
      loadDeal();
      toast.success(paused ? "Reminders paused" : "Reminders resumed");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update reminder settings");
    } finally {
      setPausingReminders(false);
    }
  };

  const generateInvoice = async (paymentId: string) => {
    setGeneratingInvoice(paymentId);
    try {
      const r = await axios.post(`/api/payments/${paymentId}/generate-invoice`);
      window.open(r.data.previewUrl, "_blank");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate invoice");
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const generateReceipt = async (paymentId: string) => {
    setGeneratingReceipt(paymentId);
    try {
      const r = await axios.post(`/api/payments/${paymentId}/generate-receipt`);
      window.open(r.data.previewUrl, "_blank");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate receipt");
    } finally {
      setGeneratingReceipt(null);
    }
  };

  // Add custom milestone
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ label: "", amount: "", dueDate: "", notes: "" });
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Restructure schedule
  const [showRestructure, setShowRestructure] = useState(false);
  const [restructureDays, setRestructureDays] = useState("");
  const [restructureReason, setRestructureReason] = useState("");
  const [submittingRestructure, setSubmittingRestructure] = useState(false);

  // PDC modal
  const [showPdcModal, setShowPdcModal] = useState<string | null>(null);
  const [pdcForm, setPdcForm] = useState({ pdcNumber: "", pdcBank: "", pdcDate: "" });
  const [stageRequirements, setStageRequirements] = useState<Array<{ documentType: string; label: string; required: boolean; uploaded: boolean }>>([]);
  const [activeTab, setActiveTab] = useState<"payments" | "history" | "activity" | "tasks">("payments");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: "NOTE", summary: "", outcome: "", followUpDate: "", activityDate: new Date().toISOString().slice(0, 16) });
  const [submittingActivity, setSubmittingActivity] = useState(false);
  const [dealTasks, setDealTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [addTaskForm, setAddTaskForm] = useState({ title: "", type: "FOLLOW_UP", priority: "MEDIUM", dueDate: "" });
  const [addingTask, setAddingTask] = useState(false);

  const loadDeal = useCallback(() => {
    setError(null);
    axios.get(`/api/deals/${dealId}`)
      .then((r) => setDeal(r.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load deal"))
      .finally(() => setLoading(false));
  }, [dealId]);

  const loadActivities = useCallback(() => {
    setActivityLoading(true);
    axios.get(`/api/deals/${dealId}/activities`)
      .then((r) => setActivities(r.data || []))
      .catch(() => setActivities([]))
      .finally(() => setActivityLoading(false));
  }, [dealId]);

  const submitActivity = async () => {
    if (!activityForm.summary.trim()) return;
    setSubmittingActivity(true);
    try {
      await axios.post(`/api/deals/${dealId}/activities`, activityForm);
      setActivityForm({ type: "NOTE", summary: "", outcome: "", followUpDate: "", activityDate: new Date().toISOString().slice(0, 16) });
      setShowActivityForm(false);
      loadActivities();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to log activity");
    } finally {
      setSubmittingActivity(false);
    }
  };

  useEffect(() => { loadDeal(); }, [loadDeal]);
  useEffect(() => { if (deal && notesValue === null) setNotesValue((deal as any).notes ?? ""); }, [deal]);
  useEffect(() => { if (activeTab === "activity") loadActivities(); }, [activeTab, loadActivities]);

  const loadDealTasks = useCallback(() => {
    setTasksLoading(true);
    axios.get("/api/tasks", { params: { dealId, status: "PENDING" } })
      .then((r) => setDealTasks(r.data || []))
      .catch(() => setDealTasks([]))
      .finally(() => setTasksLoading(false));
  }, [dealId]);

  useEffect(() => { if (activeTab === "tasks") loadDealTasks(); }, [activeTab, loadDealTasks]);

  const completeDealTask = async (id: string) => {
    setCompletingTaskId(id);
    try {
      await axios.patch(`/api/tasks/${id}/complete`);
      setDealTasks((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setCompletingTaskId(null);
    }
  };

  const submitDealTask = async () => {
    if (!addTaskForm.title.trim() || !addTaskForm.dueDate) return;
    setAddingTask(true);
    try {
      const res = await axios.post("/api/tasks", {
        dealId,
        title: addTaskForm.title,
        type: addTaskForm.type,
        priority: addTaskForm.priority,
        dueDate: new Date(addTaskForm.dueDate).toISOString(),
      });
      setDealTasks((prev) => [...prev, res.data]);
      setAddTaskForm({ title: "", type: "FOLLOW_UP", priority: "MEDIUM", dueDate: "" });
      setShowAddTaskForm(false);
    } finally {
      setAddingTask(false);
    }
  };

  // Load requirements for the next valid stage whenever deal changes
  useEffect(() => {
    if (!deal) return;
    const nextStageMap: Record<string, string> = {
      RESERVATION_PENDING: "RESERVATION_CONFIRMED",
      RESERVATION_CONFIRMED: "SPA_PENDING",
      SPA_PENDING: "SPA_SENT",
      SPA_SENT: "SPA_SIGNED",
      SPA_SIGNED: "OQOOD_PENDING",
      OQOOD_PENDING: "OQOOD_REGISTERED",
      OQOOD_REGISTERED: "INSTALLMENTS_ACTIVE",
      INSTALLMENTS_ACTIVE: "HANDOVER_PENDING",
      HANDOVER_PENDING: "COMPLETED",
    };
    const next = nextStageMap[deal.stage];
    if (!next) { setStageRequirements([]); return; }
    axios.get(`/api/deals/${deal.id}/stage-requirements?targetStage=${next}`)
      .then((r) => setStageRequirements(r.data.requirements || []))
      .catch(() => setStageRequirements([]));
  }, [deal]);

  const handleStageChange = async (newStage: string) => {
    if (!deal || newStage === deal.stage) { setShowStageSelect(false); return; }
    setPendingStage(newStage);
  };

  const confirmStageChange = async () => {
    if (!pendingStage || !deal) return;
    const newStage = pendingStage;
    setPendingStage(null);
    setUpdatingStage(true);
    try {
      await axios.patch(`/api/deals/${deal.id}/stage`, { newStage });
      toast.success(`Stage updated to ${newStage.replace(/_/g, " ")}`);
      setShowStageSelect(false);
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const confirmMarkPaid = async () => {
    const paymentId = showMarkPaidModal;
    if (!paymentId) return;
    setPayingId(paymentId);
    try {
      await axios.patch(`/api/payments/${paymentId}/paid`, {
        paymentMethod: paidMethod,
        paidBy: "admin",
        paidDate: new Date(paidDate).toISOString(),
        ...(paidRef.trim() ? { receiptKey: paidRef.trim() } : {}),
        ...(paidNotes.trim() ? { notes: paidNotes.trim() } : {}),
      });
      toast.success("Payment marked as paid");
      setShowMarkPaidModal(null);
      setPaidRef("");
      setPaidNotes("");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to mark payment as paid");
    } finally {
      setPayingId(null);
    }
  };

  const confirmPartial = async () => {
    const paymentId = showPartialModal;
    if (!paymentId || !partialAmount) return;
    setSubmittingPartial(true);
    try {
      await axios.post(`/api/payments/${paymentId}/partial`, {
        amount: parseFloat(partialAmount),
        paymentMethod: partialMethod,
        ...(partialRef.trim() ? { receiptKey: partialRef.trim() } : {}),
        ...(partialNotes.trim() ? { notes: partialNotes.trim() } : {}),
      });
      setShowPartialModal(null);
      setPartialAmount("");
      setPartialRef("");
      setPartialNotes("");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to record partial payment");
    } finally {
      setSubmittingPartial(false);
    }
  };

  const handlePdcAction = async (paymentId: string, action: "pdc" | "pdc-cleared" | "pdc-bounced") => {
    setPdcId(paymentId);
    try {
      await axios.patch(`/api/payments/${paymentId}/${action}`);
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update PDC status");
    } finally {
      setPdcId(null);
    }
  };

  const handleCancelDeal = async () => {
    if (!deal || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await axios.patch(`/api/deals/${deal.id}/stage`, { newStage: "CANCELLED", reason: cancelReason });
      setShowCancelModal(false);
      setCancelReason("");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to cancel deal");
    } finally {
      setCancelling(false);
    }
  };

  const confirmWaive = async () => {
    if (!waiveId || !waiveReason.trim()) return;
    setSubmittingWaive(true);
    try {
      await axios.patch(`/api/payments/${waiveId}/waive`, { reason: waiveReason });
      setWaiveId(null);
      setWaiveReason("");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to waive payment");
    } finally {
      setSubmittingWaive(false);
    }
  };

  const confirmAddMilestone = async () => {
    if (!milestoneForm.label || !milestoneForm.amount || !milestoneForm.dueDate) return;
    setAddingMilestone(true);
    try {
      await axios.post(`/api/deals/${dealId}/payments`, {
        label: milestoneForm.label,
        amount: parseFloat(milestoneForm.amount),
        dueDate: milestoneForm.dueDate,
        notes: milestoneForm.notes || undefined,
      });
      setShowAddMilestone(false);
      setMilestoneForm({ label: "", amount: "", dueDate: "", notes: "" });
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add milestone");
    } finally {
      setAddingMilestone(false);
    }
  };

  const confirmRestructure = async () => {
    if (!restructureDays || !restructureReason.trim()) return;
    setSubmittingRestructure(true);
    try {
      await axios.post(`/api/deals/${dealId}/restructure`, {
        shiftDays: parseInt(restructureDays),
        reason: restructureReason,
      });
      setShowRestructure(false);
      setRestructureDays("");
      setRestructureReason("");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to restructure schedule");
    } finally {
      setSubmittingRestructure(false);
    }
  };

  const confirmPdc = async () => {
    if (!showPdcModal) return;
    setPdcId(showPdcModal);
    try {
      await axios.patch(`/api/payments/${showPdcModal}/pdc`, pdcForm);
      setShowPdcModal(null);
      setPdcForm({ pdcNumber: "", pdcBank: "", pdcDate: "" });
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to register PDC");
    } finally {
      setPdcId(null);
    }
  };

  const handleGenerateDocument = async (type: "RESERVATION_FORM" | "SPA" | "SALES_OFFER") => {
    setGeneratingDoc(type);
    try {
      await axios.post(`/api/deals/${dealId}/generate-document`, { type });
      const labelMap = {
        RESERVATION_FORM: "reservation-form",
        SPA:              "spa-draft",
        SALES_OFFER:      "sales-offer",
      };
      const nameMap = {
        RESERVATION_FORM: "Reservation Form",
        SPA:              "SPA Draft",
        SALES_OFFER:      "Sales Offer",
      };
      toast.success(`${nameMap[type]} generated`);
      setDocumentKey((k) => k + 1);
      loadDeal();
      window.open(`/deals/${dealId}/print/${labelMap[type]}`, "_blank");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate document");
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handleReserveUnit = () => setShowReserveConfirm(true);

  const confirmReserveUnit = async () => {
    setShowReserveConfirm(false);
    setReserving(true);
    try {
      await axios.post(`/api/deals/${dealId}/reserve`);
      toast.success("Unit reserved — deal confirmed");
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reserve unit");
    } finally {
      setReserving(false);
    }
  };

  // Load projects once when Change Unit panel opens
  const openChangeUnit = async () => {
    setShowChangeUnit(true);
    setChangeUnitId("");
    setChangeUnitProjectId("");
    setChangeUnitList([]);
    if (projects.length === 0) {
      const r = await axios.get("/api/projects").catch(() => ({ data: [] }));
      setProjects((r.data?.data ?? r.data ?? []).map((p: any) => ({ id: p.id, name: p.name })));
    }
  };

  const handleChangeUnitProject = async (projectId: string) => {
    setChangeUnitProjectId(projectId);
    setChangeUnitId("");
    setChangeUnitList([]);
    if (!projectId) return;
    setLoadingChangeUnits(true);
    try {
      const r = await axios.get("/api/units", { params: { projectId, status: "AVAILABLE", limit: 300 } });
      setChangeUnitList((r.data?.data ?? r.data ?? []).map((u: any) => ({
        id: u.id, unitNumber: u.unitNumber, type: u.type, price: u.price, floor: u.floor,
      })));
    } catch {
      toast.error("Failed to load units");
    } finally {
      setLoadingChangeUnits(false);
    }
  };

  const handleAssignUnit = async () => {
    if (!changeUnitId) { toast.error("Select a unit first"); return; }
    setAssigningUnit(true);
    try {
      await axios.patch(`/api/deals/${dealId}/unit`, { unitId: changeUnitId });
      toast.success("Unit assigned");
      setShowChangeUnit(false);
      loadDeal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to assign unit");
    } finally {
      setAssigningUnit(false);
    }
  };

  const handleSaveNotes = async () => {
    if (notesValue === null) return;
    setSavingNotes(true);
    try {
      await axios.patch(`/api/deals/${dealId}`, { notes: notesValue });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !deal) return (
    <div className="p-6">
      <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">← Back</button>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">{error || "Deal not found"}</p>
        <button onClick={handleBack} className="mt-3 text-sm text-red-500 underline">Go back</button>
      </div>
    </div>
  );

  const netPrice = deal.salePrice - deal.discount;

  // Document state — hoisted so header CTA and Documents section share the same values
  const salesOfferDocs = deal.documents
    .filter((d) => d.type === "SALES_OFFER" && !d.softDeleted)
    .sort((a, b) => b.version - a.version);

  // Invoice/receipt doc lookup helpers (keyed by paymentId)
  const invoiceDocByPayment = (paymentId: string) =>
    deal.documents.find((d) => !d.softDeleted && d.type === "OTHER" && d.dataSnapshot?.docSubtype === "INVOICE" && d.dataSnapshot?.paymentId === paymentId);
  const receiptDocByPayment = (paymentId: string) =>
    deal.documents.find((d) => !d.softDeleted && d.type === "PAYMENT_RECEIPT" && d.dataSnapshot?.paymentId === paymentId);
  const canGenerateSalesOffer = !["RESERVATION_PENDING", "CANCELLED"].includes(deal.stage) && !!deal.lead.firstName;
  const paidAmount    = deal.payments.filter((p: any) => p.status === "PAID").reduce((s: number, p: any) => s + p.amount, 0);
  const partialPaid   = deal.payments.filter((p: any) => p.status === "PARTIAL").reduce((s: number, p: any) => s + (p.partialPayments?.reduce((ps: number, pp: any) => ps + pp.amount, 0) ?? 0), 0);
  const totalPaid     = paidAmount + partialPaid;
  const remaining     = netPrice - totalPaid;
  const overdueAmt    = deal.payments.filter((p: any) => (p.status === "OVERDUE" || p.status === "PARTIAL") && new Date(p.dueDate) < new Date()).reduce((s: number, p: any) => s + p.amount, 0);
  const paidPct       = netPrice > 0 ? Math.round((totalPaid / netPrice) * 100) : 0;
  const commission    = deal.commission;
  const oqood         = deal.oqood;
  const oqoodStyle    = OQOOD_COLOR[oqood.status] || OQOOD_COLOR.green;
  const spaOk         = commission?.conditions?.spaSignedMet ?? commission?.spaSignedMet ?? false;
  const oqoodOk       = commission?.conditions?.oqoodRegisteredMet ?? (commission as any)?.oqoodMet ?? false;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Breadcrumbs crumbs={[
        { label: "Deals", path: "/deals" },
        { label: deal.dealNumber },
      ]} />
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{deal.lead.firstName} {deal.lead.lastName}</h1>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors text-sm"
                title="Edit deal"
              >
                ✎
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <button
                onClick={copyDealId}
                className="flex items-center gap-1 font-mono text-xs text-slate-400 hover:text-slate-700 transition-colors group"
                title="Copy deal ID"
              >
                {deal.dealNumber}
                <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
                  {copiedDealId ? "✓" : "⎘"}
                </span>
              </button>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500">{deal.lead.phone}</span>
              {deal.lead.email && <span className="text-sm text-slate-400">{deal.lead.email}</span>}
              {deal.brokerCompany && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    {deal.brokerCompany.name}{deal.brokerAgent ? ` / ${deal.brokerAgent.name}` : ""}
                  </span>
                </>
              )}
              {deal.paymentPlan && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500">Plan: <span className="font-medium text-slate-700">{deal.paymentPlan.name}</span></span>
                </>
              )}
            </div>
          </div>

          {/* Stage badge + dynamic primary CTA + secondary actions */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`}>
              {deal.stage.replace(/_/g, " ")}
            </span>

            {/* Dynamic primary action — one clear next step per stage */}
            {deal.stage === "RESERVATION_PENDING" && (
              <button
                onClick={handleReserveUnit}
                disabled={reserving}
                className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {reserving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Reserving…</>
                  : "🔒 Reserve Unit"}
              </button>
            )}
            {deal.stage === "RESERVATION_CONFIRMED" && salesOfferDocs.length === 0 && canGenerateSalesOffer && (
              <button
                onClick={() => handleGenerateDocument("SALES_OFFER")}
                disabled={!!generatingDoc}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {generatingDoc === "SALES_OFFER" ? "Generating…" : "📄 Generate Sales Offer"}
              </button>
            )}

            <div className="relative flex items-center gap-2">
              {deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-1 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Cancel Deal
                </button>
              )}
              <button
                onClick={() => setShowStageSelect(!showStageSelect)}
                disabled={updatingStage}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {updatingStage ? "Updating…" : "Change Stage ▾"}
              </button>
              {showStageSelect && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 w-56">
                  {(VALID_DEAL_TRANSITIONS[deal.stage] ?? []).filter((s) => s !== "CANCELLED").map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStageChange(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors text-slate-700"
                    >
                      → {s.replace(/_/g, " ")}
                    </button>
                  ))}
                  {(VALID_DEAL_TRANSITIONS[deal.stage] ?? []).length === 0 && (
                    <p className="px-4 py-2 text-xs text-slate-400">No further transitions</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click-outside overlay for stage dropdown */}
      {showStageSelect && (
        <div className="fixed inset-0 z-10" onClick={() => setShowStageSelect(false)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main: control sections + unit + financials + payments */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── Buyer Info ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Buyer</h3>
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
              {[
                ["Name",  `${deal.lead.firstName} ${deal.lead.lastName}`],
                ["Phone", deal.lead.phone],
                ["Email", deal.lead.email ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Unit Selection ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</h3>
              {deal.stage === "RESERVATION_PENDING" ? (
                <button
                  onClick={() => showChangeUnit ? setShowChangeUnit(false) : openChangeUnit()}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  {showChangeUnit ? "Cancel" : "Change Unit"}
                </button>
              ) : deal.unit.status === "RESERVED" ? (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                  Reserved (This Deal)
                </span>
              ) : null}
            </div>

            {/* Current unit summary */}
            <div className="flex items-center gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-slate-900">{deal.unit.unitNumber}</p>
                  {deal.unit.status === "RESERVED" && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">RESERVED</span>
                  )}
                  {deal.unit.status === "ON_HOLD" && (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">ON HOLD</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{deal.unit.type.replace(/_/g, " ")} · Floor {deal.unit.floor} · {formatArea(deal.unit.area)}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold text-blue-700">AED {deal.salePrice.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Sale Price</p>
              </div>
            </div>

            {/* Change Unit panel */}
            {showChangeUnit && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs text-slate-500">Select a new unit to replace the current assignment. Only AVAILABLE units are shown.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
                    <select
                      value={changeUnitProjectId}
                      onChange={(e) => handleChangeUnitProject(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                    >
                      <option value="">— Select project —</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
                    {loadingChangeUnits ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Loading…
                      </div>
                    ) : (
                      <select
                        value={changeUnitId}
                        onChange={(e) => setChangeUnitId(e.target.value)}
                        disabled={!changeUnitProjectId || changeUnitList.length === 0}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 disabled:opacity-50"
                      >
                        <option value="">
                          {!changeUnitProjectId ? "Select a project first" : changeUnitList.length === 0 ? "No available units" : "— Select unit —"}
                        </option>
                        {changeUnitList.map((u) => (
                          <option key={u.id} value={u.id}>
                            Unit {u.unitNumber} · {u.type.replace(/_/g, " ")} · Floor {u.floor} · AED {u.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleAssignUnit}
                  disabled={!changeUnitId || assigningUnit}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {assigningUnit ? "Assigning…" : "Assign Unit"}
                </button>
              </div>
            )}
          </div>

          {/* Documents — versioned Sales Offer list + supporting docs */}
          {/* Section order: Buyer → Unit → Documents → Notes → Tabs (per spec 8.3) */}
          {(() => {
            const latestVersion = salesOfferDocs[0]?.version ?? 0;
            const hasExisting   = salesOfferDocs.length > 0;

            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</h3>
                  {canGenerateSalesOffer && (
                    <button
                      onClick={() => hasExisting ? setShowRegenSalesOffer(true) : handleGenerateDocument("SALES_OFFER")}
                      disabled={!!generatingDoc}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {generatingDoc === "SALES_OFFER"
                        ? "Generating…"
                        : hasExisting ? "Generate New Version" : "Generate Sales Offer"}
                    </button>
                  )}
                  {!canGenerateSalesOffer && deal.stage !== "CANCELLED" && (
                    <span
                      className="text-xs text-slate-400 italic cursor-default"
                      title="Reserve the unit first to unlock document generation"
                    >
                      Reserve unit first
                    </span>
                  )}
                </div>

                {/* Sales Offer version table — or actionable empty state */}
                {hasExisting ? (
                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500">
                          <th className="px-3 py-2 font-semibold">Type</th>
                          <th className="px-3 py-2 font-semibold">Version</th>
                          <th className="px-3 py-2 font-semibold">Generated</th>
                          <th className="px-3 py-2 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesOfferDocs.map((doc) => (
                          <tr key={doc.id} className="border-t border-slate-100">
                            <td className="px-3 py-2.5 font-medium text-slate-700">
                              Sales Offer
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-700">v{doc.version}</span>
                                {doc.version === latestVersion && (
                                  <span className="px-1.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">Latest</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">
                              {fmtDate(doc.uploadedAt)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => window.open(`/deals/${dealId}/print/sales-offer?docId=${doc.id}`, "_blank")}
                                  className="px-2.5 py-1 text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => window.open(`/deals/${dealId}/print/sales-offer?docId=${doc.id}&auto=print`, "_blank")}
                                  className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Download
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Actionable empty state */
                  <div className="rounded-lg bg-slate-50 border border-dashed border-slate-200 px-4 py-5 text-center">
                    <p className="text-sm text-slate-500 mb-3">
                      No Sales Offer generated yet.
                      {canGenerateSalesOffer
                        ? " Generate one to send to the buyer."
                        : " Reserve the unit first to unlock document generation."}
                    </p>
                    {canGenerateSalesOffer && (
                      <button
                        onClick={() => handleGenerateDocument("SALES_OFFER")}
                        disabled={!!generatingDoc}
                        className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate Sales Offer"}
                      </button>
                    )}
                  </div>
                )}

                {/* Other document quick-actions */}
                <div className="flex gap-2 flex-wrap pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleGenerateDocument("RESERVATION_FORM")}
                    disabled={!!generatingDoc}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {generatingDoc === "RESERVATION_FORM" ? "Generating…" : "Reservation Form"}
                  </button>
                  <button
                    onClick={() => handleGenerateDocument("SPA")}
                    disabled={!!generatingDoc}
                    className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                  >
                    {generatingDoc === "SPA" ? "Generating…" : "SPA Draft"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Regenerate Sales Offer confirmation modal */}
          {showRegenSalesOffer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-base font-bold text-slate-800 mb-2">Generate New Version?</h3>
                <p className="text-sm text-slate-500 mb-5">
                  This will create a new version of the Sales Offer capturing the current deal
                  data. The existing version will remain accessible in the history.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowRegenSalesOffer(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowRegenSalesOffer(false); handleGenerateDocument("SALES_OFFER"); }}
                    disabled={!!generatingDoc}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate New Version"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ───────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</h3>
              {notesSaved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
            </div>
            <textarea
              rows={3}
              value={notesValue ?? ""}
              onChange={(e) => { setNotesValue(e.target.value); setNotesSaved(false); }}
              placeholder="Internal deal notes…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-2 px-4 py-1.5 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {savingNotes ? "Saving…" : "Save Notes"}
            </button>
          </div>

          {/* Uploaded documents browser */}
          <DocumentBrowser
            key={documentKey}
            dealId={dealId}
            onUpload={() => setShowDocumentUploadModal(true)}
          />

          {/* Payment schedule + Stage history tabs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {(["payments", "activity", "tasks", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      activeTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab === "payments" ? "Payments" : tab === "activity" ? "Activity" : tab === "tasks" ? "Tasks" : "Stage History"}
                  </button>
                ))}
              </div>
              {activeTab === "payments" && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{paidPct}%</span>
                  </div>
                  <span className="text-xs text-slate-400">AED {totalPaid.toLocaleString()} paid</span>
                  {deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (
                    <>
                      <button
                        onClick={() => { setShowAddMilestone(true); setMilestoneForm({ label: "", amount: "", dueDate: "", notes: "" }); }}
                        className="px-2 py-1 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                      >+ Milestone</button>
                      <button
                        onClick={() => { setShowRestructure(true); setRestructureDays(""); setRestructureReason(""); }}
                        className="px-2 py-1 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors"
                      >Restructure</button>
                    </>
                  )}
                  {/* Pause reminders toggle */}
                  {deal.payments.length > 0 && (
                    deal.remindersPaused ? (
                      <button
                        onClick={() => togglePauseReminders(false)}
                        disabled={pausingReminders}
                        className="ml-auto px-2 py-1 text-xs border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <span>⏸</span> Reminders Paused
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowPauseModal(true)}
                        className="ml-auto px-2 py-1 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                      >
                        <span>🔔</span> Pause Reminders
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Payments tab */}
            {activeTab === "payments" && (
              deal.payments.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2">💳</p>
                  <p className="text-sm font-medium text-slate-600 mb-1">No payment schedule yet</p>
                  <p className="text-xs text-slate-400">
                    {["RESERVATION_PENDING", "RESERVATION_CONFIRMED"].includes(deal.stage)
                      ? "A payment plan will appear here once the deal advances to SPA stage."
                      : "Assign a payment plan to this deal to generate the installment schedule."}
                  </p>
                </div>
              ) : (
                <>
                {/* Financial summary */}
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                  {[
                    { label: "Total Price", value: `AED ${netPrice.toLocaleString()}`, color: "text-slate-800" },
                    { label: "Total Paid", value: `AED ${totalPaid.toLocaleString()}`, color: "text-emerald-700" },
                    { label: "Remaining", value: `AED ${remaining.toLocaleString()}`, color: remaining > 0 ? "text-slate-700" : "text-emerald-700" },
                    { label: "Overdue", value: overdueAmt > 0 ? `AED ${overdueAmt.toLocaleString()}` : "—", color: overdueAmt > 0 ? "text-red-600 font-bold" : "text-slate-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-50">
                  {deal.payments.map((p: any) => {
                    const isOverdue = p.status === "OVERDUE";
                    const isPartial = p.status === "PARTIAL";
                    const overdueDays = (isOverdue || (isPartial && new Date(p.dueDate) < new Date()))
                      ? Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000)
                      : 0;
                    const partialReceived = p.partialPayments?.reduce((s: number, pp: any) => s + pp.amount, 0) ?? 0;
                    const partialRemaining = isPartial ? (p.amount - partialReceived) : 0;
                    const auditOpen = expandedAuditId === p.id;
                    const rowBg = isOverdue ? "bg-red-50/60" : isPartial ? "bg-amber-50/60" : p.status === "PAID" ? "bg-emerald-50/40" : "";
                    return (
                      <div key={p.id} className={rowBg}>
                        <div className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className={`text-sm font-medium ${isOverdue ? "text-red-800" : isPartial ? "text-amber-800" : "text-slate-800"}`}>{p.milestoneLabel}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {p.scheduleTrigger === "ON_SPA_SIGNING" && p.status === "PENDING" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Due on SPA Signing</span>
                              ) : p.scheduleTrigger === "ON_OQOOD" && p.status === "PENDING" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Due on Oqood</span>
                              ) : p.scheduleTrigger === "ON_HANDOVER" && p.status === "PENDING" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Due on Handover</span>
                              ) : (
                                <p className="text-xs text-slate-400">Due {fmtDate(p.dueDate)}</p>
                              )}
                              {isOverdue && <span className="text-xs font-semibold text-red-600">{overdueDays}d overdue</span>}
                              {isPartial && overdueDays > 0 && <span className="text-xs font-semibold text-red-600">{overdueDays}d overdue</span>}
                              {isPartial && <span className="text-xs text-amber-700">Remaining: AED {partialRemaining.toLocaleString()}</span>}
                              {p.lastReminderSentAt && (
                                <span className="text-xs text-slate-400" title={`Reminder count: ${p.reminderCount ?? 0}`}>
                                  Reminded {timeAgo(p.lastReminderSentAt)}
                                </span>
                              )}
                              {(p.auditLog?.length > 0) && (
                                <button onClick={() => setExpandedAuditId(auditOpen ? null : p.id)} className="text-xs text-blue-500 hover:underline">
                                  {auditOpen ? "Hide" : `History (${p.auditLog.length})`}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${isOverdue ? "text-red-700" : "text-slate-800"}`}>AED {p.amount.toLocaleString()}</p>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAY_BADGE[p.status] || "bg-slate-100 text-slate-600"}`}>
                                {p.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {(p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIAL") ? (
                                <>
                                  <button
                                    onClick={() => { setShowMarkPaidModal(p.id); setPaidDate(new Date().toISOString().slice(0,10)); setPaidRef(""); setPaidNotes(""); }}
                                    disabled={payingId === p.id}
                                    className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                  >
                                    {payingId === p.id ? "…" : "Mark Paid"}
                                  </button>
                                  <button
                                    onClick={() => { setShowPartialModal(p.id); setPartialAmount(""); setPartialMethod("BANK_TRANSFER"); setPartialRef(""); setPartialNotes(""); }}
                                    className="px-2.5 py-1 text-xs font-medium border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                                  >
                                    Partial
                                  </button>
                                  {p.status !== "PARTIAL" && (
                                    <button
                                      onClick={() => { setShowPdcModal(p.id); setPdcForm({ pdcNumber: "", pdcBank: "", pdcDate: "" }); }}
                                      className="px-2.5 py-1 text-xs font-medium border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                                    >
                                      PDC
                                    </button>
                                  )}
                                  {!p.isWaived && (
                                    <button
                                      onClick={() => { setWaiveId(p.id); setWaiveReason(""); }}
                                      className="px-2.5 py-1 text-xs font-medium border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      Waive
                                    </button>
                                  )}
                                </>
                              ) : p.status === "PDC_PENDING" ? (
                                <>
                                  <button
                                    onClick={() => handlePdcAction(p.id, "pdc-cleared")}
                                    disabled={pdcId === p.id}
                                    className="px-2.5 py-1 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                                  >
                                    Cleared
                                  </button>
                                  <button
                                    onClick={() => handlePdcAction(p.id, "pdc-bounced")}
                                    disabled={pdcId === p.id}
                                    className="px-2.5 py-1 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                  >
                                    Bounced
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {/* Invoice / Receipt document buttons */}
                        {(() => {
                          const invoiceDoc = invoiceDocByPayment(p.id);
                          const receiptDoc = receiptDocByPayment(p.id);
                          const canInvoice = ["PENDING", "OVERDUE", "PARTIAL"].includes(p.status);
                          const canReceipt = ["PAID", "PARTIAL"].includes(p.status);
                          if (!canInvoice && !canReceipt) return null;
                          return (
                            <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
                              {canInvoice && (
                                invoiceDoc ? (
                                  <a
                                    href={`/payments/${p.id}/print/invoice?docId=${invoiceDoc.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 text-xs font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                  >
                                    View Invoice
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => generateInvoice(p.id)}
                                    disabled={generatingInvoice === p.id}
                                    className="px-2.5 py-1 text-xs font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                                  >
                                    {generatingInvoice === p.id ? "Generating…" : "Generate Invoice"}
                                  </button>
                                )
                              )}
                              {canReceipt && (
                                receiptDoc ? (
                                  <a
                                    href={`/payments/${p.id}/print/receipt?docId=${receiptDoc.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 text-xs font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                                  >
                                    View Receipt
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => generateReceipt(p.id)}
                                    disabled={generatingReceipt === p.id}
                                    className="px-2.5 py-1 text-xs font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                  >
                                    {generatingReceipt === p.id ? "Generating…" : "Generate Receipt"}
                                  </button>
                                )
                              )}
                            </div>
                          );
                        })()}
                        {/* Audit log accordion */}
                        {auditOpen && p.auditLog?.length > 0 && (
                          <div className="px-5 pb-3">
                            <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
                              {p.auditLog.map((log: any) => (
                                <div key={log.id} className="px-3 py-2 flex items-start justify-between gap-3">
                                  <div>
                                    <span className="text-xs font-semibold text-slate-700">{log.action.replace(/_/g, " ")}</span>
                                    {log.reason && <span className="text-xs text-slate-500 ml-2">· {log.reason}</span>}
                                    <p className="text-xs text-slate-400 mt-0.5">by {log.changedBy}</p>
                                  </div>
                                  <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(log.changedAt)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )
            )}

            {/* Activity tab */}
            {activeTab === "activity" && (
              <div>
                {/* Quick-log bar */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                  {([
                    { type: "NOTE",    label: "Note",    icon: "📝" },
                    { type: "CALL",    label: "Call",    icon: "📞" },
                    { type: "MEETING", label: "Meeting", icon: "🤝" },
                    { type: "SITE_VISIT", label: "Site Visit", icon: "🏢" },
                  ] as const).map(({ type, label, icon }) => (
                    <button
                      key={type}
                      onClick={() => { setActivityForm((f) => ({ ...f, type })); setShowActivityForm(true); }}
                      className={`px-3 py-1.5 text-xs font-semibold border rounded-lg flex items-center gap-1.5 transition-colors ${
                        showActivityForm && activityForm.type === type
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                  {showActivityForm && (
                    <button
                      onClick={() => setShowActivityForm(false)}
                      className="ml-auto text-xs text-slate-400 hover:text-slate-600"
                    >✕ Cancel</button>
                  )}
                </div>

                {/* Inline log form */}
                {showActivityForm && (
                  <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {(["NOTE","CALL","WHATSAPP","EMAIL","MEETING","SITE_VISIT"] as const).map((t) => (
                        <button key={t} onClick={() => setActivityForm((f) => ({ ...f, type: t }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            activityForm.type === t ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 bg-white text-slate-600 hover:border-blue-400"
                          }`}
                        >{t.replace("_", " ")}</button>
                      ))}
                    </div>
                    <textarea
                      value={activityForm.summary}
                      onChange={(e) => setActivityForm((f) => ({ ...f, summary: e.target.value }))}
                      placeholder="Summary *"
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Activity Date</label>
                        <input type="datetime-local" value={activityForm.activityDate}
                          onChange={(e) => setActivityForm((f) => ({ ...f, activityDate: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Follow-up Date</label>
                        <input type="datetime-local" value={activityForm.followUpDate}
                          onChange={(e) => setActivityForm((f) => ({ ...f, followUpDate: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <button
                      onClick={submitActivity}
                      disabled={!activityForm.summary.trim() || submittingActivity}
                      className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingActivity ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}

                {/* Timeline */}
                {activityLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">No activities yet — log the first one above</p>
                ) : (
                  <div className="px-5 pt-3 pb-2">
                    {activities.map((a: any, i: number) => {
                      const icon   = activityIcon(a.type, a.summary);
                      const isSystem = a.type === "NOTE" && isSystemActivity(a.summary);
                      return (
                        <div key={a.id} className="flex gap-3">
                          {/* Left connector */}
                          <div className="flex flex-col items-center flex-shrink-0 w-8">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm z-10 ${isSystem ? "bg-slate-100" : "bg-blue-50"}`}>
                              {icon}
                            </div>
                            {i < activities.length - 1 && (
                              <div className="w-0.5 bg-slate-100 flex-1 my-1" style={{ minHeight: "1.25rem" }} />
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{a.type.replace("_", " ")}</span>
                                {isSystem && (
                                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">auto</span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(a.activityDate || a.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{a.summary}</p>
                            {a.outcome && <p className="text-xs text-slate-500 mt-1 italic">{a.outcome}</p>}
                            {a.followUpDate && (
                              <p className="text-xs text-amber-600 mt-0.5">Follow-up: {fmtDate(a.followUpDate)}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">{a.createdBy}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tasks tab */}
            {activeTab === "tasks" && (
              <div className="divide-y divide-slate-50">
                <div className="px-5 py-3">
                  <button onClick={() => setShowAddTaskForm((v) => !v)} className="text-xs font-semibold text-blue-600 hover:underline">
                    {showAddTaskForm ? "− Cancel" : "+ Add Task"}
                  </button>
                  {showAddTaskForm && (
                    <div className="mt-3 space-y-2">
                      <input type="text" value={addTaskForm.title}
                        onChange={(e) => setAddTaskForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Task title *"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select value={addTaskForm.type} onChange={(e) => setAddTaskForm((f) => ({ ...f, type: e.target.value }))}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 focus:outline-none">
                          {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                        </select>
                        <select value={addTaskForm.priority} onChange={(e) => setAddTaskForm((f) => ({ ...f, priority: e.target.value }))}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 focus:outline-none">
                          {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="datetime-local" value={addTaskForm.dueDate}
                          onChange={(e) => setAddTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 focus:outline-none" />
                      </div>
                      <button onClick={submitDealTask} disabled={!addTaskForm.title.trim() || !addTaskForm.dueDate || addingTask}
                        className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {addingTask ? "Creating…" : "Create Task"}
                      </button>
                    </div>
                  )}
                </div>
                {tasksLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : dealTasks.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">No open tasks</p>
                ) : dealTasks.map((t: any) => {
                  const isOverdue = new Date(t.dueDate) < new Date();
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 group">
                      <button onClick={() => completeDealTask(t.id)} disabled={completingTaskId === t.id}
                        className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{t.type.replace(/_/g," ")}</span>
                          <span className={`text-xs font-semibold ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                            {isOverdue ? "Overdue · " : ""}{fmtDate(t.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stage history tab */}
            {activeTab === "history" && (
              !deal.stageHistory || deal.stageHistory.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No stage history yet</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {deal.stageHistory.map((h) => (
                    <div key={h.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[h.oldStage] || "bg-slate-100 text-slate-600"}`}>{h.oldStage.replace(/_/g," ")}</span>
                          <span className="text-slate-400 text-xs">→</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[h.newStage] || "bg-slate-100 text-slate-600"}`}>{h.newStage.replace(/_/g," ")}</span>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(h.changedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{h.changedBy === "system" ? "System" : h.changedBy}</span>
                        {h.reason && <span className="text-xs text-slate-400 italic">· {h.reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Sidebar: Deal Status + Oqood + Commission */}
        <div className="space-y-4">

          {/* ── Deal Status ─────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Deal Status</h3>

            {/* Current stage */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`}>
                {deal.stage.replace(/_/g, " ")}
              </span>
            </div>

            {/* Reserve Unit primary action */}
            {deal.stage === "RESERVATION_PENDING" && (
              <button
                onClick={handleReserveUnit}
                disabled={reserving}
                className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors mb-3 flex items-center justify-center gap-2"
              >
                {reserving ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Reserving…</>
                ) : "Reserve Unit"}
              </button>
            )}
            {deal.stage === "RESERVATION_CONFIRMED" && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3">
                <span className="text-base">✓</span>
                <span className="text-sm font-bold">Unit Reserved</span>
              </div>
            )}

            {/* Valid next stages */}
            {deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 font-medium mb-2">Next stage:</p>
                {(VALID_DEAL_TRANSITIONS[deal.stage] ?? []).filter((s) => s !== "CANCELLED").map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStageChange(s)}
                    disabled={updatingStage}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-all"
                  >
                    → {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            )}

            {/* Stage requirements checklist */}
          </div>

          {/* Oqood countdown */}
          <div className={`rounded-xl border p-4 ${oqoodStyle}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 opacity-70">Oqood Deadline</h3>
            {oqood.isOverdue ? (
              <div>
                <p className="text-2xl font-bold">Overdue</p>
                <p className="text-sm mt-1">{Math.abs(oqood.daysRemaining)} days past deadline</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl font-bold">{oqood.daysRemaining}</p>
                <p className="text-sm mt-1">days remaining</p>
              </div>
            )}
            <p className="text-xs mt-3 opacity-70">Deadline: {fmtDate(oqood.deadline)}</p>
            <div className="mt-3">
              <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current rounded-full opacity-60"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - (oqood.daysRemaining / 90) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Commission */}
          {commission && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Commission</h3>
              <p className="text-2xl font-bold text-slate-900 mb-0.5">AED {commission.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mb-3">{commission.rate}% rate</p>

              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-4 ${
                commission.status === "PAID"             ? "bg-emerald-100 text-emerald-700" :
                commission.status === "APPROVED"         ? "bg-blue-100 text-blue-700" :
                commission.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {commission.status.replace(/_/g, " ")}
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Unlock Conditions</p>
                {[
                  { label: "SPA Signed",       met: spaOk },
                  { label: "Oqood Registered", met: oqoodOk },
                ].map(({ label, met }) => (
                  <div key={label} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${met ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    <span className="font-bold">{met ? "✓" : "✗"}</span>
                    <span className="font-medium">{label}</span>
                  </div>
                ))}
                {spaOk && oqoodOk && (
                  <p className="text-xs text-center text-emerald-600 font-semibold mt-1">All conditions met ✓</p>
                )}
              </div>
            </div>
          )}

          {/* Next Stage Requirements */}
          {stageRequirements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Next Stage Checklist</h3>
              <div className="space-y-2">
                {stageRequirements.map((req) => (
                  <div
                    key={req.documentType}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${req.uploaded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    <span className="font-bold text-base leading-none">{req.uploaded ? "✓" : "○"}</span>
                    <span className="font-medium">{req.label}</span>
                  </div>
                ))}
              </div>
              {stageRequirements.every((r) => r.uploaded) ? (
                <p className="text-xs text-center text-emerald-600 font-semibold mt-2">Ready to advance ✓</p>
              ) : (
                <p className="text-xs text-center text-amber-600 mt-2">Upload missing documents to advance</p>
              )}
            </div>
          )}

          {/* Broker */}
          {deal.brokerCompany && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Broker</h3>
              <p className="text-sm font-semibold text-slate-800">{deal.brokerCompany.name}</p>
              {deal.brokerAgent && <p className="text-xs text-slate-500 mt-0.5">{deal.brokerAgent.name}</p>}
            </div>
          )}

          {/* Reservation date */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reserved On</h3>
            <p className="text-base font-semibold text-slate-800">{fmtDate(deal.reservationDate)}</p>
          </div>
        </div>
      </div>

      {/* ── Reserve Unit Confirmation Modal ───────────────────────────────────── */}
      {showReserveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Confirm Reservation</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 font-medium">
                  This will lock Unit <span className="font-bold">{deal?.unit.unitNumber}</span> and prevent any other deal from booking it.
                </p>
                <p className="text-xs text-amber-600 mt-1.5">This action cannot be undone by agents. Only an Admin can release a reserved unit.</p>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Buyer</span>
                  <span className="font-medium">{deal?.lead.firstName} {deal?.lead.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unit</span>
                  <span className="font-medium">{deal?.unit.unitNumber} · {deal?.unit.type.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Price</span>
                  <span className="font-bold text-blue-700">AED {deal?.salePrice.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={confirmReserveUnit}
                  disabled={reserving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {reserving ? "Reserving…" : "Confirm — Reserve Unit"}
                </button>
                <button
                  onClick={() => setShowReserveConfirm(false)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Deal Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Cancel Deal</h3>
              <p className="text-xs text-slate-400 mt-0.5">This will release the unit back to available.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client withdrew, financing fell through…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-red-400 resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(""); }} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">
                Keep Deal
              </button>
              <button
                onClick={handleCancelDeal}
                disabled={!cancelReason.trim() || cancelling}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel Deal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Mark Payment as Paid</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                <select
                  value={paidMethod}
                  onChange={(e) => setPaidMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                >
                  {["BANK_TRANSFER","CASH","CHEQUE","CARD","CRYPTO"].map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reference / Receipt No.</label>
                <input
                  type="text"
                  value={paidRef}
                  onChange={(e) => setPaidRef(e.target.value)}
                  placeholder="e.g. TXN-12345"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={paidNotes}
                  onChange={(e) => setPaidNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowMarkPaidModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">
                Cancel
              </button>
              <button
                onClick={confirmMarkPaid}
                disabled={payingId !== null}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
              >
                {payingId ? "Saving…" : "Confirm Paid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Record Partial Payment</h3>
              <p className="text-xs text-slate-400 mt-0.5">Enter the amount received so far.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount Received (AED) *</label>
                <input
                  type="number"
                  min="1"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                <select
                  value={partialMethod}
                  onChange={(e) => setPartialMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                >
                  {["BANK_TRANSFER","CASH","CHEQUE","CARD","CRYPTO"].map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reference / Receipt No.</label>
                <input
                  type="text"
                  value={partialRef}
                  onChange={(e) => setPartialRef(e.target.value)}
                  placeholder="e.g. TXN-12345"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={partialNotes}
                  onChange={(e) => setPartialNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowPartialModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">
                Cancel
              </button>
              <button
                onClick={confirmPartial}
                disabled={submittingPartial || !partialAmount || parseFloat(partialAmount) <= 0}
                className="flex-1 py-2.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 text-sm disabled:opacity-50"
              >
                {submittingPartial ? "Saving…" : "Record Partial"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentUploadModal && (
        <DocumentUploadModal
          dealId={dealId}
          onClose={() => setShowDocumentUploadModal(false)}
          onSaved={() => {
            setDocumentKey((prev) => prev + 1);
          }}
        />
      )}

      {/* PDC Modal */}
      {showPdcModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Register Post-Dated Cheque</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cheque Number</label>
                <input type="text" value={pdcForm.pdcNumber} onChange={(e) => setPdcForm((f) => ({...f, pdcNumber: e.target.value}))}
                  placeholder="e.g. 001234" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bank</label>
                <input type="text" value={pdcForm.pdcBank} onChange={(e) => setPdcForm((f) => ({...f, pdcBank: e.target.value}))}
                  placeholder="e.g. Emirates NBD" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cheque Date</label>
                <input type="date" value={pdcForm.pdcDate} onChange={(e) => setPdcForm((f) => ({...f, pdcDate: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowPdcModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              <button onClick={confirmPdc} disabled={pdcId !== null} className="flex-1 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50">
                {pdcId ? "Saving…" : "Register PDC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waive Payment Modal */}
      {waiveId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Waive Payment</h3>
              <p className="text-xs text-slate-400 mt-0.5">This removes the payment from collection obligations.</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason *</label>
              <textarea value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="e.g. Developer incentive, agreed waiver…"
                rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" />
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setWaiveId(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              <button onClick={confirmWaive} disabled={submittingWaive || !waiveReason.trim()}
                className="flex-1 py-2.5 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-900 text-sm disabled:opacity-50">
                {submittingWaive ? "Waiving…" : "Waive Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Milestone Modal */}
      {showAddMilestone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Add Custom Milestone</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Label *</label>
                <input type="text" value={milestoneForm.label} onChange={(e) => setMilestoneForm((f) => ({...f, label: e.target.value}))}
                  placeholder="e.g. Handover Balance" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (AED) *</label>
                <input type="number" min="1" value={milestoneForm.amount} onChange={(e) => setMilestoneForm((f) => ({...f, amount: e.target.value}))}
                  placeholder="e.g. 50000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date *</label>
                <input type="date" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm((f) => ({...f, dueDate: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <input type="text" value={milestoneForm.notes} onChange={(e) => setMilestoneForm((f) => ({...f, notes: e.target.value}))}
                  placeholder="Optional" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowAddMilestone(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              <button onClick={confirmAddMilestone} disabled={addingMilestone || !milestoneForm.label || !milestoneForm.amount || !milestoneForm.dueDate}
                className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                {addingMilestone ? "Adding…" : "Add Milestone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restructure Schedule Modal */}
      {showRestructure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Restructure Payment Schedule</h3>
              <p className="text-xs text-slate-400 mt-0.5">Shifts all future PENDING payments by N days.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Shift by (days) *</label>
                <input type="number" value={restructureDays} onChange={(e) => setRestructureDays(e.target.value)}
                  placeholder="e.g. 30 (positive = later, negative = earlier)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason *</label>
                <textarea value={restructureReason} onChange={(e) => setRestructureReason(e.target.value)}
                  placeholder="e.g. Construction delay, handover pushed to Q3 2026…"
                  rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowRestructure(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              <button onClick={confirmRestructure} disabled={submittingRestructure || !restructureDays || !restructureReason.trim()}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50">
                {submittingRestructure ? "Restructuring…" : "Apply Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <DealEditModal
          deal={deal}
          onClose={() => setShowEditModal(false)}
          onSaved={loadDeal}
        />
      )}

      <ConfirmDialog
        open={!!pendingStage}
        title="Change Deal Stage"
        message={`Move deal to "${pendingStage?.replace(/_/g, " ")}"? This will trigger all associated side effects.`}
        confirmLabel="Move Stage"
        variant="warning"
        onConfirm={confirmStageChange}
        onCancel={() => setPendingStage(null)}
      />

      {/* Pause Reminders Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Pause Payment Reminders</h3>
              <p className="text-xs text-slate-400 mt-1">No automated emails will be sent while paused.</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason <span className="text-slate-400">(optional)</span></label>
                <textarea
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g. Buyer requested delay"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Resume on <span className="text-slate-400">(optional)</span></label>
                <input
                  type="date"
                  value={pauseUntil}
                  onChange={(e) => setPauseUntil(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => togglePauseReminders(true)}
                disabled={pausingReminders}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {pausingReminders ? "Pausing…" : "Pause Reminders"}
              </button>
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
