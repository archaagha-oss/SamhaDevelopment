// Unified status color system. All values use semantic design tokens —
// see design-system/MASTER.md and src/index.css for the token definitions.
//
// Tokens used:
//   stage-neutral    — pre-action, idle (NEW, PENDING, BLOCKED)
//   stage-progress   — early forward motion (CONTACTED, CONFIRMED) — brand-tinted
//   stage-active     — mid-flow (QUALIFIED, SPA_SIGNED) — violet-tinted
//   stage-info       — viewing/booked/installments — brand-info
//   stage-attention  — needs action (NEGOTIATING, OQOOD_PENDING, OVERDUE) — warning
//   stage-success    — done well (CLOSED_WON, COMPLETED, AVAILABLE, PAID)
//   stage-danger     — failed/cancelled/sold (CLOSED_LOST, CANCELLED, SOLD)

type StatusEntry = { bg: string; border: string; text: string; badge: string };

const stage = (key: "neutral" | "progress" | "active" | "info" | "attention" | "success" | "danger"): StatusEntry => ({
  bg: `bg-stage-${key}`,
  border: `border-stage-${key}-foreground/20`,
  text: `text-stage-${key}-foreground`,
  badge: `bg-stage-${key} text-stage-${key}-foreground`,
});

export const STATUS_COLORS = {
  // Deal stages
  RESERVATION_PENDING:   stage("neutral"),
  RESERVATION_CONFIRMED: stage("progress"),
  SPA_PENDING:           stage("attention"),
  SPA_SENT:              stage("attention"),
  SPA_SIGNED:            stage("active"),
  OQOOD_PENDING:         stage("attention"),
  OQOOD_REGISTERED:      stage("info"),
  INSTALLMENTS_ACTIVE:   stage("info"),
  HANDOVER_PENDING:      stage("success"),
  COMPLETED:             stage("success"),
  CANCELLED:             stage("danger"),

  // Payment statuses (flat string form — used as a single badge class)
  PAID:        "bg-stage-success text-stage-success-foreground",
  PENDING:     "bg-stage-attention text-stage-attention-foreground",
  PARTIAL:     "bg-stage-attention text-stage-attention-foreground",
  OVERDUE:     "bg-stage-danger text-stage-danger-foreground",
  PDC_PENDING: "bg-stage-attention text-stage-attention-foreground",
  PDC_CLEARED: "bg-stage-success text-stage-success-foreground",

  // Unit statuses
  AVAILABLE: "bg-stage-success text-stage-success-foreground",
  ON_HOLD:   "bg-stage-attention text-stage-attention-foreground",
  RESERVED:  "bg-stage-attention text-stage-attention-foreground",
  SOLD:      "bg-stage-danger text-stage-danger-foreground",

  // Alert levels
  SUCCESS: "text-stage-success-foreground bg-stage-success border-stage-success-foreground/20",
  WARNING: "text-stage-attention-foreground bg-stage-attention border-stage-attention-foreground/20",
  ERROR:   "text-stage-danger-foreground bg-stage-danger border-stage-danger-foreground/20",
  INFO:    "text-stage-info-foreground bg-stage-info border-stage-info-foreground/20",
} as const;

const FALLBACK_BADGE = "bg-stage-neutral text-stage-neutral-foreground";
const FALLBACK_ENTRY: StatusEntry = stage("neutral");

export const getStatusBadge = (status: string): string => {
  const entry = (STATUS_COLORS as Record<string, unknown>)[status];
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && "badge" in entry) return (entry as StatusEntry).badge;
  return FALLBACK_BADGE;
};

export const getStageColors = (stageKey: string): StatusEntry => {
  const entry = (STATUS_COLORS as Record<string, unknown>)[stageKey];
  if (entry && typeof entry === "object" && "bg" in entry) return entry as StatusEntry;
  return FALLBACK_ENTRY;
};
