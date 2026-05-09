import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  path?: string;
}

interface Props {
  crumbs: Crumb[];
}

/**
 * Standalone breadcrumbs (used by detail pages that don't yet adopt PageHeader).
 * New code should prefer <PageHeader crumbs={...} />.
 */
export default function Breadcrumbs({ crumbs }: Props) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-1 text-xs mb-3" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden />}
            {!isLast && crumb.path ? (
              <button
                onClick={() => navigate(crumb.path!)}
                className="text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={isLast ? "text-slate-700 font-medium" : "text-slate-500"}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
