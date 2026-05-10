import { useState } from "react";
import axios from "axios";
import InlineDialog from "./InlineDialog";

export type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "ARCHIVED";

export interface ContractDoc {
  id: string;
  name: string;
  type: string;
  contractStatus: ContractStatus;
  deal: {
    dealNumber: string;
    lead: { firstName: string; lastName: string };
    unit: { unitNumber: string };
  };
}

interface Props {
  document: ContractDoc;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: { value: ContractStatus; label: string; description: string; color: string }[] = [
  { value: "DRAFT",    label: "Draft",    description: "Document is being prepared, not yet sent to client", color: "text-muted-foreground" },
  { value: "SENT",     label: "Sent",     description: "Document has been sent to the client for signing",   color: "text-primary"  },
  { value: "SIGNED",   label: "Signed",   description: "Document has been signed by all parties",            color: "text-success" },
  { value: "ARCHIVED", label: "Archived", description: "Document is archived (no longer active)",            color: "text-muted-foreground"  },
];

const TYPE_LABELS: Record<string, string> = {
  SPA: "Sales Purchase Agreement",
  OQOOD_CERTIFICATE: "RERA Registration (Oqood)",
  RESERVATION_FORM: "Reservation Form",
  PAYMENT_RECEIPT: "Payment receipt",
  PASSPORT: "Passport",
  EMIRATES_ID: "Emirates ID",
  VISA: "Visa",
  MORTGAGE: "Mortgage document",
  OTHER: "Other",
};

export default function ContractStatusModal({ document, onClose, onSuccess }: Props) {
  const [selected, setSelected] = useState<ContractStatus>(document.contractStatus);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function submit() {
    if (selected === document.contractStatus) { onClose(); return; }
    setError("");
    setLoading(true);
    try {
      await axios.patch(`/api/documents/${document.id}/status`, { contractStatus: selected });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <InlineDialog
      open
      onClose={onClose}
      ariaLabel="Update contract status"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      contentClassName="bg-card rounded-2xl shadow-xl w-full max-w-md focus:outline-none"
    >
      <div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-sm">Update contract status</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {document.deal.dealNumber} · {document.deal.lead.firstName} {document.deal.lead.lastName} · {document.deal.unit.unitNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-3 bg-muted/50 border-b border-border">
          <p className="text-xs text-muted-foreground">{TYPE_LABELS[document.type] || document.type}</p>
          <p className="text-sm font-medium text-foreground truncate">{document.name}</p>
        </div>

        <div className="px-6 py-5 space-y-2">
          {STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selected === opt.value
                  ? "border-primary/40 bg-info-soft"
                  : "border-border hover:border-border"
              }`}
            >
              <input
                type="radio"
                name="contractStatus"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className={`text-sm font-semibold ${opt.color}`}>{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}

          {error && (
            <div className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Update status"}
          </button>
        </div>
      </div>
    </InlineDialog>
  );
}
