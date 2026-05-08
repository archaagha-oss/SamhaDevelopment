import { useNavigate } from "react-router-dom";

export interface Crumb {
  label: string;
  path?: string;
}

interface Props {
  crumbs: Crumb[];
  /**
   * "dark" — for slate-950 backgrounds (default, matches page main outlet).
   * "light" — for white/slate-50 page headers.
   */
  variant?: "dark" | "light";
  className?: string;
}

const STYLES = {
  dark: {
    sep: "text-slate-500",
    link: "text-blue-400 hover:text-blue-300",
    current: "text-slate-200",
    other: "text-slate-400",
  },
  light: {
    sep: "text-slate-300",
    link: "text-blue-600 hover:text-blue-700",
    current: "text-slate-800",
    other: "text-slate-500",
  },
};

export default function Breadcrumbs({ crumbs, variant = "dark", className = "" }: Props) {
  const navigate = useNavigate();
  const s = STYLES[variant];

  return (
    <nav className={`flex items-center gap-1.5 text-xs sm:text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 flex-wrap min-w-0">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          // Hide intermediate crumbs on very small screens; show first + last when multiple.
          const isIntermediate = i > 0 && !isLast && crumbs.length > 2;
          return (
            <li key={i} className={`flex items-center gap-1.5 min-w-0 ${isIntermediate ? "hidden sm:flex" : ""}`}>
              {i > 0 && <span aria-hidden="true" className={s.sep}>/</span>}
              {!isLast && crumb.path ? (
                <button
                  onClick={() => navigate(crumb.path!)}
                  className={`${s.link} hover:underline transition-colors truncate max-w-[10rem]`}
                >
                  {crumb.label}
                </button>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={`${isLast ? s.current + " font-medium" : s.other} truncate max-w-[14rem]`}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
