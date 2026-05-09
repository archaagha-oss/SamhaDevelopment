import { useParams, Link } from "react-router-dom";
import LeadKycTab from "../components/LeadKycTab";

export default function LeadKycPage() {
  const { leadId } = useParams<{ leadId: string }>();
  if (!leadId) return <div className="p-6">Lead ID required.</div>;
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Link to={`/leads/${leadId}`} className="text-sm text-primary hover:underline">
        ← Back to lead
      </Link>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Lead KYC</h1>
      <LeadKycTab leadId={leadId} />
    </div>
  );
}
