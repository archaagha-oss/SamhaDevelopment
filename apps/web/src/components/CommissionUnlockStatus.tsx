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
    NOT_DUE: "bg-muted text-foreground",
    PENDING_APPROVAL: "bg-warning-soft text-warning-soft-foreground",
    APPROVED: "bg-info-soft text-primary",
    PAID: "bg-success-soft text-success-soft-foreground",
    CANCELLED: "bg-destructive-soft text-destructive-soft-foreground",
  };

  return (
    <div className="p-4 rounded-lg border border-chart-7/30 bg-chart-7/10">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Broker Commission</p>
          <p className="text-2xl font-bold text-chart-7">
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
                ? "bg-success border-success/30"
                : "bg-neutral-200 border-border"
            }`}
          >
            {spaSignedMet && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="text-sm">
            SPA Signed <span className="text-muted-foreground">(Sales Purchase Agreement)</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center ${
              oqoodRegisteredMet
                ? "bg-success border-success/30"
                : "bg-neutral-200 border-border"
            }`}
          >
            {oqoodRegisteredMet && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="text-sm">
            Oqood Registered <span className="text-muted-foreground">(UAE Property Registration)</span>
          </span>
        </div>
      </div>

      {!isUnlocked && (
        <div className="bg-card rounded p-3 border border-border">
          <p className="text-xs font-semibold text-foreground mb-2">
            Commission will unlock when both conditions are met:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
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
        <div className="bg-success-soft border border-success/30 rounded p-3">
          <p className="text-xs font-semibold text-success-soft-foreground">
            ✅ All conditions met! Commission is unlocked.
          </p>
          {isApproved && (
            <p className="text-xs text-success mt-1">
              Approved and ready for payment.
            </p>
          )}
          {isPaid && (
            <p className="text-xs text-success mt-1">
              Commission has been paid.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
