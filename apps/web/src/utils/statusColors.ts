// Status color system. All entries map to semantic design tokens.
// See: design-system/MASTER.md, src/index.css

type StatusEntry = { bg: string; text: string; badge: string; dot: string };

const stage = (
  key: "neutral" | "progress" | "active" | "info" | "attention" | "success" | "danger",
  dot: "neutral" | "brand" | "info" | "success" | "warning" | "destructive"
): StatusEntry => ({
  bg: `bg-stage-${key}`,
  text: `text-stage-${key}-foreground`,
  badge: `bg-stage-${key} text-stage-${key}-foreground`,
  dot:
    dot === "neutral"     ? "bg-neutral-400"
    : dot === "brand"     ? "bg-brand-500"
    : dot === "info"      ? "bg-info"
    : dot === "success"   ? "bg-success"
    : dot === "warning"   ? "bg-warning"
                          : "bg-destructive",
});

export const STATUS_COLORS: Record<string, StatusEntry> = {
  NOT_RELEASED: stage("neutral",    "neutral"),
  AVAILABLE:    stage("success",    "success"),
  ON_HOLD:      stage("attention",  "warning"),
  RESERVED:     stage("attention",  "warning"),
  BOOKED:       stage("info",       "info"),
  SOLD:         stage("danger",     "destructive"),
  HANDED_OVER:  stage("success",    "success"),
  BLOCKED:      stage("neutral",    "neutral"),
};

export const PAYMENT_STATUS_COLORS: Record<string, StatusEntry> = {
  PAID:    stage("success",   "success"),
  PARTIAL: stage("info",      "info"),
  PDC:     stage("active",    "brand"),
  PENDING: stage("neutral",   "neutral"),
  OVERDUE: stage("danger",    "destructive"),
  WAIVED:  stage("attention", "warning"),
};

export function getPaymentStatusColor(status: string): StatusEntry {
  return PAYMENT_STATUS_COLORS[status] || PAYMENT_STATUS_COLORS.PENDING;
}

export const BROKER_STATUS_COLORS: Record<string, { badge: string; dot: string }> = {
  ACTIVE:           { badge: "bg-stage-success text-stage-success-foreground",   dot: "bg-success" },
  INACTIVE:         { badge: "bg-stage-danger text-stage-danger-foreground",     dot: "bg-destructive" },
  PENDING_APPROVAL: { badge: "bg-stage-attention text-stage-attention-foreground", dot: "bg-warning" },
};

export function getBrokerStatusColor(status: string) {
  return BROKER_STATUS_COLORS[status] || BROKER_STATUS_COLORS.PENDING_APPROVAL;
}

export function getStatusColor(status: string): StatusEntry {
  return STATUS_COLORS[status] || STATUS_COLORS.NOT_RELEASED;
}
