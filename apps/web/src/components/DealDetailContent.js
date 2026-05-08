import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
const PAY_BADGE = {
    PAID: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-amber-100 text-amber-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    OVERDUE: "bg-red-100 text-red-700",
    PDC_PENDING: "bg-orange-100 text-orange-700",
    PDC_CLEARED: "bg-teal-100 text-teal-700",
    CANCELLED: "bg-slate-100 text-slate-500",
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});
export default function DealDetailContent({ dealId, deal, onPaymentPaid, onTaskCompleted, }) {
    const [activeTab, setActiveTab] = useState("payments");
    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(null);
    const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
    const [paidAmount, setPaidAmount] = useState("0");
    const loadTasks = useCallback(async () => {
        try {
            setTasksLoading(true);
            const res = await axios.get(`/api/deals/${dealId}/tasks`);
            setTasks(res.data.data || []);
        }
        catch (error) {
            console.error("Failed to load tasks:", error);
        }
        finally {
            setTasksLoading(false);
        }
    }, [dealId]);
    const loadDocuments = useCallback(async () => {
        try {
            const res = await axios.get(`/api/deals/${dealId}/documents`);
            setDocuments(res.data.data || []);
        }
        catch (error) {
            console.error("Failed to load documents:", error);
        }
    }, [dealId]);
    React.useEffect(() => {
        if (activeTab === "tasks") {
            loadTasks();
        }
        else if (activeTab === "documents") {
            loadDocuments();
        }
    }, [activeTab, loadTasks, loadDocuments]);
    const handleMarkPaymentPaid = async (paymentId) => {
        try {
            await axios.patch(`/api/payments/${paymentId}/mark-paid`, {
                paidDate: new Date(paidDate).toISOString(),
                amount: parseFloat(paidAmount) || undefined,
            });
            toast.success("Payment marked as paid");
            setShowMarkPaidModal(null);
            onPaymentPaid?.();
        }
        catch (error) {
            toast.error(error?.response?.data?.error || "Failed to mark payment");
        }
    };
    const handleCompleteTask = async (taskId) => {
        try {
            await axios.patch(`/api/deals/${dealId}/tasks/${taskId}/complete`);
            toast.success("Task completed");
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
            onTaskCompleted?.();
        }
        catch (error) {
            toast.error(error?.response?.data?.error || "Failed to complete task");
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full bg-white border-r border-slate-200", children: [_jsx("div", { className: "flex-shrink-0 border-b border-slate-200", children: _jsx("div", { className: "flex gap-4 px-6 py-3 overflow-x-auto", children: ["payments", "documents", "tasks", "history"].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `text-sm font-medium pb-3 border-b-2 transition whitespace-nowrap ${activeTab === tab
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-600 border-transparent hover:text-slate-900"}`, children: tab === "payments"
                            ? "Payments"
                            : tab === "documents"
                                ? "Documents"
                                : tab === "tasks"
                                    ? "Tasks"
                                    : "History" }, tab))) }) }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [activeTab === "payments" && deal?.payments && (_jsx("div", { className: "divide-y divide-slate-200", children: deal.payments.length === 0 ? (_jsx("div", { className: "px-6 py-8 text-center text-slate-500", children: _jsx("p", { className: "text-sm", children: "No payments" }) })) : (deal.payments.map((payment) => (_jsxs("div", { className: "px-6 py-4 hover:bg-slate-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: "text-sm font-medium text-slate-900", children: payment.milestoneLabel }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${PAY_BADGE[payment.status] ||
                                                "bg-slate-100 text-slate-700"}`, children: payment.status })] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-slate-600", children: ["AED ", payment.amount.toLocaleString()] }), _jsx("span", { className: "text-slate-500", children: fmtDate(payment.dueDate) })] }), payment.status === "PENDING" ||
                                    payment.status === "OVERDUE" ? (_jsx("button", { onClick: () => {
                                        setShowMarkPaidModal(payment.id);
                                        setPaidAmount(payment.amount.toString());
                                    }, className: "mt-3 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition", children: "Mark as Paid" })) : null] }, payment.id)))) })), activeTab === "documents" && (_jsx("div", { className: "divide-y divide-slate-200", children: documents.length === 0 ? (_jsx("div", { className: "px-6 py-8 text-center text-slate-500", children: _jsx("p", { className: "text-sm", children: "No documents" }) })) : (documents.map((doc) => (_jsx("div", { className: "px-6 py-4 hover:bg-slate-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-slate-900", children: doc.name }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [doc.type, " \u00B7 v", doc.version] })] }), _jsx("a", { href: `/api/documents/${doc.id}/download`, className: "text-xs px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded transition", children: "Download" })] }) }, doc.id)))) })), activeTab === "tasks" && (_jsx("div", { className: "divide-y divide-slate-200", children: tasksLoading ? (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : tasks.length === 0 ? (_jsx("div", { className: "px-6 py-8 text-center text-slate-500", children: _jsx("p", { className: "text-sm", children: "No tasks" }) })) : (tasks.map((task) => (_jsx("div", { className: "px-6 py-4 hover:bg-slate-50", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "text-sm font-medium text-slate-900", children: task.title }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [task.type, " \u00B7 Due ", fmtDate(task.dueDate)] })] }), _jsx("button", { onClick: () => handleCompleteTask(task.id), className: "text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded transition", children: "Complete" })] }) }, task.id)))) })), activeTab === "history" && deal?.stageHistory && (_jsx("div", { className: "divide-y divide-slate-200", children: deal.stageHistory.length === 0 ? (_jsx("div", { className: "px-6 py-8 text-center text-slate-500", children: _jsx("p", { className: "text-sm", children: "No history" }) })) : (deal.stageHistory.map((entry) => (_jsxs("div", { className: "px-6 py-4 hover:bg-slate-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("h4", { className: "text-sm font-medium text-slate-900", children: [entry.oldStage, " \u2192 ", entry.newStage] }), _jsx("span", { className: "text-xs text-slate-500", children: fmtDate(entry.changedAt) })] }), _jsxs("p", { className: "text-xs text-slate-600", children: ["Changed by: ", entry.changedBy] }), entry.reason && (_jsx("p", { className: "text-xs text-slate-500 mt-1", children: entry.reason }))] }, entry.id)))) }))] }), showMarkPaidModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-sm w-full mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Mark Payment as Paid" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "Amount (AED)" }), _jsx("input", { type: "number", value: paidAmount, onChange: (e) => setPaidAmount(e.target.value), className: "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "Date" }), _jsx("input", { type: "date", value: paidDate, onChange: (e) => setPaidDate(e.target.value), className: "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx("button", { onClick: () => setShowMarkPaidModal(null), className: "flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium", children: "Cancel" }), _jsx("button", { onClick: () => handleMarkPaymentPaid(showMarkPaidModal), className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium", children: "Mark as Paid" })] })] })] }) }))] }));
}
