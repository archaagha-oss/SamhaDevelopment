import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Semantic tones — map directly to design tokens (--stage-*).
// See: design-system/MASTER.md
export type StageTone =
  | "neutral"      // pre-action, idle (NEW, NOT_RELEASED)
  | "progress"     // early forward motion (CONTACTED) — brand-tinted
  | "active"       // mid-flow (QUALIFIED, SPA_SIGNED) — violet-tinted
  | "info"         // viewing/booked/installments — info-tinted
  | "attention"    // needs action (NEGOTIATING, OQOOD_PENDING) — warning
  | "success"      // done well (CLOSED_WON, COMPLETED)
  | "danger";      // failed (CLOSED_LOST, CANCELLED)

const TONE_CLASS: Record<StageTone, string> = {
  neutral:   "bg-stage-neutral text-stage-neutral-foreground",
  progress:  "bg-stage-progress text-stage-progress-foreground",
  active:    "bg-stage-active text-stage-active-foreground",
  info:      "bg-stage-info text-stage-info-foreground",
  attention: "bg-stage-attention text-stage-attention-foreground",
  success:   "bg-stage-success text-stage-success-foreground",
  danger:    "bg-stage-danger text-stage-danger-foreground",
};

export const LEAD_STAGE_TONE: Record<string, StageTone> = {
  NEW:           "neutral",
  CONTACTED:     "progress",
  QUALIFIED:     "active",
  VIEWING:       "info",
  PROPOSAL:      "active",
  NEGOTIATING:   "attention",
  CLOSED_WON:    "success",
  CLOSED_LOST:   "danger",
};

export const DEAL_STAGE_TONE: Record<string, StageTone> = {
  RESERVATION_PENDING:    "neutral",
  RESERVATION_CONFIRMED:  "progress",
  SPA_PENDING:            "attention",
  SPA_SENT:               "attention",
  SPA_SIGNED:             "active",
  OQOOD_PENDING:          "attention",
  OQOOD_REGISTERED:       "info",
  INSTALLMENTS_ACTIVE:    "info",
  HANDOVER_PENDING:       "success",
  COMPLETED:              "success",
  CANCELLED:              "danger",
};

// Chart-series color CSS variables for recharts/chart libs.
// Use as: `hsl(var(${LEAD_STAGE_CHART_VAR.NEW}))`
// Note: QUALIFIED/PROPOSAL follow the secondary brand axis (--brand2-500) so
// stage charts re-skin when the user picks a new secondary color.
export const LEAD_STAGE_CHART_VAR: Record<string, string> = {
  NEW:           "--neutral-400",
  CONTACTED:     "--chart-1",
  QUALIFIED:     "--brand2-500",
  VIEWING:       "--chart-5",
  PROPOSAL:      "--brand2-500",
  NEGOTIATING:   "--chart-3",
  CLOSED_WON:    "--success",
  CLOSED_LOST:   "--chart-6",
};

export interface StageBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  stage: string;
  kind?: "lead" | "deal";
  label?: string;
}

export function StageBadge({
  stage,
  kind = "lead",
  label,
  className,
  ...props
}: StageBadgeProps) {
  const map = kind === "deal" ? DEAL_STAGE_TONE : LEAD_STAGE_TONE;
  const tone = map[stage] ?? "neutral";
  const display = label ?? stage.replace(/_/g, " ");
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", TONE_CLASS[tone], className)}
      {...props}
    >
      {display}
    </Badge>
  );
}
