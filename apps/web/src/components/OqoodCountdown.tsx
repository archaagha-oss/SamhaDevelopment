interface OqoodCountdownProps {
  deadline: string;
  daysRemaining: number;
  status: "green" | "yellow" | "red" | "overdue";
  isOverdue: boolean;
}

export default function OqoodCountdown({
  deadline,
  daysRemaining,
  status,
  isOverdue,
}: OqoodCountdownProps) {
  const statusColors = {
    green: "bg-green-50 border-green-200 text-green-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    red: "bg-red-50 border-red-200 text-red-800",
    overdue: "bg-red-100 border-red-300 text-red-900",
  };

  const statusIcons = {
    green: "✅",
    yellow: "⚠️",
    red: "🔴",
    overdue: "❌",
  };

  const statusLabels = {
    green: "On Track",
    yellow: "Approaching",
    red: "Urgent",
    overdue: "Overdue",
  };

  return (
    <div className={`p-4 rounded border-2 ${statusColors[status]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{statusIcons[status]}</span>
        <div>
          <p className="text-sm font-semibold">Oqood Registration Deadline</p>
          <p className="text-xs opacity-75">UAE legal requirement</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-xs opacity-75">Deadline</p>
          <p className="font-bold text-lg">
            {new Date(deadline).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-75">Time Remaining</p>
          <p className={`font-bold text-lg ${isOverdue ? "text-red-600" : ""}`}>
            {isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium opacity-75">Status</span>
          <span className="px-2 py-1 bg-white rounded text-xs font-semibold">
            {statusLabels[status]}
          </span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              status === "green"
                ? "bg-green-500"
                : status === "yellow"
                  ? "bg-yellow-500"
                  : "bg-red-600"
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (daysRemaining / 90) * 100))}%`,
            }}
          ></div>
        </div>
      </div>

      {isOverdue && (
        <p className="text-xs mt-3 font-semibold">
          ⚠️ This deal requires immediate attention! Oqood registration deadline has passed.
        </p>
      )}
    </div>
  );
}
