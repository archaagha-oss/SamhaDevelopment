import { useState } from "react";
import axios from "axios";

export type PaymentAction =
  | "MARK_PAID"
  | "MARK_PDC"
  | "PDC_CLEARED"
  | "PDC_BOUNCED"
  | "PARTIAL"
  | "ADJUST_DATE"
  | "ADJUST_AMOUNT"
  | "WAIVE";

export interface PaymentSummary {
  id: string;
  milestoneLabel: string;
  amount: number;
  dueDate: string;
  status: string;
  deal: {
    dealNumber: string;
    lead: { firstName: string; lastName: string };
    unit: { unitNumber: string };
  };
}

interface Props {
  payment: PaymentSummary;
  action: PaymentAction;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "PDC", "CREDIT_CARD"];

const ACTION_TITLES: Record<PaymentAction, string> = {
  MARK_PAID:    "Mark as Paid",
  MARK_PDC:     "Register PDC (Post-Dated Cheque)",
  PDC_CLEARED:  "Confirm PDC Cleared",
  PDC_BOUNCED:  "Mark PDC as Bounced",
  PARTIAL:      "Record Partial Payment",
  ADJUST_DATE:  "Adjust Due Date",
  ADJUST_AMOUNT:"Adjust Amount",
  WAIVE:        "Waive Payment",
};

export default function PaymentActionModal({ payment, action, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [paidDate, setPaidDate]         = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paidBy, setPaidBy]             = useState("");
  const [notes, setNotes]               = useState("");
  const [pdcNumber, setPdcNumber]       = useState("");
  const [pdcBank, setPdcBank]           = useState("");
  const [pdcDate, setPdcDate]           = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [newDueDate, setNewDueDate]     = useState(payment.dueDate.slice(0, 10));
  const [reason, setReason]             = useState("");
  const [newAmount, setNewAmount]       = useState(String(payment.amount));

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const base = `/api/payments/${payment.id}`;
      if (action === "MARK_PAID") {
        if (!paidBy.trim()) throw new Error("Paid By is required");
        await axios.patch(`${base}/paid`, { paidDate, paymentMethod, paidBy, notes: notes || undefined });
      } else if (action === "MARK_PDC") {
        await axios.patch(`${base}/pdc`, {
          pdcNumber: pdcNumber || undefined,
          pdcBank: pdcBank || undefined,
          pdcDate: pdcDate || undefined,
        });
      } else if (action === "PDC_CLEARED") {
        await axios.patch(`${base}/pdc-cleared`);
      } else if (action === "PDC_BOUNCED") {
        await axios.patch(`${base}/pdc-bounced`);
      } else if (action === "PARTIAL") {
        const amt = parseFloat(partialAmount);
        if (!amt || amt <= 0) throw new Error("Enter a valid amount");
        if (amt > payment.amount) throw new Error(`Amount cannot exceed AED ${payment.amount.toLocaleString()}`);
        await axios.post(`${base}/partial`, { amount: amt, paymentMethod, notes: notes || undefined });
      } else if (action === "ADJUST_DATE") {
        if (!reason.trim()) throw new Error("Reason is required");
        await axios.patch(`${base}/adjust-date`, { newDueDate, reason });
      } else if (action === "ADJUST_AMOUNT") {
        if (!reason.trim()) throw new Error("Reason is required");
        const amt = parseFloat(newAmount);
        if (!amt || amt <= 0) throw new Error("Enter a valid amount");
        await axios.patch(`${base}/adjust-amount`, { newAmount: amt, reason });
      } else if (action === "WAIVE") {
        if (!reason.trim()) throw new Error("Reason is required");
        await axios.patch(`${base}/waive`, { reason });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  const isConfirmOnly = action === "PDC_CLEARED" || action === "PDC_BOUNCED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">{ACTION_TITLES[action]}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {payment.deal.dealNumber} · {payment.deal.lead.firstName} {payment.deal.lead.lastName} · {payment.deal.unit.unitNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        {/* Payment info bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">{payment.milestoneLabel}</span>
          <span className="text-sm font-bold text-slate-800">AED {payment.amount.toLocaleString()}</span>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 space-y-4">
          {isConfirmOnly && (
            <p className="text-sm text-slate-600">
              {action === "PDC_CLEARED"
                ? "Confirm that the post-dated cheque has been cleared by the bank."
                : "Mark this PDC as bounced. The payment will return to an actionable state."}
            </p>
          )}

          {action === "MARK_PAID" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Paid Date *</label>
                <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Paid By *</label>
                <input type="text" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Name or reference"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {action === "MARK_PDC" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cheque Number</label>
                <input type="text" value={pdcNumber} onChange={(e) => setPdcNumber(e.target.value)} placeholder="e.g. 001234"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bank</label>
                <input type="text" value={pdcBank} onChange={(e) => setPdcBank(e.target.value)} placeholder="e.g. Emirates NBD"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cheque Date</label>
                <input type="date" value={pdcDate} onChange={(e) => setPdcDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {action === "PARTIAL" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount (AED) *</label>
                <input type="number" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder={`Max: ${payment.amount.toLocaleString()}`} min={1} max={payment.amount}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {action === "ADJUST_DATE" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Due Date *</label>
                <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Reason *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is the date being adjusted?"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {action === "ADJUST_AMOUNT" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Amount (AED) *</label>
                <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} min={1}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Reason *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is the amount being adjusted?"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {action === "WAIVE" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reason for waiving *</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Provide a clear reason for waiving this payment"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              action === "WAIVE" || action === "PDC_BOUNCED"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading ? "Processing..." : isConfirmOnly ? "Confirm" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
