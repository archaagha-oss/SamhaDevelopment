import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import Breadcrumbs from "./Breadcrumbs";
import UnitInterestPicker from "./UnitInterestPicker";
// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVITY_ICON = {
    CALL: "📞", EMAIL: "✉️", WHATSAPP: "💬", MEETING: "🤝",
    SITE_VISIT: "🏢", NOTE: "📝",
};
const STAGE_BADGE = {
    NEW: "bg-slate-100 text-slate-600",
    CONTACTED: "bg-blue-100 text-blue-700",
    QUALIFIED: "bg-indigo-100 text-indigo-700",
    OFFER_SENT: "bg-violet-100 text-violet-700",
    SITE_VISIT: "bg-cyan-100 text-cyan-700",
    NEGOTIATING: "bg-amber-100 text-amber-700",
    CLOSED_WON: "bg-emerald-100 text-emerald-700",
    CLOSED_LOST: "bg-red-100 text-red-700",
};
const DEAL_STAGE_BADGE = {
    RESERVATION_PENDING: "bg-slate-100 text-slate-600",
    RESERVATION_CONFIRMED: "bg-blue-100 text-blue-700",
    SPA_PENDING: "bg-violet-50 text-violet-600",
    SPA_SENT: "bg-violet-100 text-violet-700",
    SPA_SIGNED: "bg-purple-100 text-purple-700",
    OQOOD_PENDING: "bg-amber-100 text-amber-700",
    OQOOD_REGISTERED: "bg-emerald-100 text-emerald-700",
    INSTALLMENTS_ACTIVE: "bg-cyan-100 text-cyan-700",
    HANDOVER_PENDING: "bg-orange-100 text-orange-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
};
const SOURCE_OPTIONS = ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"];
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400";
const primaryBtn = "px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50";
const cancelBtn = "px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm";
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
    return `${new Date(dateStr).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })} ${new Date(dateStr).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`;
}
// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl my-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100", children: [_jsx("h2", { className: "font-semibold text-slate-800 text-base", children: title }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "px-6 py-5", children: children })] }) }));
}
export default function LeadProfilePage({ leadId: leadIdProp, onBack }) {
    const params = useParams();
    const navigate = useNavigate();
    const leadId = leadIdProp ?? params.leadId ?? "";
    const handleBack = onBack ?? (() => navigate("/leads"));
    // Core data
    const [lead, setLead] = useState(null);
    const [activities, setActivities] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addingTask, setAddingTask] = useState(false);
    const [quickTask, setQuickTask] = useState({ title: "", type: "FOLLOW_UP", dueDate: "" });
    const [completingTaskId, setCompletingTaskId] = useState(null);
    // Lookups
    const [agents, setAgents] = useState([]);
    const [paymentPlans, setPaymentPlans] = useState([]);
    const [brokerCompanies, setBrokerCompanies] = useState([]);
    const [brokerAgents, setBrokerAgents] = useState([]);
    const [availableUnits, setAvailableUnits] = useState([]);
    // Stage change
    const [validTransitions, setValidTransitions] = useState([]);
    const [changingStage, setChangingStage] = useState(false);
    const [stageReason, setStageReason] = useState("");
    const [showStagePopover, setShowStagePopover] = useState(false);
    // Activity log
    const [showActForm, setShowActForm] = useState(false);
    const [actType, setActType] = useState("CALL");
    const [summary, setSummary] = useState("");
    const [outcome, setOutcome] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [submitting, setSubmitting] = useState(false);
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
    const [editingUnitIds, setEditingUnitIds] = useState(new Set());
    const [editingPrimaryUnitId, setEditingPrimaryUnitId] = useState("");
    // Offers
    const [offers, setOffers] = useState([]);
    // Offer modal (generate / revise)
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [offerModalUnit, setOfferModalUnit] = useState("");
    const [offerForm, setOfferForm] = useState({
        offeredPrice: "", discountAmount: "0", paymentPlanId: "", expiresAt: "", notes: "",
    });
    const [revisingOffer, setRevisingOffer] = useState(null); // offerId being revised
    const [submittingOffer, setSubmittingOffer] = useState(false);
    // Delete
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Create Deal modal
    const [showCreateDealModal, setShowCreateDealModal] = useState(false);
    const [createDealForm, setCreateDealForm] = useState({ unitId: "", notes: "" });
    const [createDealUnits, setCreateDealUnits] = useState([]);
    const [loadingDealUnits, setLoadingDealUnits] = useState(false);
    const [creatingDealQuick, setCreatingDealQuick] = useState(false);
    // Create reservation (deal)
    const [showDealForm, setShowDealForm] = useState(false);
    const [dealForm, setDealForm] = useState({
        unitId: "", salePrice: "", discount: "0", reservationAmount: "0", paymentPlanId: "",
        brokerCompanyId: "", brokerAgentId: "",
    });
    const [creatingDeal, setCreatingDeal] = useState(false);
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
            .catch(() => { });
    };
    const completeTask = async (id) => {
        setCompletingTaskId(id);
        try {
            await axios.patch(`/api/tasks/${id}/complete`);
            setTasks((prev) => prev.filter((t) => t.id !== id));
        }
        finally {
            setCompletingTaskId(null);
        }
    };
    const submitQuickTask = async () => {
        if (!quickTask.title.trim() || !quickTask.dueDate)
            return;
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
        }
        finally {
            setAddingTask(false);
        }
    };
    useEffect(() => {
        if (!leadId)
            return;
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
            setPaymentPlans(Array.isArray(plans) ? plans.filter((p) => p.isActive) : []);
            setBrokerCompanies(bcRes.data?.data ?? bcRes.data ?? []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [leadId]);
    useEffect(() => {
        if (!lead)
            return;
        axios.get(`/api/leads/${lead.id}/valid-transitions`)
            .then((r) => setValidTransitions(r.data.validNext ?? []))
            .catch(() => setValidTransitions([]));
    }, [lead?.stage, lead?.id]);
    // Load broker agents when company selected in deal or edit form
    const loadBrokerAgents = (companyId) => {
        if (!companyId) {
            setBrokerAgents([]);
            return;
        }
        axios.get(`/api/brokers/companies/${companyId}/agents`)
            .then((r) => setBrokerAgents(r.data?.data ?? r.data ?? []))
            .catch(() => setBrokerAgents([]));
    };
    useEffect(() => {
        if (showEditForm && lead) {
            setEditForm({
                firstName: lead.firstName,
                lastName: lead.lastName,
                phone: lead.phone,
                email: lead.email ?? "",
                nationality: lead.nationality ?? "",
                source: lead.source,
                budget: lead.budget != null ? String(lead.budget) : "",
                notes: lead.notes ?? "",
                assignedAgentId: lead.assignedAgent?.id ?? lead.assignedAgentId ?? "",
                brokerCompanyId: lead.brokerCompanyId ?? "",
                brokerAgentId: lead.brokerAgentId ?? "",
            });
            // Initialize unit picker with current interests
            const unitIds = new Set(lead.interests.map((i) => i.unitId));
            setEditingUnitIds(unitIds);
            const primaryInterest = lead.interests.find((i) => i.isPrimary);
            setEditingPrimaryUnitId(primaryInterest?.unitId ?? "");
            if (lead.brokerCompanyId)
                loadBrokerAgents(lead.brokerCompanyId);
        }
    }, [showEditForm]);
    useEffect(() => {
        if (showDealForm && availableUnits.length === 0) {
            axios.get("/api/units", { params: { limit: 200 } })
                .then((r) => {
                const all = r.data.data ?? r.data ?? [];
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
    const handleStageChange = async (newStage) => {
        if (!lead)
            return;
        setChangingStage(true);
        try {
            await axios.patch(`/api/leads/${lead.id}/stage`, { newStage, reason: stageReason || undefined });
            toast.success(`Lead moved to ${newStage.replace(/_/g, " ")}`);
            setShowStagePopover(false);
            setStageReason("");
            await reloadLead();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to change stage");
        }
        finally {
            setChangingStage(false);
        }
    };
    const handleLogActivity = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(`/api/leads/${leadId}/activities`, {
                type: actType, summary, outcome: outcome || undefined,
                followUpDate: followUpDate || undefined,
            });
            const aRes = await axios.get(`/api/leads/${leadId}/activities`);
            setActivities(aRes.data);
            setSummary("");
            setOutcome("");
            setFollowUpDate("");
            setShowActForm(false);
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to log activity");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!lead)
            return;
        setEditSaving(true);
        try {
            const payload = {};
            const get = (k) => editForm[k];
            if (get("firstName") !== lead.firstName)
                payload.firstName = get("firstName");
            if (get("lastName") !== lead.lastName)
                payload.lastName = get("lastName");
            if (get("phone") !== lead.phone)
                payload.phone = get("phone");
            if (get("email") !== (lead.email ?? ""))
                payload.email = get("email") || null;
            if (get("nationality") !== (lead.nationality ?? ""))
                payload.nationality = get("nationality") || null;
            if (get("source") !== lead.source)
                payload.source = get("source");
            if (get("notes") !== (lead.notes ?? ""))
                payload.notes = get("notes") || null;
            const bv = get("budget") !== "" ? parseFloat(get("budget")) : null;
            if (bv !== (lead.budget ?? null))
                payload.budget = bv;
            const agentId = lead.assignedAgent?.id ?? lead.assignedAgentId ?? "";
            if (get("assignedAgentId") !== agentId)
                payload.assignedAgentId = get("assignedAgentId") || null;
            if (get("brokerCompanyId") !== (lead.brokerCompanyId ?? ""))
                payload.brokerCompanyId = get("brokerCompanyId") || null;
            if (get("brokerAgentId") !== (lead.brokerAgentId ?? ""))
                payload.brokerAgentId = get("brokerAgentId") || null;
            if (Object.keys(payload).length > 0) {
                await axios.patch(`/api/leads/${lead.id}`, payload);
            }
            toast.success("Lead updated");
            await reloadLead();
            setShowEditForm(false);
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update lead");
        }
        finally {
            setEditSaving(false);
        }
    };
    const handleDelete = async () => {
        if (!lead)
            return;
        setConfirmDelete(true);
    };
    const doDelete = async () => {
        if (!lead)
            return;
        setConfirmDelete(false);
        setDeleting(true);
        try {
            await axios.delete(`/api/leads/${lead.id}`);
            handleBack();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to delete lead");
            setDeleting(false);
        }
    };
    const handleUnitsChange = async (selected, primary) => {
        if (!lead)
            return;
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
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update unit interests");
        }
    };
    const openOfferModal = (unitId, existing) => {
        setOfferModalUnit(unitId);
        setRevisingOffer(existing?.id ?? null);
        const unit = lead?.interests.find((i) => i.unitId === unitId)?.unit;
        setOfferForm({
            offeredPrice: existing ? String(existing.offeredPrice) : (unit ? String(unit.price) : ""),
            discountAmount: existing ? String(existing.discountAmount) : "0",
            paymentPlanId: existing?.paymentPlan?.id ?? "",
            expiresAt: "",
            notes: existing?.notes ?? "",
        });
        setShowOfferModal(true);
    };
    const handleOfferSubmit = async (e) => {
        e.preventDefault();
        if (!lead)
            return;
        setSubmittingOffer(true);
        try {
            await axios.post("/api/offers", {
                leadId: lead.id,
                unitId: offerModalUnit,
                offeredPrice: parseFloat(offerForm.offeredPrice),
                discountAmount: parseFloat(offerForm.discountAmount) || 0,
                paymentPlanId: offerForm.paymentPlanId || undefined,
                expiresAt: offerForm.expiresAt || undefined,
                notes: offerForm.notes || undefined,
            });
            toast.success(revisingOffer ? "New offer version created" : "Offer generated");
            setShowOfferModal(false);
            setOfferForm({ offeredPrice: "", discountAmount: "0", paymentPlanId: "", expiresAt: "", notes: "" });
            setRevisingOffer(null);
            const r = await axios.get("/api/offers", { params: { leadId: lead.id } });
            setOffers(r.data ?? []);
            await reloadLead();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to create offer");
        }
        finally {
            setSubmittingOffer(false);
        }
    };
    const handleOfferStatus = async (offerId, status, rejectedReason) => {
        try {
            await axios.patch(`/api/offers/${offerId}/status`, { status, rejectedReason });
            const r = await axios.get("/api/offers", { params: { leadId } });
            setOffers(r.data ?? []);
            toast.success(`Offer ${status.toLowerCase()}`);
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update offer");
        }
    };
    const openReservationFromOffer = (offer) => {
        if (availableUnits.length === 0) {
            axios.get("/api/units", { params: { limit: 200 } })
                .then((r) => {
                const all = r.data.data ?? r.data ?? [];
                setAvailableUnits(all.filter((u) => u.status === "AVAILABLE" || u.status === "ON_HOLD"));
            })
                .catch(console.error);
        }
        setDealForm({
            unitId: offer.unitId,
            salePrice: String(offer.offeredPrice),
            discount: String(offer.discountAmount ?? 0),
            reservationAmount: "0",
            paymentPlanId: offer.paymentPlan?.id ?? "",
            brokerCompanyId: "",
            brokerAgentId: "",
        });
        setShowDealForm(true);
    };
    const handleDealUnitChange = (unitId) => {
        const unit = availableUnits.find((u) => u.id === unitId);
        setDealForm((p) => ({ ...p, unitId, salePrice: unit ? String(unit.price) : p.salePrice }));
    };
    const handleDealSubmit = async (e) => {
        e.preventDefault();
        if (!lead || !dealForm.paymentPlanId) {
            toast.error("Select a payment plan");
            return;
        }
        setCreatingDeal(true);
        try {
            await axios.post("/api/deals", {
                leadId: lead.id,
                unitId: dealForm.unitId,
                salePrice: parseFloat(dealForm.salePrice),
                discount: parseFloat(dealForm.discount) || 0,
                reservationAmount: parseFloat(dealForm.reservationAmount) || 0,
                paymentPlanId: dealForm.paymentPlanId,
                brokerCompanyId: dealForm.brokerCompanyId || undefined,
                brokerAgentId: dealForm.brokerAgentId || undefined,
            });
            setShowDealForm(false);
            setDealForm({ unitId: "", salePrice: "", discount: "0", reservationAmount: "0", paymentPlanId: "", brokerCompanyId: "", brokerAgentId: "" });
            await reloadLead();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to create reservation");
        }
        finally {
            setCreatingDeal(false);
        }
    };
    const openCreateDealModal = async () => {
        if (!lead)
            return;
        setCreateDealForm({ unitId: "", notes: "" });
        setShowCreateDealModal(true);
        if (createDealUnits.length === 0) {
            setLoadingDealUnits(true);
            try {
                const r = await axios.get("/api/units", { params: { limit: 300 } });
                const all = r.data.data ?? r.data ?? [];
                const selectable = all.filter((u) => u.status === "AVAILABLE" || u.status === "ON_HOLD");
                setCreateDealUnits(selectable);
                // Pre-select from lead's primary interest
                const primary = lead.interests.find((i) => i.isPrimary) ?? lead.interests[0];
                if (primary) {
                    const match = selectable.find((u) => u.id === primary.unitId);
                    if (match)
                        setCreateDealForm((p) => ({ ...p, unitId: match.id }));
                }
            }
            catch {
                // silently ignore — user can still type or pick
            }
            finally {
                setLoadingDealUnits(false);
            }
        }
        else {
            // Pre-select even if units already loaded
            const primary = lead.interests.find((i) => i.isPrimary) ?? lead.interests[0];
            if (primary) {
                const match = createDealUnits.find((u) => u.id === primary.unitId);
                if (match)
                    setCreateDealForm((p) => ({ ...p, unitId: match.id }));
            }
        }
    };
    const handleCreateDealSubmit = async () => {
        if (!lead)
            return;
        setCreatingDealQuick(true);
        try {
            const res = await axios.post(`/api/leads/${lead.id}/create-deal`, {
                unitId: createDealForm.unitId || undefined,
                notes: createDealForm.notes || undefined,
            });
            setShowCreateDealModal(false);
            navigate(`/deals/${res.data.id}`);
        }
        catch (err) {
            const existingId = err.response?.data?.existingDealId;
            if (existingId) {
                toast.error("Active deal already exists for this lead — opening it now.");
                setShowCreateDealModal(false);
                navigate(`/deals/${existingId}`);
            }
            else {
                toast.error(err.response?.data?.error || "Unable to create deal. Try again.");
            }
        }
        finally {
            setCreatingDealQuick(false);
        }
    };
    // ── Render ───────────────────────────────────────────────────────────────────
    if (loading || !lead)
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    const activeDeals = lead.deals?.filter((d) => d.isActive) ?? [];
    const inactiveDeals = lead.deals?.filter((d) => !d.isActive) ?? [];
    return (_jsxs("div", { className: "p-6 space-y-5 max-w-5xl", children: [_jsx(Breadcrumbs, { crumbs: [
                    { label: "Leads", path: "/leads" },
                    { label: lead ? `${lead.firstName} ${lead.lastName}` : "Lead" },
                ] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: _jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 font-bold text-xl flex-shrink-0", children: [lead.firstName.charAt(0), lead.lastName.charAt(0)] }), _jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-slate-900", children: [lead.firstName, " ", lead.lastName] }), _jsxs("div", { className: "flex items-center gap-3 mt-1 flex-wrap", children: [_jsx("span", { className: "text-sm text-slate-500", children: lead.phone }), lead.email && _jsx("span", { className: "text-sm text-slate-400", children: lead.email })] })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setShowStagePopover(!showStagePopover), className: `px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${STAGE_BADGE[lead.stage] || "bg-slate-100 text-slate-600"}`, children: [lead.stage.replace(/_/g, " "), validTransitions.length > 0 && _jsx("span", { className: "text-xs opacity-60", children: "\u25BE" })] }), showStagePopover && validTransitions.length > 0 && (_jsxs("div", { className: "absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-56 p-3 space-y-2", children: [_jsx("p", { className: "text-xs font-medium text-slate-500 mb-2", children: "Move to:" }), validTransitions.map((s) => (_jsx("button", { onClick: () => handleStageChange(s), disabled: changingStage, className: "w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 text-slate-700 disabled:opacity-50", children: s.replace(/_/g, " ") }, s))), _jsx("input", { placeholder: "Reason (optional)", value: stageReason, onChange: (e) => setStageReason(e.target.value), className: "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:border-blue-400 mt-1" }), _jsx("button", { onClick: () => setShowStagePopover(false), className: "text-xs text-slate-400 hover:text-slate-600 mt-1", children: "Cancel" })] }))] }), _jsx("button", { onClick: () => setShowEditForm(true), className: "px-3 py-1.5 text-sm text-slate-600 font-medium border border-slate-200 rounded-lg hover:bg-slate-50", children: "Edit" }), _jsx("button", { onClick: openCreateDealModal, className: "px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1.5", children: "Create Deal" }), _jsx("button", { onClick: () => setShowDealForm(true), className: "px-3 py-1.5 text-sm text-slate-500 font-medium border border-slate-200 rounded-lg hover:bg-slate-50", children: "Advanced" }), _jsx("button", { onClick: handleDelete, disabled: deleting, className: "px-3 py-1.5 text-sm text-red-500 font-medium border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50", children: deleting ? "Deleting…" : "Delete" })] })] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-5", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Lead Info" }), _jsxs("div", { className: "space-y-2.5", children: [[
                                                ["Source", lead.source],
                                                ["Nationality", lead.nationality || "—"],
                                                ["Budget", lead.budget ? `AED ${lead.budget.toLocaleString()}` : "—"],
                                                ["Agent", lead.assignedAgent?.name || "Unassigned"],
                                            ].map(([label, value]) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-slate-500", children: label }), _jsx("span", { className: "font-medium text-slate-800", children: value })] }, label))), lead.brokerCompany && (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-slate-500", children: "Broker" }), _jsx("span", { className: "font-medium text-slate-800", children: lead.brokerCompany.name })] })), lead.notes && (_jsxs("div", { className: "pt-2 border-t border-slate-100", children: [_jsx("p", { className: "text-xs text-slate-500 mb-1", children: "Notes" }), _jsx("p", { className: "text-sm text-slate-700 leading-relaxed", children: lead.notes })] }))] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Interested Units" }), lead.interests.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400", children: "No units linked" })) : (_jsx("div", { className: "space-y-2", children: lead.interests.map((i) => {
                                            const offer = offers.find((o) => o.unitId === i.unitId && o.status === "ACTIVE");
                                            return (_jsxs("div", { className: "p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: i.unit.unitNumber }), i.isPrimary && (_jsx("span", { className: "text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold", children: "Primary" }))] }), _jsxs("p", { className: "text-xs text-slate-400", children: [i.unit.type.replace(/_/g, " "), " \u00B7 Floor ", i.unit.floor] })] }), _jsxs("p", { className: "text-sm font-bold text-blue-600", children: ["AED ", i.unit.price.toLocaleString()] })] }), offer ? (_jsxs("div", { className: "flex gap-1.5", children: [_jsx("button", { onClick: () => openReservationFromOffer(offer), className: "flex-1 text-center py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors", children: "Create Reservation" }), _jsx("button", { onClick: () => openOfferModal(i.unitId, offer), className: "px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors", children: "Revise" })] })) : (_jsx("button", { onClick: () => openOfferModal(i.unitId), className: "w-full text-center py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors", children: "Generate Offer" }))] }, i.id));
                                        }) }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: ["Deals ", _jsxs("span", { className: "text-slate-400 font-normal", children: ["(", lead.deals?.length ?? 0, ")"] })] }), (!lead.deals || lead.deals.length === 0) ? (_jsx("p", { className: "text-sm text-slate-400", children: "No deals yet" })) : (_jsx("div", { className: "space-y-2", children: [...activeDeals, ...inactiveDeals].map((d) => (_jsxs("button", { onClick: () => navigate(`/deals/${d.id}`), className: "w-full text-left p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-sm font-semibold text-slate-800 group-hover:text-blue-700", children: d.dealNumber }), _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded font-medium ${DEAL_STAGE_BADGE[d.stage] || "bg-slate-100 text-slate-600"}`, children: d.stage.replace(/_/g, " ") })] }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Unit ", d.unit.unitNumber, " \u00B7 ", d.unit.type] }), _jsxs("p", { className: "text-xs font-medium text-slate-700 mt-0.5", children: ["AED ", d.salePrice.toLocaleString()] })] }, d.id))) }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: ["Offers ", _jsxs("span", { className: "text-slate-400 font-normal", children: ["(", offers.length, ")"] })] }), offers.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400", children: "No offers generated yet" })) : (_jsx("div", { className: "space-y-2", children: offers.map((o, idx) => {
                                            const version = offers.length - idx;
                                            const statusColor = {
                                                ACTIVE: "bg-blue-100 text-blue-700",
                                                ACCEPTED: "bg-emerald-100 text-emerald-700",
                                                REJECTED: "bg-red-100 text-red-700",
                                                EXPIRED: "bg-slate-100 text-slate-500",
                                                WITHDRAWN: "bg-amber-100 text-amber-700",
                                            };
                                            return (_jsxs("div", { className: "p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-xs font-semibold text-slate-700", children: ["v", version, " \u2014 AED ", o.offeredPrice.toLocaleString()] }), _jsxs("p", { className: "text-xs text-slate-400", children: [o.unit?.unitNumber, o.paymentPlan ? ` · ${o.paymentPlan.name}` : "", " · ", fmtDate(o.createdAt)] })] }), _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[o.status] || "bg-slate-100 text-slate-500"}`, children: o.status })] }), o.status === "ACTIVE" && (_jsxs("div", { className: "flex gap-1.5 flex-wrap", children: [_jsx("button", { onClick: () => handleOfferStatus(o.id, "ACCEPTED"), className: "px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700", children: "Accept" }), _jsx("button", { onClick: () => handleOfferStatus(o.id, "REJECTED"), className: "px-2.5 py-1 text-[11px] font-semibold text-white bg-red-500 rounded-md hover:bg-red-600", children: "Reject" }), _jsx("button", { onClick: () => openOfferModal(o.unitId, o), className: "px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-100", children: "Revise" }), _jsx("button", { onClick: () => handleOfferStatus(o.id, "WITHDRAWN"), className: "px-2.5 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-100", children: "Withdraw" })] }))] }, o.id));
                                        }) }))] })] }), _jsx("div", { children: _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: ["Tasks ", _jsxs("span", { className: "text-slate-400 font-normal", children: ["(", tasks.length, ")"] })] }), _jsx("button", { onClick: () => setAddingTask((v) => !v), className: "text-xs text-blue-600 hover:underline font-semibold", children: addingTask ? "−" : "+ Add" })] }), addingTask && (_jsxs("div", { className: "mb-3 space-y-2", children: [_jsx("input", { type: "text", value: quickTask.title, onChange: (e) => setQuickTask((f) => ({ ...f, title: e.target.value })), placeholder: "Task title *", className: inputCls + " text-xs" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("select", { value: quickTask.type, onChange: (e) => setQuickTask((f) => ({ ...f, type: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none", children: ["CALL", "MEETING", "FOLLOW_UP", "DOCUMENT", "PAYMENT"].map((t) => _jsx("option", { value: t, children: t.replace(/_/g, " ") }, t)) }), _jsx("input", { type: "datetime-local", value: quickTask.dueDate, onChange: (e) => setQuickTask((f) => ({ ...f, dueDate: e.target.value })), className: "border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:outline-none" })] }), _jsx("button", { onClick: submitQuickTask, disabled: !quickTask.title.trim() || !quickTask.dueDate, className: "w-full py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: "Create Task" })] })), tasks.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400", children: "No open tasks" })) : (_jsx("div", { className: "space-y-2", children: tasks.map((t) => {
                                        const isOverdue = new Date(t.dueDate) < new Date();
                                        return (_jsxs("div", { className: "flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100", children: [_jsx("button", { onClick: () => completeTask(t.id), disabled: completingTaskId === t.id, className: "w-4 h-4 rounded-full border-2 border-slate-300 hover:border-blue-500 flex-shrink-0 mt-0.5 transition-colors" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-medium text-slate-800 leading-snug", children: t.title }), _jsxs("p", { className: `text-xs mt-0.5 ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`, children: [isOverdue ? "Overdue · " : "", fmtDate(t.dueDate)] })] })] }, t.id));
                                    }) }))] }) }), _jsx("div", { className: "lg:col-span-2", children: _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-semibold text-slate-800 text-sm", children: "Activity Timeline" }), _jsx("span", { className: "bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium", children: activities.length })] }), _jsx("button", { onClick: () => setShowActForm(!showActForm), className: "px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700", children: "+ Log Activity" })] }), showActForm && (_jsxs("form", { onSubmit: handleLogActivity, className: "px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: ["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"].map((t) => (_jsxs("button", { type: "button", onClick: () => setActType(t), className: `text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${actType === t ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"}`, children: [ACTIVITY_ICON[t], " ", t.replace("_", " ")] }, t))) }), _jsx("textarea", { required: true, placeholder: "Summary *", value: summary, onChange: (e) => setSummary(e.target.value), rows: 2, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 resize-none" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("input", { placeholder: "Outcome (optional)", value: outcome, onChange: (e) => setOutcome(e.target.value), className: "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400" }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500 block mb-1", children: "Follow-up date" }), _jsx("input", { type: "datetime-local", value: followUpDate, onChange: (e) => setFollowUpDate(e.target.value), className: "w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", disabled: submitting, className: primaryBtn, children: submitting ? "Saving…" : "Save" }), _jsx("button", { type: "button", onClick: () => setShowActForm(false), className: cancelBtn, children: "Cancel" })] })] })), _jsx("div", { className: "divide-y divide-slate-50 max-h-[520px] overflow-y-auto scrollbar-thin", children: activities.length === 0 ? (_jsx("div", { className: "px-5 py-10 text-center text-slate-400 text-sm", children: "No activities yet" })) : (activities.map((act) => (_jsx("div", { className: "px-5 py-3.5 hover:bg-slate-50/60 transition-colors", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "text-lg mt-0.5 flex-shrink-0", children: ACTIVITY_ICON[act.type] || "📋" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-0.5", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: act.type }), _jsx("span", { className: "text-xs text-slate-400 flex-shrink-0", children: timeAgo(act.activityDate || act.createdAt) })] }), _jsx("p", { className: "text-sm text-slate-700 leading-relaxed", children: act.summary }), act.outcome && _jsxs("p", { className: "text-xs text-slate-500 mt-1 italic", children: ["Outcome: ", act.outcome] })] })] }) }, act.id)))) })] }) })] }), showEditForm && (_jsx(Modal, { title: "Edit Lead", onClose: () => setShowEditForm(false), children: _jsxs("form", { onSubmit: handleEditSubmit, className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "First Name" }), _jsx("input", { required: true, value: editForm.firstName, onChange: (e) => setEditForm((p) => ({ ...p, firstName: e.target.value })), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Last Name" }), _jsx("input", { required: true, value: editForm.lastName, onChange: (e) => setEditForm((p) => ({ ...p, lastName: e.target.value })), className: inputCls })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Phone" }), _jsx("input", { required: true, value: editForm.phone, onChange: (e) => setEditForm((p) => ({ ...p, phone: e.target.value })), className: inputCls })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Email" }), _jsx("input", { type: "email", value: editForm.email, onChange: (e) => setEditForm((p) => ({ ...p, email: e.target.value })), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Nationality" }), _jsx("input", { value: editForm.nationality, onChange: (e) => setEditForm((p) => ({ ...p, nationality: e.target.value })), className: inputCls })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Source" }), _jsx("select", { value: editForm.source, onChange: (e) => setEditForm((p) => ({ ...p, source: e.target.value })), className: inputCls, children: SOURCE_OPTIONS.map((s) => _jsx("option", { value: s, children: s }, s)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Budget (AED)" }), _jsx("input", { type: "number", min: 0, value: editForm.budget, onChange: (e) => setEditForm((p) => ({ ...p, budget: e.target.value })), placeholder: "e.g. 1500000", className: inputCls })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Assigned Agent" }), _jsxs("select", { value: editForm.assignedAgentId, onChange: (e) => setEditForm((p) => ({ ...p, assignedAgentId: e.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 Unassigned \u2014" }), agents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }), editForm.source === "BROKER" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Broker Company" }), _jsxs("select", { value: editForm.brokerCompanyId, onChange: (e) => {
                                                setEditForm((p) => ({ ...p, brokerCompanyId: e.target.value, brokerAgentId: "" }));
                                                loadBrokerAgents(e.target.value);
                                            }, className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), brokerCompanies.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), brokerAgents.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Broker Agent" }), _jsxs("select", { value: editForm.brokerAgentId, onChange: (e) => setEditForm((p) => ({ ...p, brokerAgentId: e.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), brokerAgents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] }))] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Notes" }), _jsx("textarea", { value: editForm.notes, onChange: (e) => setEditForm((p) => ({ ...p, notes: e.target.value })), rows: 2, className: `${inputCls} resize-none` })] }), _jsxs("div", { className: "border border-emerald-100 bg-emerald-50/30 rounded-lg p-3 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("label", { className: "block text-xs font-semibold text-emerald-700", children: ["Interested Units (", editingUnitIds.size, ")"] }), _jsx("button", { type: "button", onClick: () => setShowUnitPicker(true), className: "text-xs text-emerald-700 font-semibold hover:text-emerald-900", children: editingUnitIds.size > 0 ? "Edit" : "+ Add Units" })] }), editingUnitIds.size > 0 && lead?.interests && (_jsx("div", { className: "flex flex-wrap gap-1", children: lead.interests
                                        .filter((i) => editingUnitIds.has(i.unitId))
                                        .map((i) => (_jsxs("span", { className: `text-xs px-2 py-1 rounded-full font-medium ${i.unitId === editingPrimaryUnitId
                                            ? "bg-emerald-600 text-white"
                                            : "bg-white text-slate-700 border border-slate-200"}`, children: [i.unitId === editingPrimaryUnitId && "★ ", i.unit.unitNumber] }, i.unitId))) }))] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx("button", { type: "submit", disabled: editSaving, className: primaryBtn, children: editSaving ? "Saving…" : "Save Changes" }), _jsx("button", { type: "button", onClick: () => setShowEditForm(false), className: cancelBtn, children: "Cancel" })] })] }) })), showEditForm && (_jsx(UnitInterestPicker, { isOpen: showUnitPicker, onClose: () => setShowUnitPicker(false), selectedUnitIds: editingUnitIds, primaryUnitId: editingPrimaryUnitId, onUnitsChange: async (selected, primary) => {
                    setEditingUnitIds(selected);
                    setEditingPrimaryUnitId(primary);
                    await handleUnitsChange(selected, primary);
                } })), showCreateDealModal && (_jsx(Modal, { title: "Create Deal", onClose: () => setShowCreateDealModal(false), children: _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-slate-500", children: "A deal will be created and linked to this lead. Agent and contact are carried forward automatically." }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Unit (optional)" }), loadingDealUnits ? (_jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-400 py-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" }), "Loading units\u2026"] })) : (_jsxs("select", { value: createDealForm.unitId, onChange: (e) => setCreateDealForm((p) => ({ ...p, unitId: e.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 Auto-select from lead interests \u2014" }), (() => {
                                            const interestIds = new Set(lead.interests.map((i) => i.unitId));
                                            const interested = createDealUnits.filter((u) => interestIds.has(u.id));
                                            const others = createDealUnits.filter((u) => !interestIds.has(u.id));
                                            return (_jsxs(_Fragment, { children: [interested.length > 0 && (_jsx("optgroup", { label: "Lead's Interested Units", children: interested.map((u) => (_jsxs("option", { value: u.id, children: ["Unit ", u.unitNumber, " \u2014 ", u.type.replace(/_/g, " "), " \u2014 AED ", u.price.toLocaleString()] }, u.id))) })), others.length > 0 && (_jsx("optgroup", { label: "Other Available Units", children: others.map((u) => (_jsxs("option", { value: u.id, children: ["Unit ", u.unitNumber, " \u2014 ", u.type.replace(/_/g, " "), " \u2014 AED ", u.price.toLocaleString()] }, u.id))) }))] }));
                                        })()] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Notes (optional)" }), _jsx("textarea", { rows: 3, value: createDealForm.notes, onChange: (e) => setCreateDealForm((p) => ({ ...p, notes: e.target.value })), placeholder: "Any notes to carry into the deal\u2026", className: `${inputCls} resize-none` })] }), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { onClick: handleCreateDealSubmit, disabled: creatingDealQuick || loadingDealUnits, className: `${primaryBtn} flex-1`, children: creatingDealQuick ? "Creating Deal…" : "Confirm — Create Deal" }), _jsx("button", { type: "button", onClick: () => setShowCreateDealModal(false), className: cancelBtn, children: "Cancel" })] })] }) })), showDealForm && (_jsx(Modal, { title: "Create Reservation", onClose: () => setShowDealForm(false), children: _jsxs("form", { onSubmit: handleDealSubmit, className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Unit *" }), _jsxs("select", { required: true, value: dealForm.unitId, onChange: (e) => handleDealUnitChange(e.target.value), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 Select a unit \u2014" }), (() => {
                                            const interestIds = new Set(lead?.interests.map((i) => i.unitId) ?? []);
                                            const interested = availableUnits.filter((u) => interestIds.has(u.id));
                                            const others = availableUnits.filter((u) => !interestIds.has(u.id));
                                            return (_jsxs(_Fragment, { children: [interested.length > 0 && (_jsx("optgroup", { label: "Lead's Interested Units", children: interested.map((u) => (_jsxs("option", { value: u.id, children: [u.unitNumber, " \u00B7 ", u.type, " \u00B7 AED ", u.price.toLocaleString(), u.status === "ON_HOLD" ? " (On Hold)" : ""] }, u.id))) })), others.length > 0 && (_jsx("optgroup", { label: "Other Available Units", children: others.map((u) => (_jsxs("option", { value: u.id, children: [u.unitNumber, " \u00B7 ", u.type, " \u00B7 AED ", u.price.toLocaleString(), u.status === "ON_HOLD" ? " (On Hold)" : ""] }, u.id))) }))] }));
                                        })()] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Sale Price (AED) *" }), _jsx("input", { required: true, type: "number", min: 0, value: dealForm.salePrice, onChange: (e) => setDealForm((p) => ({ ...p, salePrice: e.target.value })), placeholder: "e.g. 1200000", className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Discount (AED)" }), _jsx("input", { type: "number", min: 0, value: dealForm.discount, onChange: (e) => setDealForm((p) => ({ ...p, discount: e.target.value })), className: inputCls })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Reservation Amount (AED) *" }), _jsx("input", { required: true, type: "number", min: 0, value: dealForm.reservationAmount, onChange: (e) => setDealForm((p) => ({ ...p, reservationAmount: e.target.value })), placeholder: "e.g. 50000", className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Payment Plan *" }), _jsxs("select", { required: true, value: dealForm.paymentPlanId, onChange: (e) => setDealForm((p) => ({ ...p, paymentPlanId: e.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 Select a plan \u2014" }), paymentPlans.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: ["Broker Company ", _jsx("span", { className: "text-slate-400 font-normal", children: "(optional)" })] }), _jsxs("select", { value: dealForm.brokerCompanyId, onChange: (e) => {
                                        setDealForm((p) => ({ ...p, brokerCompanyId: e.target.value, brokerAgentId: "" }));
                                        loadBrokerAgents(e.target.value);
                                    }, className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), brokerCompanies.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), brokerAgents.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Broker Agent" }), _jsxs("select", { value: dealForm.brokerAgentId, onChange: (e) => setDealForm((p) => ({ ...p, brokerAgentId: e.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), brokerAgents.map((a) => _jsx("option", { value: a.id, children: a.name }, a.id))] })] })), _jsxs("p", { className: "text-xs text-slate-400 pt-1", children: ["Lead: ", _jsxs("span", { className: "font-medium text-slate-600", children: [lead.firstName, " ", lead.lastName] })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx("button", { type: "submit", disabled: creatingDeal, className: primaryBtn, children: creatingDeal ? "Creating…" : "Create Reservation" }), _jsx("button", { type: "button", onClick: () => setShowDealForm(false), className: cancelBtn, children: "Cancel" })] })] }) })), showOfferModal && (_jsx(Modal, { title: revisingOffer ? "Revise Offer (New Version)" : "Generate Sales Offer", onClose: () => { setShowOfferModal(false); setRevisingOffer(null); }, children: _jsxs("form", { onSubmit: handleOfferSubmit, className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Unit" }), _jsx("p", { className: "text-sm font-semibold text-slate-800", children: lead.interests.find((i) => i.unitId === offerModalUnit)?.unit.unitNumber ?? offerModalUnit })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Offered Price (AED) *" }), _jsx("input", { required: true, type: "number", min: 0, step: "any", value: offerForm.offeredPrice, onChange: (e) => setOfferForm((p) => ({ ...p, offeredPrice: e.target.value })), placeholder: "e.g. 1200000", className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Discount (AED)" }), _jsx("input", { type: "number", min: 0, step: "any", value: offerForm.discountAmount, onChange: (e) => setOfferForm((p) => ({ ...p, discountAmount: e.target.value })), className: inputCls })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Payment Plan" }), _jsxs("select", { value: offerForm.paymentPlanId, onChange: (e) => setOfferForm((p) => ({ ...p, paymentPlanId: e.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), paymentPlans.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Offer Expiry" }), _jsx("input", { type: "date", value: offerForm.expiresAt, onChange: (e) => setOfferForm((p) => ({ ...p, expiresAt: e.target.value })), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "Notes" }), _jsx("textarea", { rows: 2, value: offerForm.notes, onChange: (e) => setOfferForm((p) => ({ ...p, notes: e.target.value })), placeholder: "Optional notes for this offer\u2026", className: `${inputCls} resize-none` })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx("button", { type: "submit", disabled: submittingOffer, className: primaryBtn, children: submittingOffer ? "Saving…" : revisingOffer ? "Create New Version" : "Generate Offer" }), _jsx("button", { type: "button", onClick: () => { setShowOfferModal(false); setRevisingOffer(null); }, className: cancelBtn, children: "Cancel" })] })] }) })), _jsx(ConfirmDialog, { open: confirmDelete, title: "Delete Lead", message: "Delete this lead? This cannot be undone.", confirmLabel: "Delete", variant: "danger", onConfirm: doDelete, onCancel: () => setConfirmDelete(false) })] }));
}
