import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
const STAGES = [
    "RESERVATION_PENDING",
    "RESERVATION_CONFIRMED",
    "SPA_PENDING",
    "SPA_SENT",
    "SPA_SIGNED",
    "OQOOD_PENDING",
    "OQOOD_REGISTERED",
    "INSTALLMENTS_ACTIVE",
    "HANDOVER_PENDING",
    "COMPLETED",
    "CANCELLED",
];
const STAGE_COLORS = {
    RESERVATION_PENDING: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
    RESERVATION_CONFIRMED: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
    SPA_PENDING: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
    SPA_SENT: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
    SPA_SIGNED: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
    OQOOD_PENDING: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
    OQOOD_REGISTERED: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
    INSTALLMENTS_ACTIVE: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
    HANDOVER_PENDING: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
    COMPLETED: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
    CANCELLED: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
};
export default function DealsKanban({ deals, isLoading, selectedStage, onViewDeal, onNavigate }) {
    const queryClient = useQueryClient();
    const [draggingDeal, setDraggingDeal] = useState(null);
    const [dragSource, setDragSource] = useState(null);
    const [updatingDeal, setUpdatingDeal] = useState(null);
    const [collapsedStages, setCollapsedStages] = useState(() => {
        const saved = localStorage.getItem("kanban-collapsed-stages");
        return saved ? JSON.parse(saved) : {};
    });
    const toggleStageCollapse = (stage) => {
        setCollapsedStages((prev) => {
            const updated = { ...prev, [stage]: !prev[stage] };
            localStorage.setItem("kanban-collapsed-stages", JSON.stringify(updated));
            return updated;
        });
    };
    // Determine which stages to display
    const visibleStages = useMemo(() => {
        return selectedStage ? [selectedStage] : STAGES;
    }, [selectedStage]);
    // Group deals by stage
    const dealsByStage = useMemo(() => {
        const grouped = {};
        STAGES.forEach((stage) => {
            grouped[stage] = deals.filter((d) => d.stage === stage);
        });
        return grouped;
    }, [deals]);
    // Calculate payment progress
    const paymentProgress = (deal) => {
        if (!deal.payments?.length)
            return 0;
        return Math.round((deal.payments.filter((p) => p.status === "PAID").length / deal.payments.length) * 100);
    };
    // Handle drag start
    const handleDragStart = (e, deal) => {
        setDraggingDeal(deal.id);
        setDragSource(deal.stage);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("dealId", deal.id);
    };
    // Handle drag over column
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };
    // Handle drop
    const handleDrop = async (e, targetStage) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData("dealId");
        if (!dealId || !dragSource || dragSource === targetStage) {
            setDraggingDeal(null);
            setDragSource(null);
            return;
        }
        setUpdatingDeal(dealId);
        try {
            await axios.patch(`/api/deals/${dealId}/stage`, { newStage: targetStage });
            toast.success(`Deal moved to ${targetStage.replace(/_/g, " ")}`);
            queryClient.invalidateQueries({ queryKey: ["deals"] });
        }
        catch (err) {
            const errorMsg = err.response?.data?.error || "Failed to move deal";
            toast.error(errorMsg);
        }
        finally {
            setUpdatingDeal(null);
            setDraggingDeal(null);
            setDragSource(null);
        }
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-96", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    const totalDeals = deals.length;
    return (_jsx("div", { className: "flex-1 overflow-x-auto scrollbar-thin", children: _jsx("div", { className: "inline-flex gap-4 p-4 h-full min-w-full", children: visibleStages.map((stage) => {
                const stageDealCount = dealsByStage[stage].length;
                const colors = STAGE_COLORS[stage];
                const isCollapsed = collapsedStages[stage] ?? false;
                return (_jsxs("div", { className: `flex-shrink-0 ${isCollapsed ? "w-20" : "w-80"} ${colors.bg} rounded-xl border-2 ${colors.border} flex flex-col transition-all duration-200`, children: [_jsxs("div", { className: "px-4 py-3 border-b border-slate-200 flex items-center justify-between", children: [_jsxs("div", { className: `flex-1 ${isCollapsed ? "hidden" : ""}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h3", { className: `font-semibold text-sm ${colors.text}`, children: stage.replace(/_/g, " ") }), _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`, children: stageDealCount })] }), _jsx("p", { className: "text-xs text-slate-400", children: stageDealCount === 0
                                                ? "No deals"
                                                : stageDealCount === 1
                                                    ? "1 deal"
                                                    : `${stageDealCount} deals` })] }), isCollapsed && (_jsx("div", { className: "flex flex-col items-center justify-center gap-1", children: _jsx("span", { className: `px-1.5 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text}`, children: stageDealCount }) })), _jsx("button", { onClick: () => toggleStageCollapse(stage), title: isCollapsed ? "Expand" : "Collapse", className: `text-xs font-semibold ${colors.text} hover:opacity-70 transition-opacity ml-2`, children: isCollapsed ? "▶" : "◀" })] }), !isCollapsed && (_jsx("div", { onDragOver: handleDragOver, onDrop: (e) => handleDrop(e, stage), className: "flex-1 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-thin", children: dealsByStage[stage].length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-20 text-slate-300 text-sm", children: "Drop deals here" })) : (dealsByStage[stage].map((deal) => {
                                const pct = paymentProgress(deal);
                                const isDragging = draggingDeal === deal.id;
                                return (_jsxs("div", { draggable: true, onDragStart: (e) => handleDragStart(e, deal), onClick: () => onViewDeal(deal.id), className: `p-3 bg-white rounded-lg border-2 border-slate-200 cursor-move transition-all ${isDragging ? "opacity-50 scale-95" : ""} ${updatingDeal === deal.id ? "opacity-75 pointer-events-none" : ""} hover:shadow-md hover:border-blue-400 group`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "font-mono text-xs text-slate-400 truncate", children: deal.dealNumber }), _jsxs("p", { className: "font-semibold text-sm text-slate-800 group-hover:text-blue-600 truncate", children: [deal.lead.firstName, " ", deal.lead.lastName] })] }), updatingDeal === deal.id && (_jsx("div", { className: "w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" }))] }), _jsxs("div", { className: "mb-2 pb-2 border-b border-slate-100", children: [_jsxs("p", { className: "text-xs font-medium text-slate-700", children: ["Unit: ", deal.unit.unitNumber] }), _jsx("p", { className: "text-xs text-slate-400", children: deal.unit.type })] }), _jsx("div", { className: "mb-2", children: _jsxs("p", { className: "text-xs text-slate-600", children: [_jsxs("span", { className: "font-semibold", children: ["AED ", deal.salePrice.toLocaleString()] }), deal.discount > 0 && (_jsxs("span", { className: "text-emerald-600 ml-1", children: ["-", deal.discount.toLocaleString()] }))] }) }), _jsx("div", { className: "mb-2", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1 bg-slate-200 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-blue-500 rounded-full transition-all", style: { width: `${pct}%` } }) }), _jsxs("span", { className: "text-xs font-semibold text-slate-600", children: [pct, "%"] })] }) }), deal.commission && (_jsxs("div", { className: "text-xs", children: [deal.commission.status === "PENDING_APPROVAL" && (_jsx("span", { className: "text-amber-600 font-semibold", children: "\u23F3 Approval Pending" })), deal.commission.status === "APPROVED" && (_jsx("span", { className: "text-blue-600 font-semibold", children: "\u2713 Approved" })), deal.commission.status === "PAID" && (_jsx("span", { className: "text-emerald-600 font-semibold", children: "\uD83D\uDCB0 Paid" })), deal.commission.status === "NOT_DUE" && (_jsx("span", { className: "text-slate-400", children: "\u2014 Not due" }))] }))] }, deal.id));
                            })) }))] }, stage));
            }) }) }));
}
