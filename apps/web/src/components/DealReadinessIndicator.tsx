import { useState, useEffect } from "react";
import axios from "axios";

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
        allMet ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}>
        <span>{allMet ? "✓" : "!"}</span>
        <span>{allMet ? "Docs complete" : `${missing.length} doc${missing.length !== 1 ? "s" : ""} missing`}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${allMet ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">
          Document Requirements for <span className="font-bold">{targetStage.replace(/_/g, " ")}</span>
        </p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          allMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}>
          {allMet ? "All Complete" : `${missing.length} Missing`}
        </span>
      </div>
      <div className="space-y-1.5">
        {requirements.map((req) => (
          <div key={req.documentType} className="flex items-center gap-2">
            <span className={`text-sm ${req.uploaded ? "text-emerald-600" : "text-amber-600"}`}>
              {req.uploaded ? "✓" : "○"}
            </span>
            <span className={`text-sm ${req.uploaded ? "text-slate-600" : "text-slate-800 font-medium"}`}>
              {req.label || TYPE_LABELS[req.documentType] || req.documentType}
            </span>
            {!req.uploaded && req.required && (
              <span className="text-xs text-amber-600 font-medium">Required</span>
            )}
          </div>
        ))}
      </div>
      {!allMet && (
        <p className="text-xs text-amber-600 mt-3">
          Upload the missing documents before moving to this stage.
        </p>
      )}
    </div>
  );
}
