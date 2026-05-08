/**
 * Foreign-exchange snapshot helper.
 *
 * Per the Phase-0 plan we do *not* integrate any live FX provider; finance
 * keys in the rate manually.  This service standardises the snapshot shape
 * so every Payment / Invoice / Receipt records the same triple:
 *   { currency, fxRate, fxSnapshotAt }
 *
 * `fxRate` is interpreted as: `1 unit of currency = fxRate AED`.
 */

export interface FXSnapshot {
  currency: string;
  fxRate: number | null;
  fxSnapshotAt: Date | null;
}

export function fxSnapshot(
  currency: string | null | undefined,
  fxRate: number | null | undefined,
): FXSnapshot {
  const ccy = (currency ?? "AED").toUpperCase();
  if (ccy === "AED") {
    return { currency: "AED", fxRate: 1, fxSnapshotAt: new Date() };
  }
  if (fxRate == null || !isFinite(fxRate) || fxRate <= 0) {
    throw new Error(
      `A positive fxRate is required when currency is ${ccy} (1 ${ccy} = X AED).`,
    );
  }
  return { currency: ccy, fxRate, fxSnapshotAt: new Date() };
}

export function toAed(amount: number, snap: FXSnapshot): number {
  if (snap.currency === "AED") return +amount.toFixed(2);
  return +(amount * (snap.fxRate ?? 1)).toFixed(2);
}
