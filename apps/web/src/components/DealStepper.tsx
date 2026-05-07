interface Props {
  current: string;
  cancelled?: boolean;
}

const STEPS: { stage: string; label: string }[] = [
  { stage: "RESERVATION_PENDING",    label: "Reservation" },
  { stage: "RESERVATION_CONFIRMED",  label: "Reserved" },
  { stage: "SPA_PENDING",            label: "SPA Drafted" },
  { stage: "SPA_SENT",               label: "SPA Sent" },
  { stage: "SPA_SIGNED",             label: "SPA Signed" },
  { stage: "OQOOD_PENDING",          label: "Oqood Filed" },
  { stage: "OQOOD_REGISTERED",       label: "Oqood Registered" },
  { stage: "INSTALLMENTS_ACTIVE",    label: "Installments" },
  { stage: "HANDOVER_PENDING",       label: "Handover" },
  { stage: "COMPLETED",              label: "Completed" },
];

export default function DealStepper({ current, cancelled = false }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.stage === current);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal Progress</h3>
        <span className="text-[11px] text-slate-400">
          {cancelled ? "Cancelled" : `${Math.max(currentIndex, 0) + 1} of ${STEPS.length}`}
        </span>
      </div>

      <div className="space-y-0">
        {STEPS.map((s, i) => {
          const done = !cancelled && i < currentIndex;
          const active = !cancelled && i === currentIndex;

          const dot = done
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-blue-600 text-white ring-4 ring-blue-100"
              : "bg-slate-200 text-slate-400";

          const labelCls = done
            ? "text-slate-500"
            : active
              ? "text-slate-900 font-semibold"
              : "text-slate-400";

          return (
            <div key={s.stage} className="flex items-start gap-3 relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute left-3 top-6 w-0.5 h-[calc(100%-12px)] ${
                    !cancelled && i < currentIndex ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                />
              )}

              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${dot}`}>
                {done ? "✓" : i + 1}
              </div>

              <div className={`flex-1 pb-3 text-sm ${labelCls}`}>
                {s.label}
                {active && !cancelled && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-blue-500 font-bold">Current</span>
                )}
              </div>
            </div>
          );
        })}

        {cancelled && (
          <div className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            This deal was cancelled.
          </div>
        )}
      </div>
    </div>
  );
}
