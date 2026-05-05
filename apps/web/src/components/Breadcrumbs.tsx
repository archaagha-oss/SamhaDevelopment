import { useNavigate } from "react-router-dom";

export interface Crumb {
  label: string;
  path?: string;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumbs({ crumbs }: Props) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-500">/</span>}
            {!isLast && crumb.path ? (
              <button
                onClick={() => navigate(crumb.path!)}
                className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={isLast ? "text-slate-200 font-medium" : "text-slate-400"}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
