import { useParams, Link } from "react-router-dom";
import JointOwnerEditor from "../components/JointOwnerEditor";

export default function DealJointOwnersPage() {
  const { dealId } = useParams<{ dealId: string }>();
  if (!dealId) return <div className="p-6">Deal ID required.</div>;
  return (
    <div className="p-6 space-y-4">
      <Link to={`/deals/${dealId}`} className="text-sm text-primary hover:underline">
        ← Back to deal
      </Link>
      <h1 className="text-2xl font-semibold">Joint Owners</h1>
      <JointOwnerEditor dealId={dealId} />
    </div>
  );
}
