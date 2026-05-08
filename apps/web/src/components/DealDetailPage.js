import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
const VALID_DEAL_TRANSITIONS = {
    RESERVATION_PENDING: ["RESERVATION_CONFIRMED", "CANCELLED"],
    RESERVATION_CONFIRMED: ["SPA_PENDING", "CANCELLED"],
    SPA_PENDING: ["SPA_SENT", "CANCELLED"],
    SPA_SENT: ["SPA_SIGNED", "CANCELLED"],
    SPA_SIGNED: ["OQOOD_PENDING", "CANCELLED"],
    OQOOD_PENDING: ["OQOOD_REGISTERED", "CANCELLED"],
    OQOOD_REGISTERED: ["INSTALLMENTS_ACTIVE", "CANCELLED"],
    INSTALLMENTS_ACTIVE: ["HANDOVER_PENDING", "CANCELLED"],
    HANDOVER_PENDING: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};
const STAGE_BADGE = {
    RESERVATION_PENDING: "bg-slate-100 text-slate-600", RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
    SPA_PENDING: "bg-yellow-100 text-yellow-700", SPA_SENT: "bg-yellow-100 text-yellow-700",
    SPA_SIGNED: "bg-violet-100 text-violet-700", OQOOD_PENDING: "bg-orange-100 text-orange-700",
    OQOOD_REGISTERED: "bg-teal-100 text-teal-700", INSTALLMENTS_ACTIVE: "bg-indigo-100 text-indigo-700",
    HANDOVER_PENDING: "bg-emerald-100 text-emerald-700", COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
};
const PAY_BADGE = {
    PAID: "bg-emerald-100 text-emerald-700", PENDING: "bg-amber-100 text-amber-700",
    PARTIAL: "bg-amber-100 text-amber-700", OVERDUE: "bg-red-100 text-red-700",
    PDC_PENDING: "bg-orange-100 text-orange-700",
    PDC_CLEARED: "bg-teal-100 text-teal-700", CANCELLED: "bg-slate-100 text-slate-500",
};
const OQOOD_COLOR = {
    green: "text-emerald-600 bg-emerald-50 border-emerald-200",
    yellow: "text-amber-600 bg-amber-50 border-amber-200",
    red: "text-red-600 bg-red-50 border-red-200",
    overdue: "text-red-700 bg-red-100 border-red-300",
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)
        return "Just now";
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
        return `Today ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
    if (diff < 172800)
        return `Yesterday ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
    return new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}
function activityIcon(type, summary) {
    if (type === "CALL")
        return "📞";
    if (type === "EMAIL")
        return "✉️";
    if (type === "WHATSAPP")
        return "💬";
    if (type === "MEETING")
        return "🤝";
    if (type === "SITE_VISIT")
        return "🏢";
    const s = summary.toLowerCase();
    if (s.includes("reserved"))
        return "🔒";
    if (s.includes("generated") || s.includes("document"))
        return "📄";
    if (s.includes("stage changed") || s.includes("→"))
        return "🔄";
    if (s.includes("created"))
        return "✅";
    if (s.includes("unit") && (s.includes("assign") || s.includes("changed")))
        return "🏠";
    return "📝";
}
const SYSTEM_PATTERNS = ["generated for", "reserved for", "stage changed", "deal created", "unit assigned", "unit changed", "notes updated"];
function isSystemActivity(summary) {
    const s = summary.toLowerCase();
    return SYSTEM_PATTERNS.some((p) => s.includes(p));
}
export default function DealDetailPage({ dealId: dealIdProp, onBack }) {
    const params = useParams();
    const navigate = useNavigate();
    const dealId = dealIdProp ?? params.dealId ?? "";
    const handleBack = onBack ?? (() => navigate("/deals"));
    const [deal, setDeal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updatingStage, setUpdatingStage] = useState(false);
    const [payingId, setPayingId] = useState(null);
    const [showStageSelect, setShowStageSelect] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);
    const [pdcId, setPdcId] = useState(null);
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(null);
    const [paidMethod, setPaidMethod] = useState("BANK_TRANSFER");
    const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
    const [paidRef, setPaidRef] = useState("");
    const [paidNotes, setPaidNotes] = useState("");
    const [showPartialModal, setShowPartialModal] = useState(null);
    const [partialAmount, setPartialAmount] = useState("");
    const [partialMethod, setPartialMethod] = useState("BANK_TRANSFER");
    const [partialRef, setPartialRef] = useState("");
    const [partialNotes, setPartialNotes] = useState("");
    const [submittingPartial, setSubmittingPartial] = useState(false);
    const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
    const [documentKey, setDocumentKey] = useState(0);
    const [generatingDoc, setGeneratingDoc] = useState(null);
    const [generatingInvoice, setGeneratingInvoice] = useState(null);
    const [generatingReceipt, setGeneratingReceipt] = useState(null);
    const [reserving, setReserving] = useState(false);
    const [showReserveConfirm, setShowReserveConfirm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    // Change Unit panel
    const [showChangeUnit, setShowChangeUnit] = useState(false);
    const [changeUnitProjectId, setChangeUnitProjectId] = useState("");
    const [changeUnitId, setChangeUnitId] = useState("");
    const [projects, setProjects] = useState([]);
    const [changeUnitList, setChangeUnitList] = useState([]);
    const [loadingChangeUnits, setLoadingChangeUnits] = useState(false);
    const [assigningUnit, setAssigningUnit] = useState(false);
    // Notes inline editing
    const [notesValue, setNotesValue] = useState(null);
    const [savingNotes, setSavingNotes] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);
    // Waive payment
    const [waiveId, setWaiveId] = useState(null);
    const [waiveReason, setWaiveReason] = useState("");
    const [submittingWaive, setSubmittingWaive] = useState(false);
    // Stage change confirmation
    const [pendingStage, setPendingStage] = useState(null);
    // Regenerate Sales Offer confirmation
    const [showRegenSalesOffer, setShowRegenSalesOffer] = useState(false);
    // Copy deal ID feedback
    const [copiedDealId, setCopiedDealId] = useState(false);
    const copyDealId = () => {
        if (!deal)
            return;
        navigator.clipboard.writeText(deal.dealNumber);
        setCopiedDealId(true);
        setTimeout(() => setCopiedDealId(false), 1500);
    };
    // Pause reminders
    const [pausingReminders, setPausingReminders] = useState(false);
    const [showPauseModal, setShowPauseModal] = useState(false);
    const [pauseReason, setPauseReason] = useState("");
    const [pauseUntil, setPauseUntil] = useState("");
    const togglePauseReminders = async (paused) => {
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update reminder settings");
        }
        finally {
            setPausingReminders(false);
        }
    };
    const generateInvoice = async (paymentId) => {
        setGeneratingInvoice(paymentId);
        try {
            const r = await axios.post(`/api/payments/${paymentId}/generate-invoice`);
            window.open(r.data.previewUrl, "_blank");
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to generate invoice");
        }
        finally {
            setGeneratingInvoice(null);
        }
    };
    const generateReceipt = async (paymentId) => {
        setGeneratingReceipt(paymentId);
        try {
            const r = await axios.post(`/api/payments/${paymentId}/generate-receipt`);
            window.open(r.data.previewUrl, "_blank");
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to generate receipt");
        }
        finally {
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
    const [showPdcModal, setShowPdcModal] = useState(null);
    const [pdcForm, setPdcForm] = useState({ pdcNumber: "", pdcBank: "", pdcDate: "" });
    const [stageRequirements, setStageRequirements] = useState([]);
    const [activeTab, setActiveTab] = useState("payments");
    const [expandedAuditId, setExpandedAuditId] = useState(null);
    const [activities, setActivities] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [showActivityForm, setShowActivityForm] = useState(false);
    const [activityForm, setActivityForm] = useState({ type: "NOTE", summary: "", outcome: "", followUpDate: "", activityDate: new Date().toISOString().slice(0, 16) });
    const [submittingActivity, setSubmittingActivity] = useState(false);
    const [dealTasks, setDealTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [completingTaskId, setCompletingTaskId] = useState(null);
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
        if (!activityForm.summary.trim())
            return;
        setSubmittingActivity(true);
        try {
            await axios.post(`/api/deals/${dealId}/activities`, activityForm);
            setActivityForm({ type: "NOTE", summary: "", outcome: "", followUpDate: "", activityDate: new Date().toISOString().slice(0, 16) });
            setShowActivityForm(false);
            loadActivities();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to log activity");
        }
        finally {
            setSubmittingActivity(false);
        }
    };
    useEffect(() => { loadDeal(); }, [loadDeal]);
    useEffect(() => { if (deal && notesValue === null)
        setNotesValue(deal.notes ?? ""); }, [deal]);
    useEffect(() => { if (activeTab === "activity")
        loadActivities(); }, [activeTab, loadActivities]);
    const loadDealTasks = useCallback(() => {
        setTasksLoading(true);
        axios.get("/api/tasks", { params: { dealId, status: "PENDING" } })
            .then((r) => setDealTasks(r.data || []))
            .catch(() => setDealTasks([]))
            .finally(() => setTasksLoading(false));
    }, [dealId]);
    useEffect(() => { if (activeTab === "tasks")
        loadDealTasks(); }, [activeTab, loadDealTasks]);
    const completeDealTask = async (id) => {
        setCompletingTaskId(id);
        try {
            await axios.patch(`/api/tasks/${id}/complete`);
            setDealTasks((prev) => prev.filter((t) => t.id !== id));
        }
        finally {
            setCompletingTaskId(null);
        }
    };
    const submitDealTask = async () => {
        if (!addTaskForm.title.trim() || !addTaskForm.dueDate)
            return;
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
        }
        finally {
            setAddingTask(false);
        }
    };
    // Load requirements for the next valid stage whenever deal changes
    useEffect(() => {
        if (!deal)
            return;
        const nextStageMap = {
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
        if (!next) {
            setStageRequirements([]);
            return;
        }
        axios.get(`/api/deals/${deal.id}/stage-requirements?targetStage=${next}`)
            .then((r) => setStageRequirements(r.data.requirements || []))
            .catch(() => setStageRequirements([]));
    }, [deal]);
    const handleStageChange = async (newStage) => {
        if (!deal || newStage === deal.stage) {
            setShowStageSelect(false);
            return;
        }
        setPendingStage(newStage);
    };
    const confirmStageChange = async () => {
        if (!pendingStage || !deal)
            return;
        const newStage = pendingStage;
        setPendingStage(null);
        setUpdatingStage(true);
        try {
            await axios.patch(`/api/deals/${deal.id}/stage`, { newStage });
            toast.success(`Stage updated to ${newStage.replace(/_/g, " ")}`);
            setShowStageSelect(false);
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update stage");
        }
        finally {
            setUpdatingStage(false);
        }
    };
    const confirmMarkPaid = async () => {
        const paymentId = showMarkPaidModal;
        if (!paymentId)
            return;
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to mark payment as paid");
        }
        finally {
            setPayingId(null);
        }
    };
    const confirmPartial = async () => {
        const paymentId = showPartialModal;
        if (!paymentId || !partialAmount)
            return;
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to record partial payment");
        }
        finally {
            setSubmittingPartial(false);
        }
    };
    const handlePdcAction = async (paymentId, action) => {
        setPdcId(paymentId);
        try {
            await axios.patch(`/api/payments/${paymentId}/${action}`);
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update PDC status");
        }
        finally {
            setPdcId(null);
        }
    };
    const handleCancelDeal = async () => {
        if (!deal || !cancelReason.trim())
            return;
        setCancelling(true);
        try {
            await axios.patch(`/api/deals/${deal.id}/stage`, { newStage: "CANCELLED", reason: cancelReason });
            setShowCancelModal(false);
            setCancelReason("");
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to cancel deal");
        }
        finally {
            setCancelling(false);
        }
    };
    const confirmWaive = async () => {
        if (!waiveId || !waiveReason.trim())
            return;
        setSubmittingWaive(true);
        try {
            await axios.patch(`/api/payments/${waiveId}/waive`, { reason: waiveReason });
            setWaiveId(null);
            setWaiveReason("");
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to waive payment");
        }
        finally {
            setSubmittingWaive(false);
        }
    };
    const confirmAddMilestone = async () => {
        if (!milestoneForm.label || !milestoneForm.amount || !milestoneForm.dueDate)
            return;
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to add milestone");
        }
        finally {
            setAddingMilestone(false);
        }
    };
    const confirmRestructure = async () => {
        if (!restructureDays || !restructureReason.trim())
            return;
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to restructure schedule");
        }
        finally {
            setSubmittingRestructure(false);
        }
    };
    const confirmPdc = async () => {
        if (!showPdcModal)
            return;
        setPdcId(showPdcModal);
        try {
            await axios.patch(`/api/payments/${showPdcModal}/pdc`, pdcForm);
            setShowPdcModal(null);
            setPdcForm({ pdcNumber: "", pdcBank: "", pdcDate: "" });
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to register PDC");
        }
        finally {
            setPdcId(null);
        }
    };
    const handleGenerateDocument = async (type) => {
        setGeneratingDoc(type);
        try {
            await axios.post(`/api/deals/${dealId}/generate-document`, { type });
            const labelMap = {
                RESERVATION_FORM: "reservation-form",
                SPA: "spa-draft",
                SALES_OFFER: "sales-offer",
            };
            const nameMap = {
                RESERVATION_FORM: "Reservation Form",
                SPA: "SPA Draft",
                SALES_OFFER: "Sales Offer",
            };
            toast.success(`${nameMap[type]} generated`);
            setDocumentKey((k) => k + 1);
            loadDeal();
            window.open(`/deals/${dealId}/print/${labelMap[type]}`, "_blank");
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to generate document");
        }
        finally {
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to reserve unit");
        }
        finally {
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
            setProjects((r.data?.data ?? r.data ?? []).map((p) => ({ id: p.id, name: p.name })));
        }
    };
    const handleChangeUnitProject = async (projectId) => {
        setChangeUnitProjectId(projectId);
        setChangeUnitId("");
        setChangeUnitList([]);
        if (!projectId)
            return;
        setLoadingChangeUnits(true);
        try {
            const r = await axios.get("/api/units", { params: { projectId, status: "AVAILABLE", limit: 300 } });
            setChangeUnitList((r.data?.data ?? r.data ?? []).map((u) => ({
                id: u.id, unitNumber: u.unitNumber, type: u.type, price: u.price, floor: u.floor,
            })));
        }
        catch {
            toast.error("Failed to load units");
        }
        finally {
            setLoadingChangeUnits(false);
        }
    };
    const handleAssignUnit = async () => {
        if (!changeUnitId) {
            toast.error("Select a unit first");
            return;
        }
        setAssigningUnit(true);
        try {
            await axios.patch(`/api/deals/${dealId}/unit`, { unitId: changeUnitId });
            toast.success("Unit assigned");
            setShowChangeUnit(false);
            loadDeal();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to assign unit");
        }
        finally {
            setAssigningUnit(false);
        }
    };
    const handleSaveNotes = async () => {
        if (notesValue === null)
            return;
        setSavingNotes(true);
        try {
            await axios.patch(`/api/deals/${dealId}`, { notes: notesValue });
            setNotesSaved(true);
            setTimeout(() => setNotesSaved(false), 2500);
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to save notes");
        }
        finally {
            setSavingNotes(false);
        }
    };
    if (loading)
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    if (error || !deal)
        return (_jsxs("div", { className: "p-6", children: [_jsx("button", { onClick: handleBack, className: "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4", children: "\u2190 Back" }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-xl p-6 text-center", children: [_jsx("p", { className: "text-red-600 font-medium", children: error || "Deal not found" }), _jsx("button", { onClick: handleBack, className: "mt-3 text-sm text-red-500 underline", children: "Go back" })] })] }));
    const netPrice = deal.salePrice - deal.discount;
    // Document state — hoisted so header CTA and Documents section share the same values
    const salesOfferDocs = deal.documents
        .filter((d) => d.type === "SALES_OFFER" && !d.softDeleted)
        .sort((a, b) => b.version - a.version);
    // Invoice/receipt doc lookup helpers (keyed by paymentId)
    const invoiceDocByPayment = (paymentId) => deal.documents.find((d) => !d.softDeleted && d.type === "OTHER" && d.dataSnapshot?.docSubtype === "INVOICE" && d.dataSnapshot?.paymentId === paymentId);
    const receiptDocByPayment = (paymentId) => deal.documents.find((d) => !d.softDeleted && d.type === "PAYMENT_RECEIPT" && d.dataSnapshot?.paymentId === paymentId);
    const canGenerateSalesOffer = !["RESERVATION_PENDING", "CANCELLED"].includes(deal.stage) && !!deal.lead.firstName;
    const paidAmount = deal.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    const partialPaid = deal.payments.filter((p) => p.status === "PARTIAL").reduce((s, p) => s + (p.partialPayments?.reduce((ps, pp) => ps + pp.amount, 0) ?? 0), 0);
    const totalPaid = paidAmount + partialPaid;
    const remaining = netPrice - totalPaid;
    const overdueAmt = deal.payments.filter((p) => (p.status === "OVERDUE" || p.status === "PARTIAL") && new Date(p.dueDate) < new Date()).reduce((s, p) => s + p.amount, 0);
    const paidPct = netPrice > 0 ? Math.round((totalPaid / netPrice) * 100) : 0;
    const commission = deal.commission;
    const oqood = deal.oqood;
    const oqoodStyle = OQOOD_COLOR[oqood.status] || OQOOD_COLOR.green;
    const spaOk = commission?.conditions?.spaSignedMet ?? commission?.spaSignedMet ?? false;
    const oqoodOk = commission?.conditions?.oqoodRegisteredMet ?? commission?.oqoodMet ?? false;
    return (_jsxs("div", { className: "p-6 space-y-5 max-w-5xl", children: [_jsx(Breadcrumbs, { crumbs: [
                    { label: "Deals", path: "/deals" },
                    { label: deal.dealNumber },
                ] }), _jsx("div", { children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("h1", { className: "text-xl font-bold text-slate-900", children: [deal.lead.firstName, " ", deal.lead.lastName] }), _jsx("button", { onClick: () => setShowEditModal(true), className: "text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors text-sm", title: "Edit deal", children: "\u270E" })] }), _jsxs("div", { className: "flex items-center gap-3 mt-1 flex-wrap", children: [_jsxs("button", { onClick: copyDealId, className: "flex items-center gap-1 font-mono text-xs text-slate-400 hover:text-slate-700 transition-colors group", title: "Copy deal ID", children: [deal.dealNumber, _jsx("span", { className: "text-slate-300 group-hover:text-slate-500 transition-colors", children: copiedDealId ? "✓" : "⎘" })] }), _jsx("span", { className: "text-slate-300", children: "\u00B7" }), _jsx("span", { className: "text-sm text-slate-500", children: deal.lead.phone }), deal.lead.email && _jsx("span", { className: "text-sm text-slate-400", children: deal.lead.email }), deal.brokerCompany && (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-slate-300", children: "\u00B7" }), _jsxs("span", { className: "text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium", children: [deal.brokerCompany.name, deal.brokerAgent ? ` / ${deal.brokerAgent.name}` : ""] })] })), deal.paymentPlan && (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-slate-300", children: "\u00B7" }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Plan: ", _jsx("span", { className: "font-medium text-slate-700", children: deal.paymentPlan.name })] })] }))] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0 flex-wrap", children: [_jsx("span", { className: `px-3 py-1 rounded-full text-sm font-semibold ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`, children: deal.stage.replace(/_/g, " ") }), deal.stage === "RESERVATION_PENDING" && (_jsx("button", { onClick: handleReserveUnit, disabled: reserving, className: "px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5", children: reserving
                                        ? _jsxs(_Fragment, { children: [_jsx("div", { className: "w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" }), " Reserving\u2026"] })
                                        : "🔒 Reserve Unit" })), deal.stage === "RESERVATION_CONFIRMED" && salesOfferDocs.length === 0 && canGenerateSalesOffer && (_jsx("button", { onClick: () => handleGenerateDocument("SALES_OFFER"), disabled: !!generatingDoc, className: "px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors", children: generatingDoc === "SALES_OFFER" ? "Generating…" : "📄 Generate Sales Offer" })), _jsxs("div", { className: "relative flex items-center gap-2", children: [deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (_jsx("button", { onClick: () => setShowCancelModal(true), className: "px-3 py-1 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors", children: "Cancel Deal" })), _jsx("button", { onClick: () => setShowStageSelect(!showStageSelect), disabled: updatingStage, className: "px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50", children: updatingStage ? "Updating…" : "Change Stage ▾" }), showStageSelect && (_jsxs("div", { className: "absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 w-56", children: [(VALID_DEAL_TRANSITIONS[deal.stage] ?? []).filter((s) => s !== "CANCELLED").map((s) => (_jsxs("button", { onClick: () => handleStageChange(s), className: "w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors text-slate-700", children: ["\u2192 ", s.replace(/_/g, " ")] }, s))), (VALID_DEAL_TRANSITIONS[deal.stage] ?? []).length === 0 && (_jsx("p", { className: "px-4 py-2 text-xs text-slate-400", children: "No further transitions" }))] }))] })] })] }) }), showStageSelect && (_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setShowStageSelect(false) })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-5", children: [_jsxs("div", { className: "lg:col-span-2 space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Buyer" }), _jsx("div", { className: "grid grid-cols-3 gap-x-6 gap-y-2 text-sm", children: [
                                            ["Name", `${deal.lead.firstName} ${deal.lead.lastName}`],
                                            ["Phone", deal.lead.phone],
                                            ["Email", deal.lead.email ?? "—"],
                                        ].map(([label, value]) => (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-400 mb-0.5", children: label }), _jsx("p", { className: "font-medium text-slate-800", children: value })] }, label))) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Unit" }), deal.stage === "RESERVATION_PENDING" ? (_jsx("button", { onClick: () => showChangeUnit ? setShowChangeUnit(false) : openChangeUnit(), className: "text-xs text-blue-600 font-semibold hover:underline", children: showChangeUnit ? "Cancel" : "Change Unit" })) : deal.unit.status === "RESERVED" ? (_jsx("span", { className: "text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200", children: "Reserved (This Deal)" })) : null] }), _jsxs("div", { className: "flex items-center gap-4 mb-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-2xl font-bold text-slate-900", children: deal.unit.unitNumber }), deal.unit.status === "RESERVED" && (_jsx("span", { className: "text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200", children: "RESERVED" })), deal.unit.status === "ON_HOLD" && (_jsx("span", { className: "text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200", children: "ON HOLD" }))] }), _jsxs("p", { className: "text-sm text-slate-500", children: [deal.unit.type.replace(/_/g, " "), " \u00B7 Floor ", deal.unit.floor, " \u00B7 ", formatArea(deal.unit.area)] })] }), _jsxs("div", { className: "ml-auto text-right", children: [_jsxs("p", { className: "text-lg font-bold text-blue-700", children: ["AED ", deal.salePrice.toLocaleString()] }), _jsx("p", { className: "text-xs text-slate-400", children: "Sale Price" })] })] }), showChangeUnit && (_jsxs("div", { className: "border-t border-slate-100 pt-4 space-y-3", children: [_jsx("p", { className: "text-xs text-slate-500", children: "Select a new unit to replace the current assignment. Only AVAILABLE units are shown." }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Project" }), _jsxs("select", { value: changeUnitProjectId, onChange: (e) => handleChangeUnitProject(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "", children: "\u2014 Select project \u2014" }), projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Unit" }), loadingChangeUnits ? (_jsxs("div", { className: "flex items-center gap-2 py-2 text-xs text-slate-400", children: [_jsx("div", { className: "w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" }), "Loading\u2026"] })) : (_jsxs("select", { value: changeUnitId, onChange: (e) => setChangeUnitId(e.target.value), disabled: !changeUnitProjectId || changeUnitList.length === 0, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 disabled:opacity-50", children: [_jsx("option", { value: "", children: !changeUnitProjectId ? "Select a project first" : changeUnitList.length === 0 ? "No available units" : "— Select unit —" }), changeUnitList.map((u) => (_jsxs("option", { value: u.id, children: ["Unit ", u.unitNumber, " \u00B7 ", u.type.replace(/_/g, " "), " \u00B7 Floor ", u.floor, " \u00B7 AED ", u.price.toLocaleString()] }, u.id)))] }))] })] }), _jsx("button", { onClick: handleAssignUnit, disabled: !changeUnitId || assigningUnit, className: "px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors", children: assigningUnit ? "Assigning…" : "Assign Unit" })] }))] }), (() => {
                                const latestVersion = salesOfferDocs[0]?.version ?? 0;
                                const hasExisting = salesOfferDocs.length > 0;
                                return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Documents" }), canGenerateSalesOffer && (_jsx("button", { onClick: () => hasExisting ? setShowRegenSalesOffer(true) : handleGenerateDocument("SALES_OFFER"), disabled: !!generatingDoc, className: "px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: generatingDoc === "SALES_OFFER"
                                                        ? "Generating…"
                                                        : hasExisting ? "Generate New Version" : "Generate Sales Offer" })), !canGenerateSalesOffer && deal.stage !== "CANCELLED" && (_jsx("span", { className: "text-xs text-slate-400 italic cursor-default", title: "Reserve the unit first to unlock document generation", children: "Reserve unit first" }))] }), hasExisting ? (_jsx("div", { className: "rounded-lg border border-slate-100 overflow-hidden", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 text-left text-slate-500", children: [_jsx("th", { className: "px-3 py-2 font-semibold", children: "Type" }), _jsx("th", { className: "px-3 py-2 font-semibold", children: "Version" }), _jsx("th", { className: "px-3 py-2 font-semibold", children: "Generated" }), _jsx("th", { className: "px-3 py-2 font-semibold text-right", children: "Actions" })] }) }), _jsx("tbody", { children: salesOfferDocs.map((doc) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsx("td", { className: "px-3 py-2.5 font-medium text-slate-700", children: "Sales Offer" }), _jsx("td", { className: "px-3 py-2.5", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("span", { className: "font-semibold text-slate-700", children: ["v", doc.version] }), doc.version === latestVersion && (_jsx("span", { className: "px-1.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full", children: "Latest" }))] }) }), _jsx("td", { className: "px-3 py-2.5 text-slate-500", children: fmtDate(doc.uploadedAt) }), _jsx("td", { className: "px-3 py-2.5", children: _jsxs("div", { className: "flex justify-end gap-1.5", children: [_jsx("button", { onClick: () => window.open(`/deals/${dealId}/print/sales-offer?docId=${doc.id}`, "_blank"), className: "px-2.5 py-1 text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100", children: "Preview" }), _jsx("button", { onClick: () => window.open(`/deals/${dealId}/print/sales-offer?docId=${doc.id}&auto=print`, "_blank"), className: "px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700", children: "Download" })] }) })] }, doc.id))) })] }) })) : (
                                        /* Actionable empty state */
                                        _jsxs("div", { className: "rounded-lg bg-slate-50 border border-dashed border-slate-200 px-4 py-5 text-center", children: [_jsxs("p", { className: "text-sm text-slate-500 mb-3", children: ["No Sales Offer generated yet.", canGenerateSalesOffer
                                                            ? " Generate one to send to the buyer."
                                                            : " Reserve the unit first to unlock document generation."] }), canGenerateSalesOffer && (_jsx("button", { onClick: () => handleGenerateDocument("SALES_OFFER"), disabled: !!generatingDoc, className: "px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate Sales Offer" }))] })), _jsxs("div", { className: "flex gap-2 flex-wrap pt-1 border-t border-slate-100", children: [_jsx("button", { onClick: () => handleGenerateDocument("RESERVATION_FORM"), disabled: !!generatingDoc, className: "px-3 py-1.5 text-xs font-semibold bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50", children: generatingDoc === "RESERVATION_FORM" ? "Generating…" : "Reservation Form" }), _jsx("button", { onClick: () => handleGenerateDocument("SPA"), disabled: !!generatingDoc, className: "px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50", children: generatingDoc === "SPA" ? "Generating…" : "SPA Draft" })] })] }));
                            })(), showRegenSalesOffer && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl w-full max-w-md p-6", children: [_jsx("h3", { className: "text-base font-bold text-slate-800 mb-2", children: "Generate New Version?" }), _jsx("p", { className: "text-sm text-slate-500 mb-5", children: "This will create a new version of the Sales Offer capturing the current deal data. The existing version will remain accessible in the history." }), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx("button", { onClick: () => setShowRegenSalesOffer(false), className: "px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200", children: "Cancel" }), _jsx("button", { onClick: () => { setShowRegenSalesOffer(false); handleGenerateDocument("SALES_OFFER"); }, disabled: !!generatingDoc, className: "px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: generatingDoc === "SALES_OFFER" ? "Generating…" : "Generate New Version" })] })] }) })), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Notes" }), notesSaved && _jsx("span", { className: "text-xs text-emerald-600 font-medium", children: "Saved \u2713" })] }), _jsx("textarea", { rows: 3, value: notesValue ?? "", onChange: (e) => { setNotesValue(e.target.value); setNotesSaved(false); }, placeholder: "Internal deal notes\u2026", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" }), _jsx("button", { onClick: handleSaveNotes, disabled: savingNotes, className: "mt-2 px-4 py-1.5 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50", children: savingNotes ? "Saving…" : "Save Notes" })] }), _jsx(DocumentBrowser, { dealId: dealId, onUpload: () => setShowDocumentUploadModal(true) }, documentKey), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-slate-100", children: [_jsx("div", { className: "flex items-center gap-1 bg-slate-100 rounded-lg p-0.5", children: ["payments", "activity", "tasks", "history"].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-3 py-1 rounded-md text-xs font-semibold transition-colors ${activeTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: tab === "payments" ? "Payments" : tab === "activity" ? "Activity" : tab === "tasks" ? "Tasks" : "Stage History" }, tab))) }), activeTab === "payments" && (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-blue-500 rounded-full transition-all", style: { width: `${paidPct}%` } }) }), _jsxs("span", { className: "text-xs font-semibold text-slate-600", children: [paidPct, "%"] })] }), _jsxs("span", { className: "text-xs text-slate-400", children: ["AED ", totalPaid.toLocaleString(), " paid"] }), deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { setShowAddMilestone(true); setMilestoneForm({ label: "", amount: "", dueDate: "", notes: "" }); }, className: "px-2 py-1 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors", children: "+ Milestone" }), _jsx("button", { onClick: () => { setShowRestructure(true); setRestructureDays(""); setRestructureReason(""); }, className: "px-2 py-1 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors", children: "Restructure" })] })), deal.payments.length > 0 && (deal.remindersPaused ? (_jsxs("button", { onClick: () => togglePauseReminders(false), disabled: pausingReminders, className: "ml-auto px-2 py-1 text-xs border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-1", children: [_jsx("span", { children: "\u23F8" }), " Reminders Paused"] })) : (_jsxs("button", { onClick: () => setShowPauseModal(true), className: "ml-auto px-2 py-1 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1", children: [_jsx("span", { children: "\uD83D\uDD14" }), " Pause Reminders"] })))] }))] }), activeTab === "payments" && (deal.payments.length === 0 ? (_jsxs("div", { className: "px-5 py-10 text-center", children: [_jsx("p", { className: "text-2xl mb-2", children: "\uD83D\uDCB3" }), _jsx("p", { className: "text-sm font-medium text-slate-600 mb-1", children: "No payment schedule yet" }), _jsx("p", { className: "text-xs text-slate-400", children: ["RESERVATION_PENDING", "RESERVATION_CONFIRMED"].includes(deal.stage)
                                                    ? "A payment plan will appear here once the deal advances to SPA stage."
                                                    : "Assign a payment plan to this deal to generate the installment schedule." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100", children: [
                                                    { label: "Total Price", value: `AED ${netPrice.toLocaleString()}`, color: "text-slate-800" },
                                                    { label: "Total Paid", value: `AED ${totalPaid.toLocaleString()}`, color: "text-emerald-700" },
                                                    { label: "Remaining", value: `AED ${remaining.toLocaleString()}`, color: remaining > 0 ? "text-slate-700" : "text-emerald-700" },
                                                    { label: "Overdue", value: overdueAmt > 0 ? `AED ${overdueAmt.toLocaleString()}` : "—", color: overdueAmt > 0 ? "text-red-600 font-bold" : "text-slate-400" },
                                                ].map(({ label, value, color }) => (_jsxs("div", { className: "px-4 py-3 text-center", children: [_jsx("p", { className: "text-xs text-slate-400 mb-0.5", children: label }), _jsx("p", { className: `text-sm font-semibold ${color}`, children: value })] }, label))) }), _jsx("div", { className: "divide-y divide-slate-50", children: deal.payments.map((p) => {
                                                    const isOverdue = p.status === "OVERDUE";
                                                    const isPartial = p.status === "PARTIAL";
                                                    const overdueDays = (isOverdue || (isPartial && new Date(p.dueDate) < new Date()))
                                                        ? Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000)
                                                        : 0;
                                                    const partialReceived = p.partialPayments?.reduce((s, pp) => s + pp.amount, 0) ?? 0;
                                                    const partialRemaining = isPartial ? (p.amount - partialReceived) : 0;
                                                    const auditOpen = expandedAuditId === p.id;
                                                    const rowBg = isOverdue ? "bg-red-50/60" : isPartial ? "bg-amber-50/60" : p.status === "PAID" ? "bg-emerald-50/40" : "";
                                                    return (_jsxs("div", { className: rowBg, children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3", children: [_jsxs("div", { children: [_jsx("p", { className: `text-sm font-medium ${isOverdue ? "text-red-800" : isPartial ? "text-amber-800" : "text-slate-800"}`, children: p.milestoneLabel }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5 flex-wrap", children: [p.scheduleTrigger === "ON_SPA_SIGNING" && p.status === "PENDING" ? (_jsx("span", { className: "text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium", children: "Due on SPA Signing" })) : p.scheduleTrigger === "ON_OQOOD" && p.status === "PENDING" ? (_jsx("span", { className: "text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium", children: "Due on Oqood" })) : p.scheduleTrigger === "ON_HANDOVER" && p.status === "PENDING" ? (_jsx("span", { className: "text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium", children: "Due on Handover" })) : (_jsxs("p", { className: "text-xs text-slate-400", children: ["Due ", fmtDate(p.dueDate)] })), isOverdue && _jsxs("span", { className: "text-xs font-semibold text-red-600", children: [overdueDays, "d overdue"] }), isPartial && overdueDays > 0 && _jsxs("span", { className: "text-xs font-semibold text-red-600", children: [overdueDays, "d overdue"] }), isPartial && _jsxs("span", { className: "text-xs text-amber-700", children: ["Remaining: AED ", partialRemaining.toLocaleString()] }), p.lastReminderSentAt && (_jsxs("span", { className: "text-xs text-slate-400", title: `Reminder count: ${p.reminderCount ?? 0}`, children: ["Reminded ", timeAgo(p.lastReminderSentAt)] })), (p.auditLog?.length > 0) && (_jsx("button", { onClick: () => setExpandedAuditId(auditOpen ? null : p.id), className: "text-xs text-blue-500 hover:underline", children: auditOpen ? "Hide" : `History (${p.auditLog.length})` }))] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "text-right", children: [_jsxs("p", { className: `text-sm font-bold ${isOverdue ? "text-red-700" : "text-slate-800"}`, children: ["AED ", p.amount.toLocaleString()] }), _jsx("span", { className: `text-xs font-medium px-2 py-0.5 rounded-full ${PAY_BADGE[p.status] || "bg-slate-100 text-slate-600"}`, children: p.status.replace(/_/g, " ") })] }), _jsx("div", { className: "flex gap-1.5 flex-shrink-0", children: (p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIAL") ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { setShowMarkPaidModal(p.id); setPaidDate(new Date().toISOString().slice(0, 10)); setPaidRef(""); setPaidNotes(""); }, disabled: payingId === p.id, className: "px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50", children: payingId === p.id ? "…" : "Mark Paid" }), _jsx("button", { onClick: () => { setShowPartialModal(p.id); setPartialAmount(""); setPartialMethod("BANK_TRANSFER"); setPartialRef(""); setPartialNotes(""); }, className: "px-2.5 py-1 text-xs font-medium border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors", children: "Partial" }), p.status !== "PARTIAL" && (_jsx("button", { onClick: () => { setShowPdcModal(p.id); setPdcForm({ pdcNumber: "", pdcBank: "", pdcDate: "" }); }, className: "px-2.5 py-1 text-xs font-medium border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors", children: "PDC" })), !p.isWaived && (_jsx("button", { onClick: () => { setWaiveId(p.id); setWaiveReason(""); }, className: "px-2.5 py-1 text-xs font-medium border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors", children: "Waive" }))] })) : p.status === "PDC_PENDING" ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handlePdcAction(p.id, "pdc-cleared"), disabled: pdcId === p.id, className: "px-2.5 py-1 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50", children: "Cleared" }), _jsx("button", { onClick: () => handlePdcAction(p.id, "pdc-bounced"), disabled: pdcId === p.id, className: "px-2.5 py-1 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50", children: "Bounced" })] })) : null })] })] }), (() => {
                                                                const invoiceDoc = invoiceDocByPayment(p.id);
                                                                const receiptDoc = receiptDocByPayment(p.id);
                                                                const canInvoice = ["PENDING", "OVERDUE", "PARTIAL"].includes(p.status);
                                                                const canReceipt = ["PAID", "PARTIAL"].includes(p.status);
                                                                if (!canInvoice && !canReceipt)
                                                                    return null;
                                                                return (_jsxs("div", { className: "px-5 pb-2 flex items-center gap-2 flex-wrap", children: [canInvoice && (invoiceDoc ? (_jsx("a", { href: `/payments/${p.id}/print/invoice?docId=${invoiceDoc.id}`, target: "_blank", rel: "noreferrer", className: "px-2.5 py-1 text-xs font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors", children: "View Invoice" })) : (_jsx("button", { onClick: () => generateInvoice(p.id), disabled: generatingInvoice === p.id, className: "px-2.5 py-1 text-xs font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50", children: generatingInvoice === p.id ? "Generating…" : "Generate Invoice" }))), canReceipt && (receiptDoc ? (_jsx("a", { href: `/payments/${p.id}/print/receipt?docId=${receiptDoc.id}`, target: "_blank", rel: "noreferrer", className: "px-2.5 py-1 text-xs font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors", children: "View Receipt" })) : (_jsx("button", { onClick: () => generateReceipt(p.id), disabled: generatingReceipt === p.id, className: "px-2.5 py-1 text-xs font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50", children: generatingReceipt === p.id ? "Generating…" : "Generate Receipt" })))] }));
                                                            })(), auditOpen && p.auditLog?.length > 0 && (_jsx("div", { className: "px-5 pb-3", children: _jsx("div", { className: "bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100", children: p.auditLog.map((log) => (_jsxs("div", { className: "px-3 py-2 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-semibold text-slate-700", children: log.action.replace(/_/g, " ") }), log.reason && _jsxs("span", { className: "text-xs text-slate-500 ml-2", children: ["\u00B7 ", log.reason] }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: ["by ", log.changedBy] })] }), _jsx("span", { className: "text-xs text-slate-400 flex-shrink-0", children: fmtDate(log.changedAt) })] }, log.id))) }) }))] }, p.id));
                                                }) })] }))), activeTab === "activity" && (_jsxs("div", { children: [_jsxs("div", { className: "px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap", children: [[
                                                        { type: "NOTE", label: "Note", icon: "📝" },
                                                        { type: "CALL", label: "Call", icon: "📞" },
                                                        { type: "MEETING", label: "Meeting", icon: "🤝" },
                                                        { type: "SITE_VISIT", label: "Site Visit", icon: "🏢" },
                                                    ].map(({ type, label, icon }) => (_jsxs("button", { onClick: () => { setActivityForm((f) => ({ ...f, type })); setShowActivityForm(true); }, className: `px-3 py-1.5 text-xs font-semibold border rounded-lg flex items-center gap-1.5 transition-colors ${showActivityForm && activityForm.type === type
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"}`, children: [_jsx("span", { children: icon }), label] }, type))), showActivityForm && (_jsx("button", { onClick: () => setShowActivityForm(false), className: "ml-auto text-xs text-slate-400 hover:text-slate-600", children: "\u2715 Cancel" }))] }), showActivityForm && (_jsxs("div", { className: "px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3", children: [_jsx("div", { className: "flex gap-2 flex-wrap", children: ["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "SITE_VISIT"].map((t) => (_jsx("button", { onClick: () => setActivityForm((f) => ({ ...f, type: t })), className: `px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${activityForm.type === t ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 bg-white text-slate-600 hover:border-blue-400"}`, children: t.replace("_", " ") }, t))) }), _jsx("textarea", { value: activityForm.summary, onChange: (e) => setActivityForm((f) => ({ ...f, summary: e.target.value })), placeholder: "Summary *", rows: 2, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 resize-none" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-slate-500 mb-1", children: "Activity Date" }), _jsx("input", { type: "datetime-local", value: activityForm.activityDate, onChange: (e) => setActivityForm((f) => ({ ...f, activityDate: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-slate-500 mb-1", children: "Follow-up Date" }), _jsx("input", { type: "datetime-local", value: activityForm.followUpDate, onChange: (e) => setActivityForm((f) => ({ ...f, followUpDate: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400" })] })] }), _jsx("button", { onClick: submitActivity, disabled: !activityForm.summary.trim() || submittingActivity, className: "px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors", children: submittingActivity ? "Saving…" : "Save" })] })), activityLoading ? (_jsx("div", { className: "flex items-center justify-center h-24", children: _jsx("div", { className: "w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : activities.length === 0 ? (_jsx("p", { className: "px-5 py-10 text-center text-sm text-slate-400", children: "No activities yet \u2014 log the first one above" })) : (_jsx("div", { className: "px-5 pt-3 pb-2", children: activities.map((a, i) => {
                                                    const icon = activityIcon(a.type, a.summary);
                                                    const isSystem = a.type === "NOTE" && isSystemActivity(a.summary);
                                                    return (_jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "flex flex-col items-center flex-shrink-0 w-8", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center text-sm z-10 ${isSystem ? "bg-slate-100" : "bg-blue-50"}`, children: icon }), i < activities.length - 1 && (_jsx("div", { className: "w-0.5 bg-slate-100 flex-1 my-1", style: { minHeight: "1.25rem" } }))] }), _jsxs("div", { className: "flex-1 min-w-0 pb-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx("span", { className: "text-xs font-semibold text-slate-600 uppercase tracking-wide", children: a.type.replace("_", " ") }), isSystem && (_jsx("span", { className: "text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded", children: "auto" }))] }), _jsx("span", { className: "text-xs text-slate-400 flex-shrink-0", children: timeAgo(a.activityDate || a.createdAt) })] }), _jsx("p", { className: "text-sm text-slate-700 mt-0.5 leading-relaxed", children: a.summary }), a.outcome && _jsx("p", { className: "text-xs text-slate-500 mt-1 italic", children: a.outcome }), a.followUpDate && (_jsxs("p", { className: "text-xs text-amber-600 mt-0.5", children: ["Follow-up: ", fmtDate(a.followUpDate)] })), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: a.createdBy })] })] }, a.id));
                                                }) }))] })), activeTab === "tasks" && (_jsxs("div", { className: "divide-y divide-slate-50", children: [_jsxs("div", { className: "px-5 py-3", children: [_jsx("button", { onClick: () => setShowAddTaskForm((v) => !v), className: "text-xs font-semibold text-blue-600 hover:underline", children: showAddTaskForm ? "− Cancel" : "+ Add Task" }), showAddTaskForm && (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("input", { type: "text", value: addTaskForm.title, onChange: (e) => setAddTaskForm((f) => ({ ...f, title: e.target.value })), placeholder: "Task title *", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx("select", { value: addTaskForm.type, onChange: (e) => setAddTaskForm((f) => ({ ...f, type: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 focus:outline-none", children: ["CALL", "MEETING", "FOLLOW_UP", "DOCUMENT", "PAYMENT"].map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)) }), _jsx("select", { value: addTaskForm.priority, onChange: (e) => setAddTaskForm((f) => ({ ...f, priority: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 focus:outline-none", children: ["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => _jsx("option", { value: p, children: p }, p)) }), _jsx("input", { type: "datetime-local", value: addTaskForm.dueDate, onChange: (e) => setAddTaskForm((f) => ({ ...f, dueDate: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 focus:outline-none" })] }), _jsx("button", { onClick: submitDealTask, disabled: !addTaskForm.title.trim() || !addTaskForm.dueDate || addingTask, className: "px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: addingTask ? "Creating…" : "Create Task" })] }))] }), tasksLoading ? (_jsx("div", { className: "flex items-center justify-center h-24", children: _jsx("div", { className: "w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : dealTasks.length === 0 ? (_jsx("p", { className: "px-5 py-8 text-center text-sm text-slate-400", children: "No open tasks" })) : dealTasks.map((t) => {
                                                const isOverdue = new Date(t.dueDate) < new Date();
                                                return (_jsxs("div", { className: "flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 group", children: [_jsx("button", { onClick: () => completeDealTask(t.id), disabled: completingTaskId === t.id, className: "w-5 h-5 rounded-full border-2 border-slate-300 hover:border-blue-500 flex-shrink-0 mt-0.5 transition-colors" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: t.title }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [_jsx("span", { className: "text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded", children: t.type.replace(/_/g, " ") }), _jsxs("span", { className: `text-xs font-semibold ${isOverdue ? "text-red-500" : "text-slate-400"}`, children: [isOverdue ? "Overdue · " : "", fmtDate(t.dueDate)] })] })] })] }, t.id));
                                            })] })), activeTab === "history" && (!deal.stageHistory || deal.stageHistory.length === 0 ? (_jsx("p", { className: "px-5 py-8 text-center text-sm text-slate-400", children: "No stage history yet" })) : (_jsx("div", { className: "divide-y divide-slate-50", children: deal.stageHistory.map((h) => (_jsxs("div", { className: "px-5 py-3.5", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-1", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm flex-wrap", children: [_jsx("span", { className: `px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[h.oldStage] || "bg-slate-100 text-slate-600"}`, children: h.oldStage.replace(/_/g, " ") }), _jsx("span", { className: "text-slate-400 text-xs", children: "\u2192" }), _jsx("span", { className: `px-2 py-0.5 rounded text-xs font-medium ${STAGE_BADGE[h.newStage] || "bg-slate-100 text-slate-600"}`, children: h.newStage.replace(/_/g, " ") })] }), _jsx("span", { className: "text-xs text-slate-400 flex-shrink-0", children: fmtDate(h.changedAt) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-slate-500", children: h.changedBy === "system" ? "System" : h.changedBy }), h.reason && _jsxs("span", { className: "text-xs text-slate-400 italic", children: ["\u00B7 ", h.reason] })] })] }, h.id))) })))] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Deal Status" }), _jsx("div", { className: "flex items-center gap-2 mb-4", children: _jsx("span", { className: `px-3 py-1.5 rounded-lg text-sm font-bold ${STAGE_BADGE[deal.stage] || "bg-slate-100 text-slate-600"}`, children: deal.stage.replace(/_/g, " ") }) }), deal.stage === "RESERVATION_PENDING" && (_jsx("button", { onClick: handleReserveUnit, disabled: reserving, className: "w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors mb-3 flex items-center justify-center gap-2", children: reserving ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" }), " Reserving\u2026"] })) : "Reserve Unit" })), deal.stage === "RESERVATION_CONFIRMED" && (_jsxs("div", { className: "flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3", children: [_jsx("span", { className: "text-base", children: "\u2713" }), _jsx("span", { className: "text-sm font-bold", children: "Unit Reserved" })] })), deal.stage !== "CANCELLED" && deal.stage !== "COMPLETED" && (_jsxs("div", { className: "space-y-1.5", children: [_jsx("p", { className: "text-xs text-slate-400 font-medium mb-2", children: "Next stage:" }), (VALID_DEAL_TRANSITIONS[deal.stage] ?? []).filter((s) => s !== "CANCELLED").map((s) => (_jsxs("button", { onClick: () => handleStageChange(s), disabled: updatingStage, className: "w-full text-left px-3 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-all", children: ["\u2192 ", s.replace(/_/g, " ")] }, s)))] }))] }), _jsxs("div", { className: `rounded-xl border p-4 ${oqoodStyle}`, children: [_jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide mb-3 opacity-70", children: "Oqood Deadline" }), oqood.isOverdue ? (_jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold", children: "Overdue" }), _jsxs("p", { className: "text-sm mt-1", children: [Math.abs(oqood.daysRemaining), " days past deadline"] })] })) : (_jsxs("div", { children: [_jsx("p", { className: "text-4xl font-bold", children: oqood.daysRemaining }), _jsx("p", { className: "text-sm mt-1", children: "days remaining" })] })), _jsxs("p", { className: "text-xs mt-3 opacity-70", children: ["Deadline: ", fmtDate(oqood.deadline)] }), _jsx("div", { className: "mt-3", children: _jsx("div", { className: "h-1.5 bg-black/10 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-current rounded-full opacity-60", style: { width: `${Math.min(100, Math.max(0, 100 - (oqood.daysRemaining / 90) * 100))}%` } }) }) })] }), commission && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Commission" }), _jsxs("p", { className: "text-2xl font-bold text-slate-900 mb-0.5", children: ["AED ", commission.amount.toLocaleString()] }), _jsxs("p", { className: "text-xs text-slate-400 mb-3", children: [commission.rate, "% rate"] }), _jsx("div", { className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-4 ${commission.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                                            commission.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
                                                commission.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" :
                                                    "bg-slate-100 text-slate-600"}`, children: commission.status.replace(/_/g, " ") }), _jsxs("div", { className: "space-y-2 border-t border-slate-100 pt-3", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 mb-2", children: "Unlock Conditions" }), [
                                                { label: "SPA Signed", met: spaOk },
                                                { label: "Oqood Registered", met: oqoodOk },
                                            ].map(({ label, met }) => (_jsxs("div", { className: `flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${met ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`, children: [_jsx("span", { className: "font-bold", children: met ? "✓" : "✗" }), _jsx("span", { className: "font-medium", children: label })] }, label))), spaOk && oqoodOk && (_jsx("p", { className: "text-xs text-center text-emerald-600 font-semibold mt-1", children: "All conditions met \u2713" }))] })] })), stageRequirements.length > 0 && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Next Stage Checklist" }), _jsx("div", { className: "space-y-2", children: stageRequirements.map((req) => (_jsxs("div", { className: `flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${req.uploaded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`, children: [_jsx("span", { className: "font-bold text-base leading-none", children: req.uploaded ? "✓" : "○" }), _jsx("span", { className: "font-medium", children: req.label })] }, req.documentType))) }), stageRequirements.every((r) => r.uploaded) ? (_jsx("p", { className: "text-xs text-center text-emerald-600 font-semibold mt-2", children: "Ready to advance \u2713" })) : (_jsx("p", { className: "text-xs text-center text-amber-600 mt-2", children: "Upload missing documents to advance" }))] })), deal.brokerCompany && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Broker" }), _jsx("p", { className: "text-sm font-semibold text-slate-800", children: deal.brokerCompany.name }), deal.brokerAgent && _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: deal.brokerAgent.name })] })), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2", children: "Reserved On" }), _jsx("p", { className: "text-base font-semibold text-slate-800", children: fmtDate(deal.reservationDate) })] })] })] }), showReserveConfirm && (_jsx("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl", children: [_jsx("div", { className: "px-6 py-5 border-b border-slate-100", children: _jsx("h3", { className: "font-bold text-slate-900 text-lg", children: "Confirm Reservation" }) }), _jsxs("div", { className: "px-6 py-5 space-y-4", children: [_jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4", children: [_jsxs("p", { className: "text-sm text-amber-800 font-medium", children: ["This will lock Unit ", _jsx("span", { className: "font-bold", children: deal?.unit.unitNumber }), " and prevent any other deal from booking it."] }), _jsx("p", { className: "text-xs text-amber-600 mt-1.5", children: "This action cannot be undone by agents. Only an Admin can release a reserved unit." })] }), _jsxs("div", { className: "text-sm text-slate-600 space-y-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Buyer" }), _jsxs("span", { className: "font-medium", children: [deal?.lead.firstName, " ", deal?.lead.lastName] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Unit" }), _jsxs("span", { className: "font-medium", children: [deal?.unit.unitNumber, " \u00B7 ", deal?.unit.type.replace(/_/g, " ")] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Price" }), _jsxs("span", { className: "font-bold text-blue-700", children: ["AED ", deal?.salePrice.toLocaleString()] })] })] }), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { onClick: confirmReserveUnit, disabled: reserving, className: "flex-1 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors", children: reserving ? "Reserving…" : "Confirm — Reserve Unit" }), _jsx("button", { onClick: () => setShowReserveConfirm(false), className: "px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors", children: "Cancel" })] })] })] }) })), showCancelModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-100", children: [_jsx("h3", { className: "font-bold text-slate-900", children: "Cancel Deal" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "This will release the unit back to available." })] }), _jsx("div", { className: "px-6 py-4 space-y-3", children: _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reason *" }), _jsx("textarea", { value: cancelReason, onChange: (e) => setCancelReason(e.target.value), placeholder: "e.g. Client withdrew, financing fell through\u2026", rows: 3, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-red-400 resize-none" })] }) }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => { setShowCancelModal(false); setCancelReason(""); }, className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Keep Deal" }), _jsx("button", { onClick: handleCancelDeal, disabled: !cancelReason.trim() || cancelling, className: "flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50", children: cancelling ? "Cancelling…" : "Cancel Deal" })] })] }) })), showMarkPaidModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-xs shadow-2xl", children: [_jsx("div", { className: "px-6 py-4 border-b border-slate-100", children: _jsx("h3", { className: "font-bold text-slate-900", children: "Mark Payment as Paid" }) }), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Payment Method" }), _jsx("select", { value: paidMethod, onChange: (e) => setPaidMethod(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: ["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "CRYPTO"].map((m) => (_jsx("option", { value: m, children: m.replace(/_/g, " ") }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Payment Date" }), _jsx("input", { type: "date", value: paidDate, onChange: (e) => setPaidDate(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reference / Receipt No." }), _jsx("input", { type: "text", value: paidRef, onChange: (e) => setPaidRef(e.target.value), placeholder: "e.g. TXN-12345", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Notes" }), _jsx("textarea", { value: paidNotes, onChange: (e) => setPaidNotes(e.target.value), placeholder: "Optional notes\u2026", rows: 2, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setShowMarkPaidModal(null), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: confirmMarkPaid, disabled: payingId !== null, className: "flex-1 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50", children: payingId ? "Saving…" : "Confirm Paid" })] })] }) })), showPartialModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-xs shadow-2xl", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-100", children: [_jsx("h3", { className: "font-bold text-slate-900", children: "Record Partial Payment" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Enter the amount received so far." })] }), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Amount Received (AED) *" }), _jsx("input", { type: "number", min: "1", value: partialAmount, onChange: (e) => setPartialAmount(e.target.value), placeholder: "e.g. 50000", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Payment Method" }), _jsx("select", { value: partialMethod, onChange: (e) => setPartialMethod(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400", children: ["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "CRYPTO"].map((m) => (_jsx("option", { value: m, children: m.replace(/_/g, " ") }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reference / Receipt No." }), _jsx("input", { type: "text", value: partialRef, onChange: (e) => setPartialRef(e.target.value), placeholder: "e.g. TXN-12345", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Notes" }), _jsx("textarea", { value: partialNotes, onChange: (e) => setPartialNotes(e.target.value), placeholder: "Optional notes\u2026", rows: 2, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setShowPartialModal(null), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: confirmPartial, disabled: submittingPartial || !partialAmount || parseFloat(partialAmount) <= 0, className: "flex-1 py-2.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 text-sm disabled:opacity-50", children: submittingPartial ? "Saving…" : "Record Partial" })] })] }) })), showDocumentUploadModal && (_jsx(DocumentUploadModal, { dealId: dealId, onClose: () => setShowDocumentUploadModal(false), onSaved: () => {
                    setDocumentKey((prev) => prev + 1);
                } })), showPdcModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-xs shadow-2xl", children: [_jsx("div", { className: "px-6 py-4 border-b border-slate-100", children: _jsx("h3", { className: "font-bold text-slate-900", children: "Register Post-Dated Cheque" }) }), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Cheque Number" }), _jsx("input", { type: "text", value: pdcForm.pdcNumber, onChange: (e) => setPdcForm((f) => ({ ...f, pdcNumber: e.target.value })), placeholder: "e.g. 001234", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Bank" }), _jsx("input", { type: "text", value: pdcForm.pdcBank, onChange: (e) => setPdcForm((f) => ({ ...f, pdcBank: e.target.value })), placeholder: "e.g. Emirates NBD", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Cheque Date" }), _jsx("input", { type: "date", value: pdcForm.pdcDate, onChange: (e) => setPdcForm((f) => ({ ...f, pdcDate: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setShowPdcModal(null), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: confirmPdc, disabled: pdcId !== null, className: "flex-1 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50", children: pdcId ? "Saving…" : "Register PDC" })] })] }) })), waiveId && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-xs shadow-2xl", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-100", children: [_jsx("h3", { className: "font-bold text-slate-900", children: "Waive Payment" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "This removes the payment from collection obligations." })] }), _jsxs("div", { className: "px-6 py-4", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reason *" }), _jsx("textarea", { value: waiveReason, onChange: (e) => setWaiveReason(e.target.value), placeholder: "e.g. Developer incentive, agreed waiver\u2026", rows: 3, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setWaiveId(null), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: confirmWaive, disabled: submittingWaive || !waiveReason.trim(), className: "flex-1 py-2.5 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-900 text-sm disabled:opacity-50", children: submittingWaive ? "Waiving…" : "Waive Payment" })] })] }) })), showAddMilestone && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-xs shadow-2xl", children: [_jsx("div", { className: "px-6 py-4 border-b border-slate-100", children: _jsx("h3", { className: "font-bold text-slate-900", children: "Add Custom Milestone" }) }), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Label *" }), _jsx("input", { type: "text", value: milestoneForm.label, onChange: (e) => setMilestoneForm((f) => ({ ...f, label: e.target.value })), placeholder: "e.g. Handover Balance", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Amount (AED) *" }), _jsx("input", { type: "number", min: "1", value: milestoneForm.amount, onChange: (e) => setMilestoneForm((f) => ({ ...f, amount: e.target.value })), placeholder: "e.g. 50000", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Due Date *" }), _jsx("input", { type: "date", value: milestoneForm.dueDate, onChange: (e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value })), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Notes" }), _jsx("input", { type: "text", value: milestoneForm.notes, onChange: (e) => setMilestoneForm((f) => ({ ...f, notes: e.target.value })), placeholder: "Optional", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setShowAddMilestone(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: confirmAddMilestone, disabled: addingMilestone || !milestoneForm.label || !milestoneForm.amount || !milestoneForm.dueDate, className: "flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50", children: addingMilestone ? "Adding…" : "Add Milestone" })] })] }) })), showRestructure && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-xs shadow-2xl", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-100", children: [_jsx("h3", { className: "font-bold text-slate-900", children: "Restructure Payment Schedule" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Shifts all future PENDING payments by N days." })] }), _jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Shift by (days) *" }), _jsx("input", { type: "number", value: restructureDays, onChange: (e) => setRestructureDays(e.target.value), placeholder: "e.g. 30 (positive = later, negative = earlier)", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Reason *" }), _jsx("textarea", { value: restructureReason, onChange: (e) => setRestructureReason(e.target.value), placeholder: "e.g. Construction delay, handover pushed to Q3 2026\u2026", rows: 3, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 resize-none" })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-3", children: [_jsx("button", { onClick: () => setShowRestructure(false), className: "flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm", children: "Cancel" }), _jsx("button", { onClick: confirmRestructure, disabled: submittingRestructure || !restructureDays || !restructureReason.trim(), className: "flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50", children: submittingRestructure ? "Restructuring…" : "Apply Shift" })] })] }) })), showEditModal && (_jsx(DealEditModal, { deal: deal, onClose: () => setShowEditModal(false), onSaved: loadDeal })), _jsx(ConfirmDialog, { open: !!pendingStage, title: "Change Deal Stage", message: `Move deal to "${pendingStage?.replace(/_/g, " ")}"? This will trigger all associated side effects.`, confirmLabel: "Move Stage", variant: "warning", onConfirm: confirmStageChange, onCancel: () => setPendingStage(null) }), showPauseModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl w-full max-w-sm", children: [_jsxs("div", { className: "px-6 py-5 border-b border-slate-100", children: [_jsx("h3", { className: "text-base font-bold text-slate-900", children: "Pause Payment Reminders" }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "No automated emails will be sent while paused." })] }), _jsxs("div", { className: "px-6 py-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: ["Reason ", _jsx("span", { className: "text-slate-400", children: "(optional)" })] }), _jsx("textarea", { value: pauseReason, onChange: (e) => setPauseReason(e.target.value), placeholder: "e.g. Buyer requested delay", rows: 2, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: ["Resume on ", _jsx("span", { className: "text-slate-400", children: "(optional)" })] }), _jsx("input", { type: "date", value: pauseUntil, onChange: (e) => setPauseUntil(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" })] })] }), _jsxs("div", { className: "flex gap-3 px-6 pb-5", children: [_jsx("button", { onClick: () => togglePauseReminders(true), disabled: pausingReminders, className: "flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50", children: pausingReminders ? "Pausing…" : "Pause Reminders" }), _jsx("button", { onClick: () => setShowPauseModal(false), className: "flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors", children: "Cancel" })] })] }) }))] }));
}
