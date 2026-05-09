import { Check } from "lucide-react";

export interface Stage {
  key: string;
  label: string;
}

interface Props {
  stages: Stage[];
  current: string;
  /** Optional: stages that have been completed (defaults to all stages before current) */
  completedKeys?: string[];
  /** Optional: cancelled / failed marker — shows the current stage in red */
  failed?: boolean;
  className?: string;
}

/**
 * Horizontal pipeline stepper for deal lifecycle.
 *   Reserved → SPA Sent → SPA Signed → Oqood → Handover → Done
 *
 * Each stage is a circle + label; the current stage is filled blue,
 * past stages are filled emerald with a check, future stages are slate.
 */
export function StageStepper({ stages, current, completedKeys, failed, className = "" }: Props) {
  const currentIdx = Math.max(0, stages.findIndex((s) => s.key === current));
  const completed = new Set(completedKeys ?? stages.slice(0, currentIdx).map((s) => s.key));

  return (
    <ol className={`flex items-center w-full ${className}`} aria-label="Deal stage">
      {stages.map((s, i) => {
        const isCompleted = completed.has(s.key);
        const isCurrent   = s.key === current;
        const isLast      = i === stages.length - 1;

        const dotCls = isCurrent
          ? failed
            ? "bg-red-600 text-white ring-4 ring-red-100"
            : "bg-blue-600 text-white ring-4 ring-blue-100"
          : isCompleted
          ? "bg-emerald-600 text-white"
          : "bg-white text-slate-400 border-2 border-slate-200";

        const lineCls = isCompleted ? "bg-emerald-500" : "bg-slate-200";

        return (
          <li key={s.key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all ${dotCls}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-[11px] font-medium mt-1.5 text-center whitespace-nowrap ${
                  isCurrent ? "text-slate-900 font-semibold" : isCompleted ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {!isLast && <div className={`flex-1 h-0.5 mx-2 ${lineCls} -translate-y-2.5`} />}
          </li>
        );
      })}
    </ol>
  );
}
