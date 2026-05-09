import { useParams, useNavigate } from "react-router-dom";
import JointOwnerEditor from "../components/JointOwnerEditor";
import { DetailPageLayout, DetailPageNotFound } from "../components/layout";

export default function DealJointOwnersPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  if (!dealId) {
    return (
      <DetailPageNotFound
        crumbs={[{ label: "Home", path: "/" }, { label: "Deals", path: "/deals" }]}
        title="Deal required"
        message="A deal ID is required to manage joint owners."
        backLabel="Back to deals"
        onBack={() => navigate("/deals")}
      />
    );
  }

  return (
    <DetailPageLayout
      crumbs={[
        { label: "Home", path: "/" },
        { label: "Deals", path: "/deals" },
        { label: "Deal", path: `/deals/${dealId}` },
        { label: "Joint owners" },
      ]}
      title="Joint owners"
      subtitle="Co-owners on this deal — names, ownership splits, signatory authority."
      main={<JointOwnerEditor dealId={dealId} />}
    />
  );
}
