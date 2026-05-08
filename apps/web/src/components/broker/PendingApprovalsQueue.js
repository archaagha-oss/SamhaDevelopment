import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useApproveCommission, useRejectCommission } from "../../hooks/useBrokerDashboard";
import { toast } from "sonner";
/**
 * PendingApprovalsQueue - Queue of commissions waiting for approval
 * Shows: Deal, Broker, Amount, and approve/reject actions
 */
export default function PendingApprovalsQueue({ data, loading = false, onApprovalChange, onPageChange, pageCount = 1, currentPage = 0, }) {
    const [approvingId, setApprovingId] = useState(null);
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const { approve } = useApproveCommission();
    const { reject } = useRejectCommission();
    const handleApprove = async (commissionId) => {
        setApprovingId(commissionId);
        const success = await approve(commissionId);
        if (success) {
            onApprovalChange?.();
        }
        setApprovingId(null);
    };
    const handleReject = async (commissionId) => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason");
            return;
        }
        setRejectingId(commissionId);
        const success = await reject(commissionId, rejectReason);
        if (success) {
            setRejectReason("");
            onApprovalChange?.();
        }
        setRejectingId(null);
    };
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (data.length === 0) {
        return (_jsx("div", { className: "text-center py-8 text-slate-600", children: _jsx("p", { children: "\u2713 No pending approvals" }) }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "space-y-3", children: data.map((item) => (_jsxs("div", { className: "border border-orange-200 bg-orange-50 rounded-lg p-4 hover:shadow-md transition", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-slate-900", children: item.dealNumber }), _jsxs("p", { className: "text-sm text-slate-700", children: [item.brokerName, " - ", item.leadName] }), _jsx("p", { className: "text-xs text-slate-600 mt-1", children: item.reason })] }), _jsxs("span", { className: "font-bold text-slate-900 whitespace-nowrap ml-3", children: ["AED ", item.amount.toLocaleString()] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: approvingId !== null, onClick: () => handleApprove(item.id), className: "px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition disabled:opacity-50", children: approvingId === item.id ? "Approving..." : "✓ Approve" }), _jsx("button", { disabled: rejectingId !== null, onClick: () => setRejectingId(item.id === rejectingId ? null : item.id), className: "px-4 py-2 text-sm font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 transition disabled:opacity-50", children: rejectingId === item.id ? "Cancel" : "✗ Reject" })] }), rejectingId === item.id && (_jsxs("div", { className: "mt-3 p-3 bg-white rounded border border-slate-200 space-y-2", children: [_jsx("textarea", { value: rejectReason, onChange: (e) => setRejectReason(e.target.value), placeholder: "Reason for rejection...", className: "w-full px-3 py-2 border border-slate-300 rounded text-sm", rows: 2 }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleReject(item.id), className: "flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition", children: "Confirm Rejection" }), _jsx("button", { onClick: () => {
                                                setRejectingId(null);
                                                setRejectReason("");
                                            }, className: "flex-1 px-3 py-1 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition", children: "Cancel" })] })] }))] }, item.id))) }), pageCount > 1 && onPageChange && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-4 border-t border-slate-200", children: [_jsx("button", { disabled: currentPage === 0, onClick: () => onPageChange(currentPage - 1), className: "px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50", children: "\u2190 Previous" }), _jsxs("span", { className: "text-xs text-slate-600", children: ["Page ", currentPage + 1, " of ", pageCount] }), _jsx("button", { disabled: currentPage >= pageCount - 1, onClick: () => onPageChange(currentPage + 1), className: "px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50", children: "Next \u2192" })] }))] }));
}
