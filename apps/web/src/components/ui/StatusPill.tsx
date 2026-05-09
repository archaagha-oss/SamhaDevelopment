import { ReactNode } from "react";

/**
 * Semantic categories — every entity status maps to one of these.
 * This keeps colors consistent across Projects/Units/Deals/Leads/etc.
 */
export type Semantic =
  | "neutral"
  | "info"
  | "progress"
  | "warning"
  | "success"
  | "danger"
  | "muted";

const SEMANTIC: Record<Semantic, string> = {
  neutral:  "bg-slate-100 text-slate-700 ring-slate-200",
  info:     "bg-blue-50 text-blue-700 ring-blue-200",
  progress: "bg-violet-50 text-violet-700 ring-violet-200",
  warning:  "bg-amber-50 text-amber-700 ring-amber-200",
  success:  "bg-emerald-50 text-emerald-700 ring-emerald-200",
  danger:   "bg-red-50 text-red-700 ring-red-200",
  muted:    "bg-slate-50 text-slate-500 ring-slate-200",
};

/**
 * Single source of truth: every entity status → semantic.
 * When the schema gains a new status, add it here once.
 */
const STATUS_MAP: Record<string, Semantic> = {
  // Projects
  ACTIVE:           "success",
  ON_HOLD:          "warning",
  COMPLETED:        "info",
  CANCELLED:        "danger",
  ARCHIVED:         "muted",

  // Units
  AVAILABLE:        "success",
  NOT_RELEASED:     "muted",
  RESERVED:         "warning",
  BOOKED:           "progress",
  SOLD:             "info",
  HANDED_OVER:      "info",
  BLOCKED:          "danger",

  // Lead stages
  NEW:              "info",
  CONTACTED:        "info",
  QUALIFIED:        "progress",
  VIEWING:          "progress",
  NEGOTIATION:      "warning",
  WON:              "success",
  LOST:             "danger",

  // Deal stages
  RESERVATION_PENDING: "warning",
  SPA_SENT:            "info",
  SPA_PENDING:         "info",
  SPA_SIGNED:          "progress",
  OQOOD_PENDING:       "warning",
  OQOOD_REGISTERED:    "success",

  // Payments
  PENDING:          "warning",
  PARTIAL:          "warning",
  OVERDUE:          "danger",
  PAID:             "success",
  PDC_PENDING:      "info",
  PDC_CLEARED:      "success",
  PDC_BOUNCED:      "danger",
  WAIVED:           "muted",

  // Generic
  DRAFT:            "muted",
  SENT:             "info",
  ACCEPTED:         "success",
  EXPIRED:          "danger",
  REJECTED:         "danger",
  APPROVED:         "success",
  PENDING_APPROVAL: "warning",
};

export function semanticFor(status: string | null | undefined, fallback: Semantic = "neutral"): Semantic {
  if (!status) return fallback;
  return STATUS_MAP[status.toUpperCase()] ?? fallback;
}

interface Props {
  status?: string;
  semantic?: Semantic;
  size?: "xs" | "sm";
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function StatusPill({ status, semantic, size = "sm", children, icon, className = "" }: Props) {
  const sem = semantic ?? semanticFor(status);
  const sizeClasses = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-medium rounded-full ring-1",
        sizeClasses,
        SEMANTIC[sem],
        className,
      ].join(" ")}
    >
      {icon}
      {children ?? prettyStatus(status)}
    </span>
  );
}

export function prettyStatus(status?: string | null): string {
  if (!status) return "—";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
