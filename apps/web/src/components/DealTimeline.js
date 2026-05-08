import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const MILESTONE_ORDER = [
    { key: "reservation", label: "Reservation Confirmed", icon: "🔒", stages: ["RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT", "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
    { key: "spa", label: "SPA Signed", icon: "✍️", stages: ["SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
    { key: "oqood", label: "Oqood Registered", icon: "📋", stages: ["OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED"] },
    { key: "handover", label: "Handover", icon: "🎉", stages: ["HANDOVER_PENDING", "COMPLETED"] },
    { key: "completed", label: "Deal Completed", icon: "✅", stages: ["COMPLETED"] },
];
export default function DealTimeline({ stage, reservationDate, spaSignedDate, oqoodRegisteredDate, oqoodDeadline, completedDate }) {
    const getStatus = (milestone) => {
        if (milestone.stages.includes(stage))
            return "active";
        if (stage === "CANCELLED")
            return "cancelled";
        const currentIdx = MILESTONE_ORDER.findIndex((m) => m.stages.includes(stage));
        const milestoneIdx = MILESTONE_ORDER.indexOf(milestone);
        return milestoneIdx < currentIdx ? "completed" : "pending";
    };
    const getDate = (key) => {
        switch (key) {
            case "reservation": return reservationDate;
            case "spa": return spaSignedDate;
            case "oqood": return oqoodRegisteredDate;
            case "completed": return completedDate;
            default: return undefined;
        }
    };
    const formatDate = (dateStr) => {
        if (!dateStr)
            return "—";
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
    };
    const getDaysRemaining = () => {
        if (!oqoodDeadline)
            return null;
        const deadline = new Date(oqoodDeadline);
        const today = new Date();
        const days = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (days < 0)
            return null;
        return days;
    };
    const daysRemaining = getDaysRemaining();
    const isOqoodUrgent = daysRemaining !== null && daysRemaining <= 30;
    return (_jsxs("div", { className: "px-5 py-6 space-y-6", children: [_jsx("div", { className: "space-y-4", children: MILESTONE_ORDER.map((milestone, idx) => {
                    const status = getStatus(milestone);
                    const dateStr = getDate(milestone.key);
                    const isCompleted = status === "completed";
                    const isActive = status === "active";
                    const isCancelled = status === "cancelled";
                    let dotColor = "bg-slate-300";
                    let lineColor = "bg-slate-200";
                    let labelColor = "text-slate-500";
                    if (isCompleted) {
                        dotColor = "bg-emerald-500";
                        lineColor = "bg-emerald-200";
                        labelColor = "text-slate-700";
                    }
                    else if (isActive) {
                        dotColor = "bg-blue-500 animate-pulse";
                        lineColor = "bg-blue-200";
                        labelColor = "text-slate-800 font-semibold";
                    }
                    else if (isCancelled) {
                        dotColor = "bg-red-300";
                        lineColor = "bg-red-200";
                        labelColor = "text-red-600";
                    }
                    return (_jsxs("div", { className: "flex gap-4", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("div", { className: `w-4 h-4 rounded-full ${dotColor} shadow-sm transition-all` }), idx < MILESTONE_ORDER.length - 1 && (_jsx("div", { className: `w-1 h-12 ${lineColor} transition-colors` }))] }), _jsxs("div", { className: "flex-1 pb-6", children: [_jsx("p", { className: `text-sm ${labelColor} transition-colors`, children: milestone.label }), dateStr && dateStr !== "—" && (_jsx("p", { className: "text-xs text-slate-500 mt-1", children: formatDate(dateStr) })), milestone.key === "oqood" && daysRemaining !== null && (_jsxs("p", { className: `text-xs mt-1 font-medium ${isOqoodUrgent ? "text-red-600" : "text-slate-500"}`, children: [daysRemaining, " days remaining"] }))] })] }, milestone.key));
                }) }), stage === "CANCELLED" && (_jsx("div", { className: "mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg", children: _jsx("p", { className: "text-sm text-red-700 font-medium", children: "Deal has been cancelled" }) })), isOqoodUrgent && stage !== "COMPLETED" && stage !== "CANCELLED" && (_jsx("div", { className: "mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg", children: _jsxs("p", { className: "text-sm text-amber-800 font-medium", children: ["\u23F0 ", daysRemaining, " days until Oqood registration deadline"] }) }))] }));
}
