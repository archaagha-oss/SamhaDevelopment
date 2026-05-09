import { useEffect, useState } from "react";
import { toast } from "sonner";
import { refundsApi } from "../services/phase2ApiService";

interface Refund {
  id: string;
  dealId: string;
  amount: number;
  currency: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED" | "CANCELLED";
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  processedAt?: string;
  processedReference?: string;
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-warning-soft text-warning-soft-foreground",
  APPROVED: "bg-info-soft text-primary",
  PROCESSED: "bg-success-soft text-success-soft-foreground",
  REJECTED: "bg-destructive-soft text-destructive-soft-foreground",
  CANCELLED: "bg-neutral-200 text-foreground",
};

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await refundsApi.listOpen();
      setRefunds(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const action = async (
    id: string,
    newStatus: "APPROVED" | "REJECTED" | "PROCESSED" | "CANCELLED",
  ) => {
    try {
      let extras: Record<string, string> = {};
      if (newStatus === "REJECTED") {
        const reason = prompt("Rejection reason:");
        if (!reason) return;
        extras.rejectedReason = reason;
      }
      if (newStatus === "PROCESSED") {
        const ref = prompt("Bank / payment reference:");
        if (!ref) return;
        extras.processedReference = ref;
      }
      await refundsApi.transition(id, { newStatus, ...extras });
      toast.success(`Refund ${newStatus}`);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Refund Requests</h1>
      <p className="text-sm text-muted-foreground">
        Open and approved refunds awaiting action. Processed / cancelled refunds drop off this list.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : refunds.length === 0 ? (
        <p className="text-muted-foreground">No open refund requests.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b">
              <th className="py-2">Deal</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Requested by</th>
              <th>When</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 font-mono text-xs">{r.dealId.slice(0, 10)}…</td>
                <td>
                  {r.currency} {r.amount.toLocaleString()}
                </td>
                <td className="max-w-xs truncate">{r.reason}</td>
                <td>{r.requestedBy}</td>
                <td>{new Date(r.requestedAt).toLocaleDateString()}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="space-x-2">
                  {r.status === "REQUESTED" && (
                    <>
                      <button className="text-primary text-xs hover:underline" onClick={() => action(r.id, "APPROVED")}>
                        Approve
                      </button>
                      <button className="text-destructive text-xs hover:underline" onClick={() => action(r.id, "REJECTED")}>
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "APPROVED" && (
                    <button className="text-success text-xs hover:underline" onClick={() => action(r.id, "PROCESSED")}>
                      Mark Processed
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
