interface CommissionUnlockStatusProps {
  amount: number;
  status: string;
  spaSignedMet: boolean;
  oqoodRegisteredMet: boolean;
  bothMet: boolean;
}

export default function CommissionUnlockStatus({
  amount,
  status,
  spaSignedMet,
  oqoodRegisteredMet,
}: CommissionUnlockStatusProps) {
  const isUnlocked = status === "PENDING_APPROVAL" || status === "APPROVED" || status === "PAID";
  const isPaid = status === "PAID";
  const isApproved = status === "APPROVED";

  const statusColors = {
    NOT_DUE: "bg-gray-100 text-gray-800",
    PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    PAID: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-4 rounded-lg border border-purple-200 bg-purple-50">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">Broker Commission</p>
          <p className="text-2xl font-bold text-purple-700">
            {amount.toLocaleString()} AED
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            statusColors[status as keyof typeof statusColors] || statusColors.NOT_DUE
          }`}
        >
          {status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center ${
              spaSignedMet
                ? "bg-green-500 border-green-600"
                : "bg-gray-200 border-gray-300"
            }`}
          >
            {spaSignedMet && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="text-sm">
            SPA Signed <span className="text-gray-600">(Sales Purchase Agreement)</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center ${
              oqoodRegisteredMet
                ? "bg-green-500 border-green-600"
                : "bg-gray-200 border-gray-300"
            }`}
          >
            {oqoodRegisteredMet && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="text-sm">
            Oqood Registered <span className="text-gray-600">(UAE Property Registration)</span>
          </span>
        </div>
      </div>

      {!isUnlocked && (
        <div className="bg-white rounded p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Commission will unlock when both conditions are met:
          </p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>
              {spaSignedMet ? "✅" : "⭕"} SPA (Sales Purchase Agreement) is signed
            </li>
            <li>
              {oqoodRegisteredMet ? "✅" : "⭕"} Oqood is registered with UAE authorities
            </li>
          </ul>
        </div>
      )}

      {isUnlocked && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <p className="text-xs font-semibold text-green-800">
            ✅ All conditions met! Commission is unlocked.
          </p>
          {isApproved && (
            <p className="text-xs text-green-700 mt-1">
              Approved and ready for payment.
            </p>
          )}
          {isPaid && (
            <p className="text-xs text-green-700 mt-1">
              Commission has been paid.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
