import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tone =
  | "neutral"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "cyan"
  | "amber"
  | "orange"
  | "emerald"
  | "green"
  | "red";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  purple: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  green: "bg-green-500/15 text-green-700 dark:text-green-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const LEAD_STAGE_TONE: Record<string, Tone> = {
  NEW: "neutral",
  CONTACTED: "blue",
  QUALIFIED: "indigo",
  OFFER_SENT: "violet",
  SITE_VISIT: "cyan",
  NEGOTIATING: "amber",
  CLOSED_WON: "emerald",
  CLOSED_LOST: "red",
};

export const DEAL_STAGE_TONE: Record<string, Tone> = {
  RESERVATION_PENDING: "neutral",
  RESERVATION_CONFIRMED: "blue",
  SPA_PENDING: "violet",
  SPA_SENT: "violet",
  SPA_SIGNED: "purple",
  OQOOD_PENDING: "amber",
  OQOOD_REGISTERED: "emerald",
  INSTALLMENTS_ACTIVE: "cyan",
  HANDOVER_PENDING: "orange",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const LEAD_STAGE_HEX: Record<string, string> = {
  NEW: "#64748b",
  CONTACTED: "#3b82f6",
  QUALIFIED: "#6366f1",
  OFFER_SENT: "#8b5cf6",
  SITE_VISIT: "#06b6d4",
  NEGOTIATING: "#f59e0b",
  CLOSED_WON: "#10b981",
  CLOSED_LOST: "#ef4444",
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
