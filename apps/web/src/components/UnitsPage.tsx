import UnitsTable from "./UnitsTable";

export default function UnitsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <h1 className="text-lg font-bold text-slate-900">Units</h1>
        <p className="text-slate-400 text-xs mt-0.5">All inventory across all projects</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <UnitsTable />
      </div>
    </div>
  );
}
