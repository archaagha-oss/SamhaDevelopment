import { NavLink } from "react-router-dom";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";

// Shared tab strip for the project sub-pages (Phases, Type plans, Construction,
// Escrow). Rendered both on ProjectDetailPage (alongside its in-page tabs) and
// inside each sub-page so users can pivot between them without bouncing back
// to /projects/:projectId.
//
// On ProjectDetailPage `currentKey="overview"` is passed so the Overview tab
// (which routes back to the bare /projects/:projectId URL) lights up; on each
// sub-page the page passes its own key (e.g. "phases").

export type ProjectSubTabKey = "overview" | "phases" | "type-plans" | "construction" | "escrow";

interface Props {
  projectId: string;
  /** Which tab should render active. */
  currentKey: ProjectSubTabKey;
  /**
   * If true, "Overview" is rendered as a Link back to the project root. Set
   * `false` when ProjectDetailPage already has its own in-page Overview tab
   * (it does), so we don't render two Overview tabs.
   */
  showOverview?: boolean;
}

export default function ProjectSubTabs({ projectId, currentKey, showOverview = false }: Props) {
  const constructionEnabled = useFeatureFlag("constructionProgress");
  const escrowEnabled = useFeatureFlag("escrowModule");

  const tabs: Array<{ key: ProjectSubTabKey; label: string; to: string; show: boolean }> = [
    { key: "overview",     label: "Overview",     to: `/projects/${projectId}`,                show: showOverview },
    { key: "phases",       label: "Phases",       to: `/projects/${projectId}/phases`,         show: true },
    { key: "type-plans",   label: "Type plans",   to: `/projects/${projectId}/type-plans`,     show: true },
    { key: "construction", label: "Construction", to: `/projects/${projectId}/construction`,   show: constructionEnabled },
    { key: "escrow",       label: "Escrow",       to: `/projects/${projectId}/escrow`,         show: escrowEnabled },
  ];

  return (
    <div
      className="px-4 sm:px-6 flex gap-1 overflow-x-auto border-b border-border bg-card"
      role="tablist"
      aria-label="Project sub-pages"
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
