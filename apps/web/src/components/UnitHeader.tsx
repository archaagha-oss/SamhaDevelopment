import { PageHeader } from "./ui/PageHeader";
import { StatusPill, prettyStatus } from "./ui/StatusPill";

interface Props {
  unitNumber: string;
  status: string;
  projectId: string;
  projectName?: string;
}

export default function UnitHeader({ unitNumber, status, projectId, projectName }: Props) {
  return (
    <PageHeader
      crumbs={[
        { label: "Projects", to: "/projects" },
        { label: projectName || "Project", to: `/projects/${projectId}` },
        { label: `Unit ${unitNumber}` },
      ]}
      title={`Unit ${unitNumber}`}
      status={<StatusPill status={status}>{prettyStatus(status)}</StatusPill>}
    />
  );
}
