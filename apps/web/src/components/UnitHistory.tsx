import { useUnitHistory } from "../hooks/useUnit";

interface Props {
  unitId: string;
  createdAt: string;
}

type TimelineEvent = {
  id: string;
  type: "created" | "status" | "price";
  date: string;
  oldStatus?: string;
  newStatus?: string;
  oldPrice?: number;
  newPrice?: number;
  reason?: string;
  changedBy?: string;
};

export default function UnitHistory({ unitId, createdAt }: Props) {
  const { data, isLoading, error } = useUnitHistory(unitId);

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-red-600 text-sm">Failed to load history</p>
      </div>
    );
  }

  const statusHistory = data?.data?.statusHistory || [];
  const priceHistory = data?.data?.priceHistory || [];

  // Combine into unified timeline
  const timeline: TimelineEvent[] = [
    // Created event (oldest)
    { id: "created", type: "created", date: createdAt },
    // Status changes
    ...statusHistory.map((h: any, idx: number) => ({
      id: `status-${idx}`,
      type: "status" as const,
      date: h.changedAt,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      reason: h.reason,
      changedBy: h.changedBy,
    })),
    // Price changes
    ...priceHistory.map((p: any, idx: number) => ({
      id: `price-${idx}`,
      type: "price" as const,
      date: p.changedAt,
      oldPrice: p.oldPrice,
      newPrice: p.newPrice,
      reason: p.reason,
      changedBy: p.changedBy,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isEmpty = statusHistory.length === 0 && priceHistory.length === 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Timeline</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <p className="text-slate-500 text-sm text-center py-6">No changes yet</p>
      ) : (
        <div className="space-y-0 relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

          {timeline.map((event) => {
            const isStatus = event.type === "status";
            const isPrice = event.type === "price";
            const isCreated = event.type === "created";

            const bgColor = isStatus ? "bg-blue-100" : isPrice ? "bg-emerald-100" : "bg-slate-100";
            const dotLabel = isStatus ? "📊" : isPrice ? "💰" : "✨";

            return (
              <div key={event.id} className="flex gap-4 pb-4 relative">
                {/* Dot */}
                <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-sm flex-shrink-0 relative z-10 border-4 border-white`}>
                  {dotLabel}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 pb-3">
                  {isCreated && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-700">Unit Created</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(event.date).toLocaleDateString("en-AE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}

                  {isStatus && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {event.oldStatus?.replace(/_/g, " ")}
                        </span>
                        <span className="text-slate-400 text-xs">→</span>
                        <span className="font-mono text-xs font-semibold text-blue-700">
                          {event.newStatus?.replace(/_/g, " ")}
                        </span>
                      </div>
                      {event.reason && (
                        <p className="text-[10px] text-blue-600 mb-1">{event.reason}</p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        {new Date(event.date).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })}
                        {event.changedBy && <span className="ml-1">· {event.changedBy}</span>}
                      </p>
                    </div>
                  )}

                  {isPrice && (
                    <div className="bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">
                          AED {event.oldPrice?.toLocaleString("en-AE")}
                        </span>
                        <span className="text-slate-400 text-xs">→</span>
                        <span className="text-xs font-bold text-emerald-700">
                          AED {event.newPrice?.toLocaleString("en-AE")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        {event.oldPrice && event.newPrice && (
                          <>
                            <span
                              className={`text-[10px] font-semibold ${
                                event.newPrice > event.oldPrice
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                            >
                              {event.newPrice > event.oldPrice ? "▲" : "▼"}
                              {Math.abs(
                                ((event.newPrice - event.oldPrice) / event.oldPrice) * 100
                              ).toFixed(1)}
                              %
                            </span>
                            <span className="text-[10px] text-emerald-600">
                              {event.newPrice > event.oldPrice ? "+" : ""}
                              AED {(event.newPrice - event.oldPrice).toLocaleString("en-AE")}
                            </span>
                          </>
                        )}
                      </div>
                      {event.reason && (
                        <p className="text-[10px] text-emerald-600 mb-1">{event.reason}</p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        {new Date(event.date).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })}
                        {event.changedBy && <span className="ml-1">· {event.changedBy}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
