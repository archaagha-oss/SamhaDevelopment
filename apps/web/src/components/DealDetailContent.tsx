import React, { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { formatDirham } from "@/lib/money";

interface DealDetailContentProps {
  dealId: string;
  deal: any;
  onPaymentPaid?: () => void;
  onTaskCompleted?: () => void;
}

type Tab = "payments" | "documents" | "tasks" | "history";

const PAY_BADGE: Record<string, string> = {
  PAID: "bg-success-soft text-success",
  PENDING: "bg-warning-soft text-warning",
  PARTIAL: "bg-warning-soft text-warning",
  OVERDUE: "bg-destructive-soft text-destructive",
  PDC_PENDING: "bg-warning-soft text-warning",
  PDC_CLEARED: "bg-chart-5/15 text-chart-5",
  CANCELLED: "bg-muted text-muted-foreground",
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
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex gap-4 px-6 py-3 overflow-x-auto">
          {(["payments", "documents", "tasks", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium pb-3 border-b-2 transition whitespace-nowrap ${
                activeTab === tab
                  ? "text-primary border-primary/40"
                  : "text-muted-foreground border-transparent hover:text-foreground"
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
          <div className="divide-y divide-border">
            {deal.payments.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">
                <p className="text-sm">No payments</p>
              </div>
            ) : (
              deal.payments.map((payment: any) => (
                <div key={payment.id} className="px-6 py-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {payment.milestoneLabel}
                    </h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        PAY_BADGE[payment.status] ||
                        "bg-muted text-foreground"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatDirham(payment.amount)}
                    </span>
                    <span className="text-muted-foreground">{fmtDate(payment.dueDate)}</span>
                  </div>
                  {payment.status === "PENDING" ||
                  payment.status === "OVERDUE" ? (
                    <button
                      onClick={() => {
                        setShowMarkPaidModal(payment.id);
                        setPaidAmount(payment.amount.toString());
                      }}
                      className="mt-3 text-xs px-3 py-1.5 bg-info-soft text-primary hover:bg-info-soft rounded transition"
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
          <div className="divide-y divide-border">
            {documents.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">
                <p className="text-sm">No documents</p>
              </div>
            ) : (
              documents.map((doc: any) => (
                <div key={doc.id} className="px-6 py-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">
                        {doc.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.type} · v{doc.version}
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="text-xs px-3 py-1.5 bg-muted/50 text-muted-foreground hover:bg-muted rounded transition"
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
          <div className="divide-y divide-border">
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">
                <p className="text-sm">No tasks</p>
              </div>
            ) : (
              tasks.map((task: any) => (
                <div key={task.id} className="px-6 py-4 hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-foreground">
                        {task.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.type} · Due {fmtDate(task.dueDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="text-xs px-3 py-1.5 bg-success-soft text-success hover:bg-success-soft rounded transition"
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
          <div className="divide-y divide-border">
            {deal.stageHistory.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">
                <p className="text-sm">No history</p>
              </div>
            ) : (
              deal.stageHistory.map((entry: any) => (
                <div key={entry.id} className="px-6 py-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {entry.oldStage} → {entry.newStage}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(entry.changedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Changed by: {entry.changedBy}
                  </p>
                  {entry.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{entry.reason}</p>
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
          <div className="bg-card rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mark Payment as Paid</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowMarkPaidModal(null)}
                  className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted/50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMarkPaymentPaid(showMarkPaidModal)}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
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
