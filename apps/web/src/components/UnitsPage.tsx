import UnitsTable from "./UnitsTable";
import { PageHeader } from "./ui/PageHeader";

export default function UnitsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Units" description="All inventory across all projects" />
      <div className="flex-1 overflow-hidden">
        <UnitsTable />
      </div>
    </div>
  );
}
