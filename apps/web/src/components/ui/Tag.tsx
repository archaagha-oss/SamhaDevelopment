import { ReactNode } from "react";
import { X } from "lucide-react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "violet";

interface Props {
  children: ReactNode;
  tone?: Tone;
  /** Render an X button to remove the tag. */
  onRemove?: () => void;
  /** Render a leading icon. */
  icon?: ReactNode;
  className?: string;
}

const TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info:    "bg-blue-50 text-blue-700 ring-blue-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger:  "bg-red-50 text-red-700 ring-red-200",
  violet:  "bg-violet-50 text-violet-700 ring-violet-200",
};

/**
 * Small badge for free-form tags, source labels, count chips.
 * For entity statuses use <StatusPill> instead — it carries semantic meaning.
 */
export function Tag({ children, tone = "neutral", onRemove, icon, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-xs font-medium ${TONE[tone]} ${className}`}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tag"
          className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
