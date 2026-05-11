import { NavLink } from "react-router-dom";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";

// Shared tab strip for the deal sub-pages (Joint owners, Handover). Rendered
// inside DealDetailPage and on each sub-page so users can pivot between them
// without bouncing back to /deals/:dealId.

export type DealSubTabKey = "deal" | "parties" | "handover";

interface Props {
  dealId: string;
  currentKey: DealSubTabKey;
}

export default function DealSubTabs({ dealId, currentKey }: Props) {
  const handoverEnabled = useFeatureFlag("handoverChecklist");

  const tabs: Array<{ key: DealSubTabKey; label: string; to: string; show: boolean }> = [
    { key: "deal",     label: "Deal",         to: `/deals/${dealId}`,          show: true },
    { key: "parties",  label: "Joint owners", to: `/deals/${dealId}/parties`,  show: true },
    { key: "handover", label: "Handover",     to: `/deals/${dealId}/handover`, show: handoverEnabled },
  ];

  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-border bg-card -mx-6 px-6"
      role="tablist"
      aria-label="Deal sub-pages"
    >
      {tabs.filter((t) => t.show).map((t) => {
        const active = t.key === currentKey;
        return (
          <NavLink
            key={t.key}
            to={t.to}
            end
            role="tab"
            aria-selected={active}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </NavLink>
        );
      })}
    </div>
  );
}
