import { useParams, Link } from "react-router-dom";
import LeadKycTab from "../components/LeadKycTab";

export default function LeadKycPage() {
  const { leadId } = useParams<{ leadId: string }>();
  if (!leadId) return <div className="p-6">Lead ID required.</div>;
  return (
    <div className="p-6 space-y-4">
      <Link to={`/leads/${leadId}`} className="text-sm text-blue-600 hover:underline">
        ← Back to lead
      </Link>
      <h1 className="text-2xl font-semibold">Lead KYC</h1>
      <LeadKycTab leadId={leadId} />
    </div>
  );
}
