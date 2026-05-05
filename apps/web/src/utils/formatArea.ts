const SQM_TO_SQFT = 10.764;

export function formatArea(sqm: number): string {
  const sqft = Math.round(sqm * SQM_TO_SQFT);
  return `${sqft.toLocaleString()} sqft / ${sqm} sqm`;
}

export function formatAreaShort(sqm: number): string {
  return `${Math.round(sqm * SQM_TO_SQFT).toLocaleString()} sqft`;
}

export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * SQM_TO_SQFT);
}
