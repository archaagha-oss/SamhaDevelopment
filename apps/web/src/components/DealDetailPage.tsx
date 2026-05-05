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
  unit: { id: string; unitNumber: string; type: string; floor: number; area: number; price: number; };
  paymentPlan: { id: string; name: string; milestones: any[]; };
  payments: any[];
  commission?: { id: string; amount: number; rate: number; status: string; spaSignedMet: boolean; oqoodRegisteredMet: boolean; conditions?: { spaSignedMet: boolean; oqoodRegisteredMet: boolean; bothMet: boolean; }; };
  documents: any[];
  stageHistory?: StageHistoryEntry[];
  brokerCompany?: { id: string; name: string } | null;
  brokerAgent?: { id: string; name: string } | null;
  assignedAgent?: { id: string; name: string } | null;
  dldPaidBy?: string;
  adminFeeWaived?: boolean;
  adminFeeWaivedReason?: string;
  dldWaivedReason?: string;
  commissionRateOverride?: number;
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
  const [showEditModal, setShowEditModal] = useState(false);

  // Waive payment
  const [waiveId, setWaiveId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [submittingWaive, setSubmittingWaive] = useState(false);

  // Stage change confirmation
  const [pendingStage, setPendingStage] = useState<string | null>(null);

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

  const handleGenerateDocument = async (type: "RESERVATION_FORM" | "SPA") => {
    setGeneratingDoc(type);
    try {
      await axios.post(`/api/deals/${dealId}/generate-document`, { type });
      toast.success(`${type === "RESERVATION_FORM" ? "Reservation Form" : "SPA Draft"} generated`);
      setDocumentKey((k) => k + 1);
      const labelMap = { RESERVATION_FORM: "reservation-form", SPA: "spa-draft" };
      window.open(`/deals/${dealId}/print/${labelMap[type]}`, "_blank");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate document");
    } finally {
      setGeneratingDoc(null);
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

  const netPrice      = deal.salePrice - deal.discount;
  const totalWithFees = netPrice + deal.dldFee + deal.adminFee;
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
              <span className="font-mono text-xs text-slate-400">{deal.dealNumber}</span>
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

          {/* Stage badge + change */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`}>
              {deal.stage.replace(/_/g, " ")}
            </span>
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
        {/* Main: unit + financials + payments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Unit + financials */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Unit</h3>
              <p className="text-2xl font-bold text-slate-900 mb-1">{deal.unit.unitNumber}</p>
              <div className="space-y-1.5 text-sm">
                {[["Type", deal.unit.type], ["Floor", `Floor ${deal.unit.floor}`], ["Area", formatArea(deal.unit.area)]].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-slate-500">{l}</span>
                    <span className="font-medium text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Financials</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Sale Price</span><span className="font-semibold">AED {deal.salePrice.toLocaleString()}</span></div>
                {deal.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-emerald-600 font-semibold">-AED {deal.discount.toLocaleString()}</span></div>}
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-semibold text-slate-700">Net Price</span><span className="font-bold text-slate-900">AED {netPrice.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs text-slate-400"><span>DLD Fee (4%)</span><span>AED {deal.dldFee.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs text-slate-400"><span>Admin Fee</span><span>AED {deal.adminFee.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-xs"><span className="text-slate-500">Total inc. Fees</span><span className="font-bold text-slate-700">AED {totalWithFees.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          {/* Generate document actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Generate Documents</h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleGenerateDocument("RESERVATION_FORM")}
                disabled={!!generatingDoc}
                className="px-4 py-2 text-sm font-semibold bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {generatingDoc === "RESERVATION_FORM" ? "Generating…" : "Reservation Form"}
              </button>
              <button
                onClick={() => handleGenerateDocument("SPA")}
                disabled={!!generatingDoc}
                className="px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {generatingDoc === "SPA" ? "Generating…" : "SPA Draft"}
              </button>
            </div>
          </div>

          {/* Documents */}
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
                </div>
              )}
            </div>

            {/* Payments tab */}
            {activeTab === "payments" && (
              deal.payments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No payment milestones</p>
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
              <div className="divide-y divide-slate-50">
                <div className="px-5 py-3">
                  <button
                    onClick={() => setShowActivityForm(!showActivityForm)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {showActivityForm ? "− Cancel" : "+ Log Activity"}
                  </button>
                  {showActivityForm && (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {(["CALL","WHATSAPP","EMAIL","MEETING","SITE_VISIT","NOTE"] as const).map((t) => (
                          <button key={t} onClick={() => setActivityForm((f) => ({ ...f, type: t }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${activityForm.type === t ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:border-blue-400"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={activityForm.summary}
                        onChange={(e) => setActivityForm((f) => ({ ...f, summary: e.target.value }))}
                        placeholder="Summary *"
                        rows={2}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Activity Date</label>
                          <input type="datetime-local" value={activityForm.activityDate}
                            onChange={(e) => setActivityForm((f) => ({ ...f, activityDate: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Follow-up Date</label>
                          <input type="datetime-local" value={activityForm.followUpDate}
                            onChange={(e) => setActivityForm((f) => ({ ...f, followUpDate: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none focus:border-blue-400" />
                        </div>
                      </div>
                      <button
                        onClick={submitActivity}
                        disabled={!activityForm.summary.trim() || submittingActivity}
                        className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {submittingActivity ? "Saving…" : "Log Activity"}
                      </button>
                    </div>
                  )}
                </div>
                {activityLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">No activities logged</p>
                ) : activities.map((a: any) => (
                  <div key={a.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{a.type}</span>
                        <p className="text-sm text-slate-700">{a.summary}</p>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(a.activityDate || a.createdAt)}</span>
                    </div>
                    {a.outcome && <p className="text-xs text-slate-500 italic mt-1">{a.outcome}</p>}
                    {a.followUpDate && <p className="text-xs text-amber-600 mt-0.5">Follow-up: {fmtDate(a.followUpDate)}</p>}
                    <p className="text-xs text-slate-400 mt-1">by {a.createdBy}</p>
                  </div>
                ))}
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

        {/* Sidebar: Oqood + Commission */}
        <div className="space-y-4">
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
    </div>
  );
}
