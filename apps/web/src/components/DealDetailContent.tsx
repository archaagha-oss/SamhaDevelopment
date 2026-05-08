import React, { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";

interface DealDetailContentProps {
  dealId: string;
  deal: any;
  onPaymentPaid?: () => void;
  onTaskCompleted?: () => void;
}

type Tab = "payments" | "documents" | "tasks" | "history";

const PAY_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  PDC_PENDING: "bg-orange-100 text-orange-700",
  PDC_CLEARED: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function DealDetailContent({
  dealId,
  deal,
  onPaymentPaid,
  onTaskCompleted,
}: DealDetailContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("payments");
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [paidAmount, setPaidAmount] = useState<string>("0");

  const loadTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const res = await axios.get(`/api/deals/${dealId}/tasks`);
      setTasks(res.data.data || []);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setTasksLoading(false);
    }
  }, [dealId]);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await axios.get(`/api/deals/${dealId}/documents`);
      setDocuments(res.data.data || []);
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  }, [dealId]);

  React.useEffect(() => {
    if (activeTab === "tasks") {
      loadTasks();
    } else if (activeTab === "documents") {
      loadDocuments();
    }
  }, [activeTab, loadTasks, loadDocuments]);

  const handleMarkPaymentPaid = async (paymentId: string) => {
    try {
      await axios.patch(`/api/payments/${paymentId}/mark-paid`, {
        paidDate: new Date(paidDate).toISOString(),
        amount: parseFloat(paidAmount) || undefined,
      });
      toast.success("Payment marked as paid");
      setShowMarkPaidModal(null);
      onPaymentPaid?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to mark payment");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await axios.patch(`/api/deals/${dealId}/tasks/${taskId}/complete`);
      toast.success("Task completed");
      setTasks((prev: any[]) => prev.filter((t: any) => t.id !== taskId));
      onTaskCompleted?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to complete task");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-slate-200">
        <div className="flex gap-4 px-6 py-3 overflow-x-auto">
          {(["payments", "documents", "tasks", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium pb-3 border-b-2 transition whitespace-nowrap ${
                activeTab === tab
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              {tab === "payments"
                ? "Payments"
                : tab === "documents"
                  ? "Documents"
                  : tab === "tasks"
                    ? "Tasks"
                    : "History"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Payments Tab */}
        {activeTab === "payments" && deal?.payments && (
          <div className="divide-y divide-slate-200">
            {deal.payments.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                <p className="text-sm">No payments</p>
              </div>
            ) : (
              deal.payments.map((payment: any) => (
                <div key={payment.id} className="px-6 py-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-900">
                      {payment.milestoneLabel}
                    </h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        PAY_BADGE[payment.status] ||
                        "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      AED {payment.amount.toLocaleString()}
                    </span>
                    <span className="text-slate-500">{fmtDate(payment.dueDate)}</span>
                  </div>
                  {payment.status === "PENDING" ||
                  payment.status === "OVERDUE" ? (
                    <button
                      onClick={() => {
                        setShowMarkPaidModal(payment.id);
                        setPaidAmount(payment.amount.toString());
                      }}
                      className="mt-3 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition"
                    >
                      Mark as Paid
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="divide-y divide-slate-200">
            {documents.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                <p className="text-sm">No documents</p>
              </div>
            ) : (
              documents.map((doc: any) => (
                <div key={doc.id} className="px-6 py-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">
                        {doc.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {doc.type} · v{doc.version}
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="text-xs px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded transition"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="divide-y divide-slate-200">
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                <p className="text-sm">No tasks</p>
              </div>
            ) : (
              tasks.map((task: any) => (
                <div key={task.id} className="px-6 py-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-900">
                        {task.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {task.type} · Due {fmtDate(task.dueDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded transition"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && deal?.stageHistory && (
          <div className="divide-y divide-slate-200">
            {deal.stageHistory.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                <p className="text-sm">No history</p>
              </div>
            ) : (
              deal.stageHistory.map((entry: any) => (
                <div key={entry.id} className="px-6 py-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-900">
                      {entry.oldStage} → {entry.newStage}
                    </h4>
                    <span className="text-xs text-slate-500">
                      {fmtDate(entry.changedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Changed by: {entry.changedBy}
                  </p>
                  {entry.reason && (
                    <p className="text-xs text-slate-500 mt-1">{entry.reason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mark Payment Modal */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mark Payment as Paid</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (AED)
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowMarkPaidModal(null)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMarkPaymentPaid(showMarkPaidModal)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Mark as Paid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
