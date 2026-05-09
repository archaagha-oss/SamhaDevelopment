import UnitsTable from "./UnitsTable";
import { PageHeader } from "./layout";

export default function UnitsPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Units" }]}
        title="Units"
        subtitle="All inventory across all projects"
      />
      <div className="flex-1 overflow-hidden">
        <UnitsTable />
      </div>
    </div>
  );
}
