import { NavLink } from "react-router-dom";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";

// Shared tab strip for unit sub-pages. Today there's only Snags but the
// component is built to scale — drop new entries into TABS below.

export type UnitSubTabKey = "unit" | "snags";

interface Props {
  unitId: string;
  /** Needed because the Unit tab routes back to /projects/:projectId/units/:unitId. */
  projectId: string;
  currentKey: UnitSubTabKey;
}

export default function UnitSubTabs({ unitId, projectId, currentKey }: Props) {
  const snagListEnabled = useFeatureFlag("snagList");

  const tabs: Array<{ key: UnitSubTabKey; label: string; to: string; show: boolean }> = [
    { key: "unit",  label: "Unit",  to: `/projects/${projectId}/units/${unitId}`, show: true },
    { key: "snags", label: "Snags", to: `/projects/${projectId}/units/${unitId}/snags`, show: snagListEnabled },
  ];

  const visible = tabs.filter((t) => t.show);
  if (visible.length <= 1) return null; // nothing to switch between

  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-border bg-card -mx-6 px-6"
      role="tablist"
      aria-label="Unit sub-pages"
    >
      {visible.map((t) => {
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
