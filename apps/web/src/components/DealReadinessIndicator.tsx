import { useState, useEffect } from "react";
import axios from "axios";
import { Check, AlertCircle, Circle } from "lucide-react";

interface Requirement {
  dealStage: string;
  documentType: string;
  label: string;
  required: boolean;
  uploaded: boolean;
}

interface Props {
  dealId: string;
  targetStage: string;
  compact?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  SPA: "SPA",
  OQOOD_CERTIFICATE: "Oqood",
  RESERVATION_FORM: "Reservation Form",
  PAYMENT_RECEIPT: "Payment Receipt",
  PASSPORT: "Passport",
  EMIRATES_ID: "Emirates ID",
  VISA: "Visa",
  OTHER: "Other",
};

export default function DealReadinessIndicator({ dealId, targetStage, compact = false }: Props) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [allMet, setAllMet]             = useState(false);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!dealId || !targetStage) return;
    setLoading(true);
    axios.get(`/api/deals/${dealId}/stage-requirements?targetStage=${targetStage}`)
      .then((r) => {
        setRequirements(r.data.requirements || []);
        setAllMet(r.data.allMet ?? true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId, targetStage]);

  if (loading) return null;
  if (requirements.length === 0) return null;

  const missing = requirements.filter((r) => r.required && !r.uploaded);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
        allMet ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
      }`}>
        {allMet ? <Check className="size-4" /> : <AlertCircle className="size-4" />}
        <span>{allMet ? "Docs complete" : `${missing.length} doc${missing.length !== 1 ? "s" : ""} missing`}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${allMet ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">
          Document Requirements for <span className="font-bold">{targetStage.replace(/_/g, " ")}</span>
        </p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          allMet ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
        }`}>
          {allMet ? "All Complete" : `${missing.length} Missing`}
        </span>
      </div>
      <div className="space-y-1.5">
        {requirements.map((req) => (
          <div key={req.documentType} className="flex items-center gap-2">
            <span className={`text-sm ${req.uploaded ? "text-success" : "text-warning"}`}>
              {req.uploaded ? <Check className="size-3.5 text-success" /> : <Circle className="size-3.5 text-muted-foreground" />}
            </span>
            <span className={`text-sm ${req.uploaded ? "text-muted-foreground" : "text-foreground font-medium"}`}>
              {req.label || TYPE_LABELS[req.documentType] || req.documentType}
            </span>
            {!req.uploaded && req.required && (
              <span className="text-xs text-warning font-medium">Required</span>
            )}
          </div>
        ))}
      </div>
      {!allMet && (
        <p className="text-xs text-warning mt-3">
          Upload the missing documents before moving to this stage.
        </p>
      )}
    </div>
  );
}
