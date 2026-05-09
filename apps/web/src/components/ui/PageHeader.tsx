import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  status?: ReactNode; // pill / badge next to title
  /** Render a custom subhead (e.g. tabs) directly under the description row. */
  subnav?: ReactNode;
}

/**
 * Standard page header used across every screen.
 * Layout:
 *   [breadcrumbs]
 *   [Title (xl)]              [actions →]
 *   [description]
 *   [subnav (tabs)]
 */
export function PageHeader({ title, description, crumbs, actions, status, subnav }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs mb-2">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden />}
                {!isLast && c.to ? (
                  <Link to={c.to} className="text-slate-500 hover:text-slate-700 transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-slate-700 font-medium" : "text-slate-500"}>
                    {c.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-title-lg text-slate-900 truncate">{title}</h1>
            {status}
          </div>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {subnav && <div className="mt-3">{subnav}</div>}
    </header>
  );
}
