import { useParams, useNavigate } from "react-router-dom";
import LeadKycTab from "../components/LeadKycTab";
import { DetailPageLayout, DetailPageNotFound } from "../components/layout";

export default function LeadKycPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();

  if (!leadId) {
    return (
      <DetailPageNotFound
        crumbs={[{ label: "Home", path: "/" }, { label: "Leads", path: "/leads" }]}
        title="Lead required"
        message="A lead ID is required to view KYC."
        backLabel="Back to leads"
        onBack={() => navigate("/leads")}
      />
    );
  }

  return (
    <DetailPageLayout
      crumbs={[
        { label: "Home", path: "/" },
        { label: "Leads", path: "/leads" },
        { label: "Lead", path: `/leads/${leadId}` },
        { label: "KYC" },
      ]}
      title="Lead KYC"
      subtitle="Verify identity, source of funds, and supporting documents before SPA generation."
      main={<LeadKycTab leadId={leadId} />}
    />
  );
}
