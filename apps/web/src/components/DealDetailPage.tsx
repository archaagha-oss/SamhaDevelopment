import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import axios from "axios";
import { toast } from "sonner";
import {
  Pencil,
  Check,
  X,
  Copy,
  Lock,
  FileText,
  ClipboardList,
  DollarSign,
  Bell,
  Phone,
  Handshake,
  Building2,
  CreditCard,
  Home,
  AlertTriangle,
  Circle,
} from "lucide-react";
import { formatArea } from "../utils/formatArea";
import DocumentUploadModal from "./DocumentUploadModal";
import DocumentBrowser from "./DocumentBrowser";
import DealPurchasersModal from "./DealPurchasersModal";
import DealSpaCompliancePanel from "./DealSpaCompliancePanel";
import ConfirmDialog from "./ConfirmDialog";
import { DetailPageLayout } from "./layout";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MoreHorizontal, Trash2, StickyNote, FileSignature, Users } from "lucide-react";
import NextStepCard from "@/components/ui/NextStepCard";
import { StageBadge } from "@/components/ui/stage-badge";
import DealTimeline from "./DealTimeline";
import ConversationThread, { ConversationReplyBox } from "./ConversationThread";
import { useEventStream } from "../hooks/useEventStream";
import { DirhamSign } from "@/components/ui/DirhamSign";
import { formatDirham } from "@/lib/money";
import { formatDate } from "../utils/format";

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
  RESERVATION_PENDING: "bg-muted text-muted-foreground", RESERVATION_CONFIRMED: "bg-info-soft text-primary",
  SPA_PENDING: "bg-warning-soft text-warning", SPA_SENT: "bg-warning-soft text-warning",
  SPA_SIGNED: "bg-stage-active text-stage-active-foreground", OQOOD_PENDING: "bg-warning-soft text-warning",
  OQOOD_REGISTERED: "bg-chart-5/15 text-chart-5", INSTALLMENTS_ACTIVE: "bg-stage-active text-stage-active-foreground",
  HANDOVER_PENDING: "bg-success-soft text-success", COMPLETED: "bg-success-soft text-success",
  CANCELLED: "bg-destructive-soft text-destructive",
};
const PAY_BADGE: Record<string, string> = {
  PAID: "bg-success-soft text-success", PENDING: "bg-warning-soft text-warning",
  PARTIAL: "bg-warning-soft text-warning", OVERDUE: "bg-destructive-soft text-destructive",
  PDC_PENDING: "bg-warning-soft text-warning",
  PDC_CLEARED: "bg-chart-5/15 text-chart-5", CANCELLED: "bg-muted text-muted-foreground",
};
const OQOOD_COLOR: Record<string, string> = {
  green: "text-success bg-success-soft border-success/30",
  yellow: "text-warning bg-warning-soft border-warning/30",
  red: "text-destructive bg-destructive-soft border-destructive/30",
  overdue: "text-destructive bg-destructive-soft border-destructive/30",
};
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
// Local timeAgo() removed in favour of `formatRelative` / `formatTimestamp`
// from utils/format.ts (UX_AUDIT_2 §R4).

export default function DealDetailPage({ dealId: dealIdProp, onBack }: Props) {
  const params = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const dealId = dealIdProp ?? params.dealId ?? "";
  const handleBack = onBack ?? (() => navigate("/deals"));
  const handoverEnabled = useFeatureFlag("handoverChecklist");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Array<{
    kind: string; severity: "EXPIRED" | "CRITICAL" | "WARNING" | "ATTENTION" | "OK";
    daysToExpiry: number; ownerName: string; expiresAt: string;
  }>>([]);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showStageSelect, setShowStageSelect] = useState(false);
  const [stageReason, setStageReason] = useState("");
  // Collapsed-by-default note inputs (UX_AUDIT_2 M6 / S3).
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
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

  // Quick note input
  const [quickNote, setQuickNote] = useState("");
  const [addingQuickNote, setAddingQuickNote] = useState(false);

  const submitQuickNote = async () => {
    if (!quickNote.trim() || !deal) return;
    setAddingQuickNote(true);
    try {
      await axios.post(`/api/deals/${dealId}/activities`, {
        type: "NOTE",
        summary: quickNote.trim(),
        activityDate: new Date().toISOString().slice(0, 16),
      });
      setQuickNote("");
      toast.success("Note added");
      loadActivities();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add note");
    } finally {
      setAddingQuickNote(false);
    }
  };

  // Waive payment
  const [waiveId, setWaiveId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [submittingWaive, setSubmittingWaive] = useState(false);

  // Stage change confirmation
  const [pendingStage, setPendingStage] = useState<string | null>(null);

  // Regenerate Sales Offer confirmation
  const [showRegenSalesOffer, setShowRegenSalesOffer] = useState(false);
  const [showPurchasersModal, setShowPurchasersModal] = useState(false);

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
  const [activeTab, setActiveTab] = useState<"timeline" | "payments" | "history" | "activity" | "tasks">("timeline");
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
    axios.get(`/api/compliance/deal/${dealId}/blockers`)
      .then((r) => setBlockers(r.data?.data ?? []))
      .catch(() => setBlockers([]));
  }, [dealId]);

  const loadActivities = useCallback(() => {
    setActivityLoading(true);
    axios.get(`/api/deals/${dealId}/activities`)
      .then((r) => setActivities(r.data || []))
      .catch(() => setActivities([]))
      .finally(() => setActivityLoading(false));
  }, [dealId]);

  // Live: refresh activities when an inbound message lands on this deal
  useEventStream("activity.inbound", (data: { dealId?: string | null }) => {
    if (dealId && data?.dealId === dealId) loadActivities();
  });

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
      <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !deal) return (
    <div className="p-6">
      <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">← Back</button>
      <div className="bg-destructive-soft border border-destructive/30 rounded-xl p-6 text-center">
        <p className="text-destructive font-medium">{error || "Deal not found"}</p>
        <button onClick={handleBack} className="mt-3 text-sm text-destructive underline">Go back</button>
      </div>
    </div>
  );

  const netPrice      = deal.salePrice - deal.discount;

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

  // ── UX_AUDIT_2 (deal-detail) helpers ───────────────────────────────────────
  // Stages where Oqood / Commission / etc. are operationally relevant.
  // Aside cards render only when their stage applies → cuts the 7-card sidebar
  // down to 2-3 most days.
  const oqoodRelevant      = ["SPA_SIGNED", "OQOOD_PENDING", "INSTALLMENTS_ACTIVE", "COMPLETED"].includes(deal.stage);
  const commissionRelevant = ["SPA_SIGNED", "OQOOD_PENDING", "INSTALLMENTS_ACTIVE", "COMPLETED"].includes(deal.stage) && !!commission;

  const validNext = (VALID_DEAL_TRANSITIONS[deal.stage] ?? []).filter((s) => s !== "CANCELLED");
  const terminal  = deal.stage === "CANCELLED" || deal.stage === "COMPLETED";

  // Dynamic primary CTA — one button per stage. Drives both PageHeader actions
  // and the mobileBottomBar. Returns null when the stage has no obvious next
  // operational click (NextStepCard's "Move to STAGE" covers that case).
  const renderPrimaryCTA = (className: string) => {
    if (deal.stage === "RESERVATION_PENDING") {
      return (
        <button
          onClick={handleReserveUnit}
          disabled={reserving}
          className={`${className} bg-success text-white hover:bg-success/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5`}
        >
          {reserving ? "Reserving…" : (<><Lock className="size-4" /> Reserve Unit</>)}
        </button>
      );
    }
    if (deal.stage === "RESERVATION_CONFIRMED" && salesOfferDocs.length === 0 && canGenerateSalesOffer) {
      return (
        <button
          onClick={() => handleGenerateDocument("SALES_OFFER")}
          disabled={!!generatingDoc}
          className={`${className} bg-primary text-white hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5`}
        >
          {generatingDoc === "SALES_OFFER" ? "Generating…" : (<><FileText className="size-4" /> Generate Sales Offer</>)}
        </button>
      );
    }
    if (deal.stage === "SPA_PENDING" || deal.stage === "SPA_SENT") {
      return (
        <button
          onClick={() => handleGenerateDocument("SPA")}
          disabled={!!generatingDoc}
          className={`${className} bg-accent-2 text-accent-2-foreground hover:bg-accent-2/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5`}
        >
          {generatingDoc === "SPA" ? "Generating…" : (<><FileSignature className="size-4" /> Generate SPA</>)}
        </button>
      );
    }
    if (deal.stage === "OQOOD_PENDING") {
      return (
        <button
          onClick={() => setShowDocumentUploadModal(true)}
          className={`${className} bg-warning text-white hover:bg-warning/90 inline-flex items-center justify-center gap-1.5`}
        >
          <ClipboardList className="size-4" /> Record Oqood
        </button>
      );
    }
    if ((deal.stage === "INSTALLMENTS_ACTIVE" || deal.stage === "SPA_SIGNED") && deal.payments.some((p: any) => p.status === "PENDING" || p.status === "OVERDUE")) {
      return (
        <button
          onClick={() => {
            const nextPayment = deal.payments.find((p: any) => p.status === "PENDING" || p.status === "OVERDUE");
            if (nextPayment) { setShowMarkPaidModal(nextPayment.id); setPaidDate(new Date().toISOString().slice(0,10)); }
          }}
          className={`${className} bg-primary text-white hover:bg-primary/90 inline-flex items-center justify-center gap-1.5`}
        >
          <DollarSign className="size-4" /> Record Payment
        </button>
      );
    }
    return null;
  };

  // KPI strip values (N4).
  const kpiPaidPct      = paidPct;
  const kpiOqoodLabel   = oqood.isOverdue
    ? `${Math.abs(oqood.daysRemaining)}d overdue`
    : `${oqood.daysRemaining}d`;
  const commissionPill  = commission
    ? commission.status === "PAID"             ? "Paid"
    : commission.status === "APPROVED"         ? "Approved"
    : commission.status === "PENDING_APPROVAL" ? "Pending approval"
    : "Pending"
    : "—";

  // Notes/Quick-note collapse state.

  return (
    <DetailPageLayout
      crumbs={[
        { label: "Deals", path: "/deals" },
        { label: deal.dealNumber },
      ]}
      title={`${deal.lead.firstName} ${deal.lead.lastName}`}
      subtitle={(
        <span className="inline-flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={copyDealId}
            className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
            title="Copy deal ID"
          >
            {deal.dealNumber}
            {copiedDealId ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          </button>
          <span className="text-muted-foreground/50">·</span>
          <span className="tabular-nums text-muted-foreground">{deal.lead.phone}</span>
          <StageBadge kind="deal" stage={deal.stage} />
          {deal.reservationDate && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">Reserved {fmtDate(deal.reservationDate)}</span>
            </>
          )}
          {deal.paymentPlan && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">Plan: <span className="font-medium text-foreground">{deal.paymentPlan.name}</span></span>
            </>
          )}
        </span>
      )}
      actions={(
        <>
          {renderPrimaryCTA("px-4 py-1.5 text-sm font-bold rounded-lg shadow-sm")}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More actions"
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate(`/deals/${dealId}/edit`)}>
                <Pencil className="size-3.5 mr-2" /> Edit deal
              </DropdownMenuItem>
              {dealId && (
                <DropdownMenuItem onClick={() => navigate(`/deals/${dealId}/parties`)}>
                  <Users className="size-3.5 mr-2" /> Joint owners…
                </DropdownMenuItem>
              )}
              {handoverEnabled && dealId && (
                <DropdownMenuItem onClick={() => navigate(`/deals/${dealId}/handover`)}>
                  <ClipboardList className="size-3.5 mr-2" /> Handover…
                </DropdownMenuItem>
              )}
              {validNext.length > 0 && (
                <DropdownMenuItem onClick={() => setShowStageSelect(true)}>
                  <FileSignature className="size-3.5 mr-2" /> Change stage…
                </DropdownMenuItem>
              )}
              {!terminal && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowCancelModal(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-2" /> Cancel deal
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      mobileBottomBar={renderPrimaryCTA("w-full py-2.5 rounded-lg text-sm font-bold")}
      tabs={(
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-thin" role="tablist">
          {(["timeline", "payments", "activity", "history"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-primary/40 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "timeline" ? "Timeline" : tab === "payments" ? "Payments" : tab === "activity" ? "Activity" : "History"}
            </button>
          ))}
        </div>
      )}
      kpis={(
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sale price</div>
            <div className="text-lg font-bold text-foreground tabular-nums">{formatDirham(deal.salePrice)}</div>
            <div className="text-[11px] text-muted-foreground">{deal.unit.unitNumber}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Paid</div>
            <div className="text-lg font-bold text-foreground tabular-nums">{kpiPaidPct}%</div>
            <div className="text-[11px] text-muted-foreground">{formatDirham(totalPaid)}{overdueAmt > 0 ? ` · ${formatDirham(overdueAmt)} overdue` : ""}</div>
          </div>
          <div className={`bg-card rounded-xl border border-border p-3 ${oqood.isOverdue ? "border-destructive/40" : ""}`}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Oqood</div>
            <div className={`text-lg font-bold tabular-nums ${oqood.isOverdue ? "text-destructive" : oqood.daysRemaining <= 14 ? "text-warning" : "text-foreground"}`}>
              {kpiOqoodLabel}
            </div>
            <div className="text-[11px] text-muted-foreground">{fmtDate(oqood.deadline)}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Commission</div>
            <div className="text-lg font-bold text-foreground tabular-nums">{commission ? formatDirham(commission.amount) : "—"}</div>
            <div className="text-[11px] text-muted-foreground">{commissionPill}</div>
          </div>
        </div>
      )}
      hero={blockers.length > 0 ? <ComplianceBanner blockers={blockers} /> : undefined}
      main={(
        <>


          {/* Buyer Info card removed (UX_AUDIT_2 M3) — identity is in PageHeader. */}

          {/* Quick note — collapsed by default. M6. */}
          {showQuickNote ? (
            <div className="bg-info-soft rounded-lg border border-primary/40 p-3 flex items-center gap-2">
              <input
                type="text"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitQuickNote(); }}
                placeholder="Add a quick note and press Enter…"
                autoFocus
                className="flex-1 bg-card border border-primary/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={submitQuickNote} disabled={!quickNote.trim() || addingQuickNote}
                className="px-3 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary/90 disabled:opacity-50">
                {addingQuickNote ? "…" : "Add"}
              </button>
              <button onClick={() => setShowQuickNote(false)}
                className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => setShowQuickNote(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <StickyNote className="size-3.5" /> Add quick note
            </button>
          )}

          {/* ── Unit Selection ──────────────────────────────────────────────── */}
          {/* S5 — promoted with accent border */}
          <div className="bg-card rounded-xl border-l-4 border-l-primary border-r border-y border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</h3>
              {deal.stage === "RESERVATION_PENDING" ? (
                <button
                  onClick={() => showChangeUnit ? setShowChangeUnit(false) : openChangeUnit()}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  {showChangeUnit ? "Cancel" : "Change Unit"}
                </button>
              ) : deal.unit.status === "RESERVED" ? (
                <span className="text-xs font-bold text-success bg-success-soft px-2.5 py-1 rounded-full border border-success/30">
                  Reserved (This Deal)
                </span>
              ) : null}
            </div>

            {/* Current unit summary */}
            <div className="flex items-center gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{deal.unit.unitNumber}</p>
                  {deal.unit.status === "RESERVED" && (
                    <span className="text-xs font-bold text-success bg-success-soft px-2 py-0.5 rounded-full border border-success/30">RESERVED</span>
                  )}
                  {deal.unit.status === "ON_HOLD" && (
                    <span className="text-xs font-medium text-warning bg-warning-soft px-2 py-0.5 rounded-full border border-warning/30">ON HOLD</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{deal.unit.type.replace(/_/g, " ")} · Floor {deal.unit.floor} · {formatArea(deal.unit.area)}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold text-primary">{formatDirham(deal.salePrice)}</p>
                <p className="text-xs text-muted-foreground">Sale Price</p>
              </div>
            </div>

            {/* Change Unit panel */}
            {showChangeUnit && (
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">Select a new unit to replace the current assignment. Only AVAILABLE units are shown.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Project</label>
                    <select
                      value={changeUnitProjectId}
                      onChange={(e) => handleChangeUnitProject(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                    >
                      <option value="">— Select project —</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
                    {loadingChangeUnits ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                        Loading…
                      </div>
                    ) : (
                      <select
                        value={changeUnitId}
                        onChange={(e) => setChangeUnitId(e.target.value)}
                        disabled={!changeUnitProjectId || changeUnitList.length === 0}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring disabled:opacity-50"
                      >
                        <option value="">
                          {!changeUnitProjectId ? "Select a project first" : changeUnitList.length === 0 ? "No available units" : "— Select unit —"}
                        </option>
                        {changeUnitList.map((u) => (
                          <option key={u.id} value={u.id}>
                            Unit {u.unitNumber} · {u.type.replace(/_/g, " ")} · Floor {u.floor} · {formatDirham(u.price)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleAssignUnit}
                  disabled={!changeUnitId || assigningUnit}
                  className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
              <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</h3>
                  {canGenerateSalesOffer && (
                    <button
                      onClick={() => hasExisting ? setShowRegenSalesOffer(true) : handleGenerateDocument("SALES_OFFER")}
                      disabled={!!generatingDoc}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {generatingDoc === "SALES_OFFER"
                        ? "Generating…"
                        : hasExisting ? "Generate New Version" : "Generate Sales Offer"}
                    </button>
                  )}
                  {!canGenerateSalesOffer && deal.stage !== "CANCELLED" && (
                    <span
                      className="text-xs text-muted-foreground italic cursor-default"
                      title="Reserve the unit first to unlock document generation"
                    >
                      Reserve unit first
                    </span>
                  )}
                </div>

                {/* Sales Offer version table — or actionable empty state */}
                {hasExisting ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 text-left text-muted-foreground">
                          <th className="px-3 py-2 font-semibold">Type</th>
                          <th className="px-3 py-2 font-semibold">Version</th>
                          <th className="px-3 py-2 font-semibold">Generated</th>
                          <th className="px-3 py-2 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesOfferDocs.map((doc) => (
                          <tr key={doc.id} className="border-t border-border">
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              Sales Offer
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">v{doc.version}</span>
                                {doc.version === latestVersion && (
                                  <span className="px-1.5 py-0.5 text-xs font-semibold bg-success-soft text-success rounded-full">Latest</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {fmtDate(doc.uploadedAt)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => window.open(`/deals/${dealId}/print/sales-offer?docId=${doc.id}`, "_blank")}
                                  className="px-2.5 py-1 text-xs font-semibold border border-primary/40 bg-info-soft text-primary rounded hover:bg-info-soft"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => window.open(`/deals/${dealId}/print/sales-offer?docId=${doc.id}&auto=print`, "_blank")}
                                  className="px-2.5 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary/90"
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
                  <div className="rounded-lg bg-muted/50 border border-dashed border-border px-4 py-5 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      No Sales Offer generated yet.
                      {canGenerateSalesOffer
                        ? " Generate one to send to the buyer."
                        : " Reserve the unit first to unlock document generation."}
                    </p>
                    {canGenerateSalesOffer && (
                      <button
                        onClick={() => handleGenerateDocument("SALES_OFFER")}
                        disabled={!!generatingDoc}
                        className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        {generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate Sales Offer"}
                      </button>
                    )}
                  </div>
                )}

                {/* Other document quick-actions */}
                <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                  <button
                    onClick={() => handleGenerateDocument("RESERVATION_FORM")}
                    disabled={!!generatingDoc}
                    className="px-3 py-1.5 text-xs font-semibold bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 disabled:opacity-50"
                  >
                    {generatingDoc === "RESERVATION_FORM" ? "Generating…" : "Reservation Form"}
                  </button>
                  <button
                    onClick={() => setShowPurchasersModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-muted text-foreground rounded-lg hover:bg-muted"
                    title="Edit joint purchasers before generating the SPA"
                  >
                    Manage Purchasers
                  </button>
                  <button
                    onClick={() => handleGenerateDocument("SPA")}
                    disabled={!!generatingDoc}
                    className="px-3 py-1.5 text-xs font-semibold bg-accent-2 text-accent-2-foreground rounded-lg hover:bg-accent-2 disabled:opacity-50"
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
              <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-base font-bold text-foreground mb-2">Generate New Version?</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  This will create a new version of the Sales Offer capturing the current deal
                  data. The existing version will remain accessible in the history.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowRegenSalesOffer(false)}
                    className="px-4 py-2 text-sm font-semibold text-muted-foreground bg-muted rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowRegenSalesOffer(false); handleGenerateDocument("SALES_OFFER"); }}
                    disabled={!!generatingDoc}
                    className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate New Version"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Internal notes — collapsed by default (S3) ───────────────────── */}
          {showNotes || (notesValue && notesValue.trim().length > 0) ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal notes</h3>
                <div className="flex items-center gap-2">
                  {notesSaved && <span className="text-xs text-success font-medium inline-flex items-center gap-1">Saved <Check className="size-3" /></span>}
                  <button onClick={() => setShowNotes(false)} className="text-xs text-muted-foreground hover:text-foreground">Hide</button>
                </div>
              </div>
              <textarea
                rows={3}
                value={notesValue ?? ""}
                onChange={(e) => { setNotesValue(e.target.value); setNotesSaved(false); }}
                placeholder="Internal deal notes…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring resize-none"
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-2 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {savingNotes ? "Saving…" : "Save notes"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNotes(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" /> Add internal notes
            </button>
          )}

          {/* Uploaded documents browser */}
          <DocumentBrowser
            key={documentKey}
            dealId={dealId}
            onUpload={() => setShowDocumentUploadModal(true)}
          />

          {/* SPA compliance — late fees, disposal, delay compensation, LD */}
          {dealId && <DealSpaCompliancePanel dealId={dealId} />}

          {/* Tab content panel — tab bar lives in PageHeader now (S6) */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {activeTab === "payments" && (
              <div className="flex items-center justify-end px-5 py-3 border-b border-border gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{paidPct}%</span>
                </div>
                <span className="text-xs text-muted-foreground inline-flex items-baseline gap-1">{formatDirham(totalPaid)} paid</span>
                  {deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (
                    <>
                      <button
                        onClick={() => { setShowAddMilestone(true); setMilestoneForm({ label: "", amount: "", dueDate: "", notes: "" }); }}
                        className="px-2 py-1 text-xs border border-primary/40 text-primary rounded-lg hover:bg-info-soft transition-colors"
                      >+ Milestone</button>
                      <button
                        onClick={() => { setShowRestructure(true); setRestructureDays(""); setRestructureReason(""); }}
                        className="px-2 py-1 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors"
                      >Restructure</button>
                    </>
                  )}
                  {/* Pause reminders toggle */}
                  {deal.payments.length > 0 && (
                    deal.remindersPaused ? (
                      <button
                        onClick={() => togglePauseReminders(false)}
                        disabled={pausingReminders}
                        className="ml-auto px-2 py-1 text-xs border border-warning/30 text-warning bg-warning-soft rounded-lg hover:bg-warning-soft transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Bell className="size-3" /> <span>Reminders Paused</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowPauseModal(true)}
                        className="ml-auto px-2 py-1 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-1"
                      >
                        <Bell className="size-3" /> <span>Pause Reminders</span>
                      </button>
                    )
                  )}
              </div>
            )}

            {/* Timeline tab */}
            {activeTab === "timeline" && deal && (
              <DealTimeline
                stage={deal.stage}
                reservationDate={deal.reservationDate}
                spaSignedDate={deal.documents?.find((d: any) => d.type === "SPA")?.uploadedAt}
                oqoodRegisteredDate={deal.documents?.find((d: any) => d.type === "OQOOD")?.uploadedAt}
                oqoodDeadline={deal.oqoodDeadline}
                completedDate={deal.stage === "COMPLETED" ? new Date().toISOString() : undefined}
              />
            )}

            {/* Payments tab */}
            {activeTab === "payments" && (
              deal.payments.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CreditCard className="mx-auto mb-2 size-12 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">No payment schedule yet</p>
                  <p className="text-xs text-muted-foreground">
                    {["RESERVATION_PENDING", "RESERVATION_CONFIRMED"].includes(deal.stage)
                      ? "A payment plan will appear here once the deal advances to SPA stage."
                      : "Assign a payment plan to this deal to generate the installment schedule."}
                  </p>
                </div>
              ) : (
                <>
                {/* Financial summary */}
                <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
                  {([
                    { label: "Total Price", value: formatDirham(netPrice), color: "text-foreground" },
                    { label: "Total Paid", value: formatDirham(totalPaid), color: "text-success" },
                    { label: "Remaining", value: formatDirham(remaining), color: remaining > 0 ? "text-foreground" : "text-success" },
                    { label: "Overdue", value: overdueAmt > 0 ? formatDirham(overdueAmt) : <>—</>, color: overdueAmt > 0 ? "text-destructive font-bold" : "text-muted-foreground" },
                  ] as Array<{ label: string; value: JSX.Element; color: string }>).map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold ${color} inline-flex items-baseline gap-1 justify-center`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {deal.payments.map((p: any) => {
                    const isOverdue = p.status === "OVERDUE";
                    const isPartial = p.status === "PARTIAL";
                    const overdueDays = (isOverdue || (isPartial && new Date(p.dueDate) < new Date()))
                      ? Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000)
                      : 0;
                    const partialReceived = p.partialPayments?.reduce((s: number, pp: any) => s + pp.amount, 0) ?? 0;
                    const partialRemaining = isPartial ? (p.amount - partialReceived) : 0;
                    const auditOpen = expandedAuditId === p.id;
                    const rowBg = isOverdue ? "bg-destructive-soft/60" : isPartial ? "bg-warning-soft/60" : p.status === "PAID" ? "bg-success-soft/40" : "";
                    return (
                      <div key={p.id} className={rowBg}>
                        <div className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className={`text-sm font-medium ${isOverdue ? "text-destructive-soft-foreground" : isPartial ? "text-warning-soft-foreground" : "text-foreground"}`}>{p.milestoneLabel}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {p.scheduleTrigger === "ON_SPA_SIGNING" && p.status === "PENDING" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-info-soft text-primary font-medium">Due on SPA Signing</span>
                              ) : p.scheduleTrigger === "ON_OQOOD" && p.status === "PENDING" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-chart-7/15 text-chart-7 font-medium">Due on Oqood</span>
                              ) : p.scheduleTrigger === "ON_HANDOVER" && p.status === "PENDING" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-success-soft text-success font-medium">Due on Handover</span>
                              ) : (
                                <p className="text-xs text-muted-foreground">Due {fmtDate(p.dueDate)}</p>
                              )}
                              {isOverdue && <span className="text-xs font-semibold text-destructive">{overdueDays}d overdue</span>}
                              {isPartial && overdueDays > 0 && <span className="text-xs font-semibold text-destructive">{overdueDays}d overdue</span>}
                              {isPartial && <span className="text-xs text-warning inline-flex items-baseline gap-1">Remaining: {formatDirham(partialRemaining)}</span>}
                              {p.lastReminderSentAt && (
                                <span className="text-xs text-muted-foreground" title={`Reminder count: ${p.reminderCount ?? 0}`}>
                                  Reminded on {formatDate(p.lastReminderSentAt)}
                                </span>
                              )}
                              {(p.auditLog?.length > 0) && (
                                <button onClick={() => setExpandedAuditId(auditOpen ? null : p.id)} className="text-xs text-primary hover:underline">
                                  {auditOpen ? "Hide" : `History (${p.auditLog.length})`}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${isOverdue ? "text-destructive" : "text-foreground"}`}>{formatDirham(p.amount)}</p>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAY_BADGE[p.status] || "bg-muted text-muted-foreground"}`}>
                                {p.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {(p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIAL") ? (
                                <>
                                  <button
                                    onClick={() => { setShowMarkPaidModal(p.id); setPaidDate(new Date().toISOString().slice(0,10)); setPaidRef(""); setPaidNotes(""); }}
                                    disabled={payingId === p.id}
                                    className="px-2.5 py-1 text-xs font-semibold bg-success text-white rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
                                  >
                                    {payingId === p.id ? "…" : "Mark Paid"}
                                  </button>
                                  <button
                                    onClick={() => { setShowPartialModal(p.id); setPartialAmount(""); setPartialMethod("BANK_TRANSFER"); setPartialRef(""); setPartialNotes(""); }}
                                    className="px-2.5 py-1 text-xs font-medium border border-warning/30 text-warning rounded-lg hover:bg-warning-soft transition-colors"
                                  >
                                    Partial
                                  </button>
                                  {p.status !== "PARTIAL" && (
                                    <button
                                      onClick={() => { setShowPdcModal(p.id); setPdcForm({ pdcNumber: "", pdcBank: "", pdcDate: "" }); }}
                                      className="px-2.5 py-1 text-xs font-medium border border-warning/30 text-warning rounded-lg hover:bg-warning-soft transition-colors"
                                    >
                                      PDC
                                    </button>
                                  )}
                                  {!p.isWaived && (
                                    <button
                                      onClick={() => { setWaiveId(p.id); setWaiveReason(""); }}
                                      className="px-2.5 py-1 text-xs font-medium border border-border text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors"
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
                                    className="px-2.5 py-1 text-xs font-semibold bg-chart-5 text-white rounded-lg hover:bg-chart-5 transition-colors disabled:opacity-50"
                                  >
                                    Cleared
                                  </button>
                                  <button
                                    onClick={() => handlePdcAction(p.id, "pdc-bounced")}
                                    disabled={pdcId === p.id}
                                    className="px-2.5 py-1 text-xs font-medium border border-destructive/30 text-destructive rounded-lg hover:bg-destructive-soft transition-colors disabled:opacity-50"
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
                                    className="px-2.5 py-1 text-xs font-medium border border-primary/40 text-primary rounded-lg hover:bg-info-soft transition-colors"
                                  >
                                    View Invoice
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => generateInvoice(p.id)}
                                    disabled={generatingInvoice === p.id}
                                    className="px-2.5 py-1 text-xs font-medium border border-primary/40 text-primary rounded-lg hover:bg-info-soft transition-colors disabled:opacity-50"
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
                                    className="px-2.5 py-1 text-xs font-medium border border-success/30 text-success rounded-lg hover:bg-success-soft transition-colors"
                                  >
                                    View Receipt
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => generateReceipt(p.id)}
                                    disabled={generatingReceipt === p.id}
                                    className="px-2.5 py-1 text-xs font-medium border border-success/30 text-success rounded-lg hover:bg-success-soft transition-colors disabled:opacity-50"
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
                            <div className="bg-muted/50 rounded-lg border border-border divide-y divide-border">
                              {p.auditLog.map((log: any) => (
                                <div key={log.id} className="px-3 py-2 flex items-start justify-between gap-3">
                                  <div>
                                    <span className="text-xs font-semibold text-foreground">{log.action.replace(/_/g, " ")}</span>
                                    {log.reason && <span className="text-xs text-muted-foreground ml-2">· {log.reason}</span>}
                                    <p className="text-xs text-muted-foreground mt-0.5">by {log.changedBy}</p>
                                  </div>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(log.changedAt)}</span>
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
                <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
                  {([
                    { type: "NOTE",    label: "Note",    Icon: FileText },
                    { type: "CALL",    label: "Call",    Icon: Phone },
                    { type: "MEETING", label: "Meeting", Icon: Handshake },
                    { type: "SITE_VISIT", label: "Site Visit", Icon: Building2 },
                  ] as const).map(({ type, label, Icon }) => (
                    <button
                      key={type}
                      onClick={() => { setActivityForm((f) => ({ ...f, type })); setShowActivityForm(true); }}
                      className={`px-3 py-1.5 text-xs font-semibold border rounded-lg flex items-center gap-1.5 transition-colors ${
                        showActivityForm && activityForm.type === type
                          ? "bg-primary text-white border-primary/40"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="size-3.5" />{label}
                    </button>
                  ))}
                  {showActivityForm && (
                    <button
                      onClick={() => setShowActivityForm(false)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    ><X className="size-3" /> Cancel</button>
                  )}
                </div>

                {/* Inline log form */}
                {showActivityForm && (
                  <div className="px-5 py-4 bg-info-soft border-b border-primary/40 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {(["NOTE","CALL","WHATSAPP","EMAIL","MEETING","SITE_VISIT"] as const).map((t) => (
                        <button key={t} onClick={() => setActivityForm((f) => ({ ...f, type: t }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            activityForm.type === t ? "bg-primary text-white border-primary/40" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}
                        >{t.replace("_", " ")}</button>
                      ))}
                    </div>
                    <textarea
                      value={activityForm.summary}
                      onChange={(e) => setActivityForm((f) => ({ ...f, summary: e.target.value }))}
                      placeholder="Summary *"
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Activity Date</label>
                        <input type="datetime-local" value={activityForm.activityDate}
                          onChange={(e) => setActivityForm((f) => ({ ...f, activityDate: e.target.value }))}
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-card focus:outline-none focus:border-ring" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Follow-up Date</label>
                        <input type="datetime-local" value={activityForm.followUpDate}
                          onChange={(e) => setActivityForm((f) => ({ ...f, followUpDate: e.target.value }))}
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-card focus:outline-none focus:border-ring" />
                      </div>
                    </div>
                    <button
                      onClick={submitActivity}
                      disabled={!activityForm.summary.trim() || submittingActivity}
                      className="px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {submittingActivity ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}

                {/* Timeline */}
                {activityLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <ConversationThread
                    activities={activities}
                    emptyMessage="No activities yet — log the first one above"
                  />
                )}
                <ConversationReplyBox
                  leadId={deal.lead.id}
                  dealId={deal.id}
                  availableChannels={(() => {
                    const out: ("EMAIL" | "WHATSAPP" | "SMS")[] = [];
                    const pref = (deal.lead as any)?.communicationPreference;
                    if (deal.lead.email && !pref?.emailOptOut) out.push("EMAIL");
                    if (deal.lead.phone && !pref?.whatsappOptOut) out.push("WHATSAPP");
                    if (deal.lead.phone && !pref?.smsOptOut) out.push("SMS");
                    return out;
                  })()}
                  onSent={async () => {
                    const r = await axios.get(`/api/deals/${dealId}/activities`);
                    setActivities(r.data);
                  }}
                />
              </div>
            )}

            {/* Tasks tab */}
            {activeTab === "tasks" && (
              <div className="divide-y divide-border">
                <div className="px-5 py-3">
                  <button onClick={() => setShowAddTaskForm((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
                    {showAddTaskForm ? "− Cancel" : "+ Add Task"}
                  </button>
                  {showAddTaskForm && (
                    <div className="mt-3 space-y-2">
                      <input type="text" value={addTaskForm.title}
                        onChange={(e) => setAddTaskForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Task title *"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select value={addTaskForm.type} onChange={(e) => setAddTaskForm((f) => ({ ...f, type: e.target.value }))}
                          className="border border-border rounded-lg px-2 py-1.5 text-sm bg-muted/50 focus:outline-none">
                          {["CALL","MEETING","FOLLOW_UP","DOCUMENT","PAYMENT"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                        </select>
                        <select value={addTaskForm.priority} onChange={(e) => setAddTaskForm((f) => ({ ...f, priority: e.target.value }))}
                          className="border border-border rounded-lg px-2 py-1.5 text-sm bg-muted/50 focus:outline-none">
                          {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="datetime-local" value={addTaskForm.dueDate}
                          onChange={(e) => setAddTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                          className="border border-border rounded-lg px-2 py-1.5 text-sm bg-muted/50 focus:outline-none" />
                      </div>
                      <button onClick={submitDealTask} disabled={!addTaskForm.title.trim() || !addTaskForm.dueDate || addingTask}
                        className="px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                        {addingTask ? "Creating…" : "Create Task"}
                      </button>
                    </div>
                  )}
                </div>
                {tasksLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : dealTasks.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">No open tasks</p>
                ) : dealTasks.map((t: any) => {
                  const isOverdue = new Date(t.dueDate) < new Date();
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/60 group">
                      <button onClick={() => completeDealTask(t.id)} disabled={completingTaskId === t.id}
                        className="w-5 h-5 rounded-full border-2 border-border hover:border-primary/40 flex-shrink-0 mt-0.5 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.type.replace(/_/g," ")}</span>
                          <span className={`text-xs font-semibold ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
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
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No stage history yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {deal.stageHistory.map((h) => (
                    <div key={h.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[h.oldStage] || "bg-muted text-muted-foreground"}`}>{h.oldStage.replace(/_/g," ")}</span>
                          <span className="text-muted-foreground text-xs">→</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[h.newStage] || "bg-muted text-muted-foreground"}`}>{h.newStage.replace(/_/g," ")}</span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(h.changedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{h.changedBy === "system" ? "System" : h.changedBy}</span>
                        {h.reason && <span className="text-xs text-muted-foreground italic">· {h.reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
      aside={(
        <>
          {/* NextStepCard — single source of truth for stage transitions.
              Merges what was previously "Deal Status" + "Next Stage Checklist"
              + "Change Stage popover" (UX_AUDIT_2 M1+S2+S4). */}
          {!terminal && validNext.length > 0 && (
            <NextStepCard
              className="hidden lg:block"
              label={`Move to ${validNext[0].replace(/_/g, " ")}`}
              description={
                stageRequirements.length > 0 && stageRequirements.some((r) => !r.uploaded)
                  ? `Needs: ${stageRequirements.filter((r) => !r.uploaded).map((r) => r.label).join(" · ")}`
                  : "Confirm prerequisites are met, then advance."
              }
              onClick={() => handleStageChange(validNext[0])}
              disabled={updatingStage}
              secondary={
                validNext.length > 1
                  ? { label: `Other stages (${validNext.length - 1})`, onClick: () => setShowStageSelect(true) }
                  : undefined
              }
            />
          )}

          {/* Oqood countdown — only render when stage cares about it (S1). */}
          {oqoodRelevant && (
            <div className={`rounded-xl border p-4 ${oqoodStyle}`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 opacity-70">Oqood Deadline</h3>
              {oqood.isOverdue ? (
                <p className="text-xl font-bold">Overdue · {Math.abs(oqood.daysRemaining)}d</p>
              ) : (
                <p className="text-2xl font-bold">{oqood.daysRemaining}<span className="text-sm font-medium opacity-70"> days left</span></p>
              )}
              <p className="text-xs mt-1 opacity-70">{fmtDate(oqood.deadline)}</p>
              <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div className="h-full bg-current rounded-full opacity-60"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - (oqood.daysRemaining / 90) * 100))}%` }} />
              </div>
            </div>
          )}

          {/* Commission — only when stage ≥ SPA_SIGNED (S1). */}
          {commissionRelevant && commission && (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  commission.status === "PAID"             ? "bg-success-soft text-success" :
                  commission.status === "APPROVED"         ? "bg-info-soft text-primary" :
                  commission.status === "PENDING_APPROVAL" ? "bg-warning-soft text-warning" :
                  "bg-muted text-muted-foreground"
                }`}>{commission.status.replace(/_/g, " ")}</span>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{formatDirham(commission.amount)}</p>
              <p className="text-xs text-muted-foreground mb-3">{commission.rate}% rate</p>
              <div className="space-y-1.5 border-t border-border pt-2">
                {[
                  { label: "SPA Signed",       met: spaOk },
                  { label: "Oqood Registered", met: oqoodOk },
                ].map(({ label, met }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs">
                    {met
                      ? <Check className="size-3.5 text-success" />
                      : <X className="size-3.5 text-muted-foreground" />}
                    <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Broker — only when set. */}
          {deal.brokerCompany && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Broker</h3>
              <p className="text-sm font-semibold text-foreground">{deal.brokerCompany.name}</p>
              {deal.brokerAgent && <p className="text-xs text-muted-foreground mt-0.5">{deal.brokerAgent.name}</p>}
            </div>
          )}
        </>
      )}
    >
      {/* ── Reserve Unit Confirmation Modal ───────────────────────────────────── */}
      {showReserveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-5 border-b border-border">
              <h3 className="font-bold text-foreground text-lg">Confirm Reservation</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-warning-soft border border-warning/30 rounded-xl p-4">
                <p className="text-sm text-warning-soft-foreground font-medium">
                  This will lock Unit <span className="font-bold">{deal?.unit.unitNumber}</span> and prevent any other deal from booking it.
                </p>
                <p className="text-xs text-warning mt-1.5">This action cannot be undone by agents. Only an Admin can release a reserved unit.</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buyer</span>
                  <span className="font-medium">{deal?.lead.firstName} {deal?.lead.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{deal?.unit.unitNumber} · {deal?.unit.type.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-bold text-primary">{deal ? formatDirham(deal.salePrice) : "—"}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={confirmReserveUnit}
                  disabled={reserving}
                  className="flex-1 py-2.5 bg-success text-white text-sm font-bold rounded-xl hover:bg-success/90 disabled:opacity-50 transition-colors"
                >
                  {reserving ? "Reserving…" : "Confirm — Reserve Unit"}
                </button>
                <button
                  onClick={() => setShowReserveConfirm(false)}
                  className="px-5 py-2.5 bg-muted text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
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
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Cancel Deal</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This will release the unit back to available.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client withdrew, financing fell through…"
                  rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-destructive/30 resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(""); }} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">
                Keep Deal
              </button>
              <button
                onClick={handleCancelDeal}
                disabled={!cancelReason.trim() || cancelling}
                className="flex-1 py-2.5 bg-destructive text-white font-semibold rounded-lg hover:bg-destructive/90 text-sm disabled:opacity-50"
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
          <div className="bg-card rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Mark Payment as Paid</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Method</label>
                <select
                  value={paidMethod}
                  onChange={(e) => setPaidMethod(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                >
                  {["BANK_TRANSFER","CASH","CHEQUE","CARD","CRYPTO"].map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reference / Receipt No.</label>
                <input
                  type="text"
                  value={paidRef}
                  onChange={(e) => setPaidRef(e.target.value)}
                  placeholder="e.g. TXN-12345"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes</label>
                <textarea
                  value={paidNotes}
                  onChange={(e) => setPaidNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowMarkPaidModal(null)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">
                Cancel
              </button>
              <button
                onClick={confirmMarkPaid}
                disabled={payingId !== null}
                className="flex-1 py-2.5 bg-success text-white font-semibold rounded-lg hover:bg-success/90 text-sm disabled:opacity-50"
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
          <div className="bg-card rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Record Partial Payment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Enter the amount received so far.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Amount Received *</label>
                <div className="relative">
                  <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="number"
                    min="1"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Method</label>
                <select
                  value={partialMethod}
                  onChange={(e) => setPartialMethod(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                >
                  {["BANK_TRANSFER","CASH","CHEQUE","CARD","CRYPTO"].map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reference / Receipt No.</label>
                <input
                  type="text"
                  value={partialRef}
                  onChange={(e) => setPartialRef(e.target.value)}
                  placeholder="e.g. TXN-12345"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes</label>
                <textarea
                  value={partialNotes}
                  onChange={(e) => setPartialNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowPartialModal(null)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">
                Cancel
              </button>
              <button
                onClick={confirmPartial}
                disabled={submittingPartial || !partialAmount || parseFloat(partialAmount) <= 0}
                className="flex-1 py-2.5 bg-warning text-warning-foreground font-semibold rounded-lg hover:bg-warning/90 text-sm disabled:opacity-50"
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
          <div className="bg-card rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Register Post-Dated Cheque</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Cheque Number</label>
                <input type="text" value={pdcForm.pdcNumber} onChange={(e) => setPdcForm((f) => ({...f, pdcNumber: e.target.value}))}
                  placeholder="e.g. 001234" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Bank</label>
                <input type="text" value={pdcForm.pdcBank} onChange={(e) => setPdcForm((f) => ({...f, pdcBank: e.target.value}))}
                  placeholder="e.g. Emirates NBD" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Cheque Date</label>
                <input type="date" value={pdcForm.pdcDate} onChange={(e) => setPdcForm((f) => ({...f, pdcDate: e.target.value}))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowPdcModal(null)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
              <button onClick={confirmPdc} disabled={pdcId !== null} className="flex-1 py-2.5 bg-warning text-white font-semibold rounded-lg hover:bg-warning/90 text-sm disabled:opacity-50">
                {pdcId ? "Saving…" : "Register PDC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waive Payment Modal */}
      {waiveId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Waive Payment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This removes the payment from collection obligations.</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason *</label>
              <textarea value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="e.g. Developer incentive, agreed waiver…"
                rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring resize-none" />
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setWaiveId(null)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
              <button onClick={confirmWaive} disabled={submittingWaive || !waiveReason.trim()}
                className="flex-1 py-2.5 bg-neutral-700 text-white font-semibold rounded-lg hover:bg-neutral-600 text-sm disabled:opacity-50">
                {submittingWaive ? "Waiving…" : "Waive Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Milestone Modal */}
      {showAddMilestone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Add Custom Milestone</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Label *</label>
                <input type="text" value={milestoneForm.label} onChange={(e) => setMilestoneForm((f) => ({...f, label: e.target.value}))}
                  placeholder="e.g. Handover Balance" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Amount *</label>
                <div className="relative">
                  <DirhamSign aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input type="number" min="1" value={milestoneForm.amount} onChange={(e) => setMilestoneForm((f) => ({...f, amount: e.target.value}))}
                    placeholder="e.g. 50000" className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Due Date *</label>
                <input type="date" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm((f) => ({...f, dueDate: e.target.value}))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes</label>
                <input type="text" value={milestoneForm.notes} onChange={(e) => setMilestoneForm((f) => ({...f, notes: e.target.value}))}
                  placeholder="Optional" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowAddMilestone(false)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
              <button onClick={confirmAddMilestone} disabled={addingMilestone || !milestoneForm.label || !milestoneForm.amount || !milestoneForm.dueDate}
                className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm disabled:opacity-50">
                {addingMilestone ? "Adding…" : "Add Milestone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky bottom primary action ──────────────────────────────────── */}
      {(() => {
        type CTA = { label: string; Icon?: React.ComponentType<{ className?: string }>; onClick: () => void; variant: "emerald" | "blue" | "amber" } | null;
        let cta: CTA = null;
        switch (deal.stage) {
          case "RESERVATION_PENDING":
            cta = { label: reserving ? "Reserving…" : "Record Reservation Fee", Icon: reserving ? undefined : Lock, onClick: handleReserveUnit, variant: "emerald" };
            break;
          case "RESERVATION_CONFIRMED":
            if (canGenerateSalesOffer && salesOfferDocs.length === 0) {
              cta = { label: generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate Sales Offer", Icon: generatingDoc === "SALES_OFFER" ? undefined : FileText, onClick: () => handleGenerateDocument("SALES_OFFER"), variant: "blue" };
            }
            break;
          case "SPA_PENDING":
            cta = { label: generatingDoc === "SPA" ? "Generating…" : "Generate SPA Draft", Icon: generatingDoc === "SPA" ? undefined : FileText, onClick: () => handleGenerateDocument("SPA"), variant: "blue" };
            break;
          case "SPA_SENT":
            cta = { label: "Mark SPA Signed", Icon: Check, onClick: () => handleStageChange("SPA_SIGNED"), variant: "blue" };
            break;
          case "SPA_SIGNED":
            cta = { label: "Submit Oqood Application", Icon: ClipboardList, onClick: () => handleStageChange("OQOOD_PENDING"), variant: "amber" };
            break;
          case "OQOOD_PENDING":
            cta = { label: "Mark Oqood Registered", Icon: Check, onClick: () => handleStageChange("OQOOD_REGISTERED"), variant: "emerald" };
            break;
          case "OQOOD_REGISTERED":
            cta = { label: "Begin Installments", onClick: () => handleStageChange("INSTALLMENTS_ACTIVE"), variant: "blue" };
            break;
          case "INSTALLMENTS_ACTIVE":
            cta = { label: "Record Next Payment", Icon: DollarSign, onClick: () => { document.getElementById("payments-section")?.scrollIntoView({ behavior: "smooth" }); }, variant: "emerald" };
            break;
          case "HANDOVER_PENDING":
            cta = { label: "Mark Handed Over", Icon: Home, onClick: () => handleStageChange("COMPLETED"), variant: "emerald" };
            break;
        }
        if (!cta) return null;
        const tone = cta.variant === "emerald" ? "bg-success hover:bg-success/90" : cta.variant === "amber" ? "bg-warning hover:bg-warning/90" : "bg-primary hover:bg-primary/90";
        return (
          <div className="sticky bottom-0 left-0 right-0 -mx-6 mt-2 px-6 py-3 bg-card border-t border-border shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3 z-30">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Next step:</span> {deal.stage.replace(/_/g, " ")}
            </div>
            <button
              onClick={cta.onClick}
              disabled={reserving || !!generatingDoc || updatingStage}
              className={`px-5 py-2.5 ${tone} text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors inline-flex items-center gap-2`}
            >
              {cta.Icon && <cta.Icon className="size-4" />}
              <span>{cta.label}</span>
            </button>
          </div>
        );
      })()}

      {/* Restructure Schedule Modal */}
      {showRestructure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Restructure Payment Schedule</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Shifts all future PENDING payments by N days.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Shift by (days) *</label>
                <input type="number" value={restructureDays} onChange={(e) => setRestructureDays(e.target.value)}
                  placeholder="e.g. 30 (positive = later, negative = earlier)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason *</label>
                <textarea value={restructureReason} onChange={(e) => setRestructureReason(e.target.value)}
                  placeholder="e.g. Construction delay, handover pushed to Q3 2026…"
                  rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring resize-none" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowRestructure(false)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
              <button onClick={confirmRestructure} disabled={submittingRestructure || !restructureDays || !restructureReason.trim()}
                className="flex-1 py-2.5 bg-accent-2 text-accent-2-foreground font-semibold rounded-lg hover:bg-accent-2 text-sm disabled:opacity-50">
                {submittingRestructure ? "Restructuring…" : "Apply Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showPurchasersModal && dealId && (
        <DealPurchasersModal
          dealId={dealId}
          onClose={() => setShowPurchasersModal(false)}
          onSaved={loadDeal}
        />
      )}

      {/* Change-stage Dialog — replaces the legacy popover that lived in the
          old in-page header. Triggered from NextStepCard "Other stages" and
          the overflow menu. */}
      <Dialog open={showStageSelect} onOpenChange={(o) => { if (!o) { setShowStageSelect(false); setStageReason(""); } }}>
        <DialogContent className="max-w-md p-0 gap-0" aria-describedby="stage-dialog-desc">
          <div className="px-6 py-4 border-b border-border">
            <DialogTitle className="text-base font-bold text-foreground">Change stage</DialogTitle>
            <DialogDescription id="stage-dialog-desc" className="text-xs text-muted-foreground mt-0.5">
              Move {deal.dealNumber} to a different pipeline stage.
            </DialogDescription>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {validNext.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={updatingStage}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-sm font-medium text-foreground disabled:opacity-50"
                >
                  Move to {s.replace(/_/g, " ")}
                </button>
              ))}
              {validNext.length === 0 && (
                <p className="text-sm text-muted-foreground">No further transitions from this stage.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Pause Payment Reminders</h3>
              <p className="text-xs text-muted-foreground mt-1">No automated emails will be sent while paused.</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason <span className="text-muted-foreground">(optional)</span></label>
                <textarea
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g. Buyer requested delay"
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Resume on <span className="text-muted-foreground">(optional)</span></label>
                <input
                  type="date"
                  value={pauseUntil}
                  onChange={(e) => setPauseUntil(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => togglePauseReminders(true)}
                disabled={pausingReminders}
                className="flex-1 px-4 py-2.5 bg-warning text-warning-foreground text-sm font-semibold rounded-xl hover:bg-warning/90 transition-colors disabled:opacity-50"
              >
                {pausingReminders ? "Pausing…" : "Pause Reminders"}
              </button>
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 px-4 py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DetailPageLayout>
  );
}

// ─── Compliance banner: surfaces blockers (broker license / agent EID / buyer EID) ─

const KIND_LABEL: Record<string, string> = {
  BROKER_RERA_LICENSE:  "Broker RERA license",
  BROKER_TRADE_LICENSE: "Trade license",
  BROKER_VAT_CERT:      "VAT certificate",
  AGENT_RERA_CARD:      "Agent RERA card",
  AGENT_EID:            "Agent EID",
  BUYER_EID:            "Buyer EID",
};

const SEVERITY_TINT_BANNER: Record<string, { bg: string; pill: string }> = {
  EXPIRED:  { bg: "bg-destructive-soft border-destructive/30",       pill: "bg-destructive text-white" },
  CRITICAL: { bg: "bg-warning-soft border-warning/30", pill: "bg-warning text-white" },
  WARNING:  { bg: "bg-warning-soft border-warning/30",   pill: "bg-warning text-white" },
};

function ComplianceBanner({ blockers }: { blockers: Array<{
  kind: string; severity: "EXPIRED" | "CRITICAL" | "WARNING" | "ATTENTION" | "OK";
  daysToExpiry: number; ownerName: string; expiresAt: string;
}> }) {
  // Worst-severity row determines the banner colour
  const worstRow = blockers[0]; // service sorts worst-first
  const tint = SEVERITY_TINT_BANNER[worstRow.severity] ?? SEVERITY_TINT_BANNER.WARNING;
  const days = (n: number) => n < 0 ? `${Math.abs(n)}d ago` : `in ${n}d`;

  return (
    <div className={`border rounded-xl px-4 py-3 ${tint.bg}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {blockers.length === 1 ? "Compliance issue on this deal" : `${blockers.length} compliance issues on this deal`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {blockers.slice(0, 4).map((b, i) => (
              <li key={i} className="text-xs text-foreground flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEVERITY_TINT_BANNER[b.severity]?.pill ?? "bg-neutral-200 text-foreground"}`}>
                  {b.severity}
                </span>
                <span>{KIND_LABEL[b.kind] ?? b.kind}</span>
                <span className="text-muted-foreground">— {b.ownerName} ({days(b.daysToExpiry)})</span>
              </li>
            ))}
            {blockers.length > 4 && (
              <li className="text-xs text-muted-foreground">+ {blockers.length - 4} more</li>
            )}
          </ul>
        </div>
        <a href="/compliance" className="text-xs text-primary hover:underline flex-shrink-0 mt-0.5">Open radar →</a>
      </div>
    </div>
  );
}
