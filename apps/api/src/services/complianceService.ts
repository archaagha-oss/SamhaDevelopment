/**
 * UAE compliance / expiry radar.
 *
 * Aggregates every credential the developer needs to keep current:
 *   - BrokerCompany: RERA license, Trade license, VAT certificate
 *   - BrokerAgent:   RERA card, Emirates ID
 *   - Buyer-side:    Emirates ID copy on file (Document of type EMIRATES_ID
 *                    attached to the Lead — required for OQOOD registration)
 *
 * Each row is normalized to a common shape so the dashboard can sort by urgency
 * across categories. We bucket urgency:
 *
 *   EXPIRED      — past expiry; a deal that depends on it is operationally blocked
 *   CRITICAL     — ≤ 14 days
 *   WARNING      — ≤ 30 days
 *   ATTENTION    — ≤ 90 days
 *   OK           — > 90 days
 *
 * The per-deal blocker check returns just the issues that touch a specific deal
 * (its broker company, its broker agent, the lead's EID).
 */

import { prisma } from "../lib/prisma.js";

export type Severity = "EXPIRED" | "CRITICAL" | "WARNING" | "ATTENTION" | "OK";

export type CredentialKind =
  | "BROKER_RERA_LICENSE"
  | "BROKER_TRADE_LICENSE"
  | "BROKER_VAT_CERT"
  | "AGENT_RERA_CARD"
  | "AGENT_EID"
  | "BUYER_EID";

export interface ExpiryRow {
  kind: CredentialKind;
  category: "BROKER" | "AGENT" | "BUYER";
  severity: Severity;
  daysToExpiry: number;        // negative = already expired
  expiresAt: string;           // ISO

  // Identifying info for UI links
  ownerId: string;             // brokerCompanyId | brokerAgentId | leadId
  ownerType: "BROKER_COMPANY" | "BROKER_AGENT" | "LEAD";
  ownerName: string;
  ownerSubLabel?: string;      // e.g. "RERA #12345" or "EID 784-XXXX"
  documentNumber?: string | null;

  // For deeper drill-downs
  documentId?: string;         // present for buyer EID rows (links to Document)
  brokerCompanyId?: string;    // for AGENT_* rows so we can link to the parent
}

const DAY_MS = 24 * 60 * 60 * 1000;

function severityFor(daysToExpiry: number): Severity {
  if (daysToExpiry < 0)   return "EXPIRED";
  if (daysToExpiry <= 14) return "CRITICAL";
  if (daysToExpiry <= 30) return "WARNING";
  if (daysToExpiry <= 90) return "ATTENTION";
  return "OK";
}

function daysBetween(future: Date | string, now: Date): number {
  const ts = typeof future === "string" ? new Date(future).getTime() : future.getTime();
  return Math.floor((ts - now.getTime()) / DAY_MS);
}

export interface CollectExpiriesOptions {
  /** Cap horizon — anything beyond this many days isn't returned. Default 365. */
  withinDays?: number;
  /** Lowest severity to include. Default ATTENTION (so we surface 90-day warnings). */
  minSeverity?: Severity;
  /** Filter to a single category. */
  category?: ExpiryRow["category"];
}

const SEVERITY_RANK: Record<Severity, number> = {
  EXPIRED:   0,
  CRITICAL:  1,
  WARNING:   2,
  ATTENTION: 3,
  OK:        4,
};

/** Aggregate every credential expiring within the horizon, sorted by urgency. */
export async function collectExpiries(opts: CollectExpiriesOptions = {}): Promise<ExpiryRow[]> {
  const now = new Date();
  const horizonDays = opts.withinDays ?? 365;
  const horizon = new Date(now.getTime() + horizonDays * DAY_MS);
  const minRank = SEVERITY_RANK[opts.minSeverity ?? "ATTENTION"];
  const wantsCategory = opts.category;

  const rows: ExpiryRow[] = [];

  // ─── Broker company credentials ──────────────────────────────────────────
  if (!wantsCategory || wantsCategory === "BROKER") {
    const companies = await prisma.brokerCompany.findMany({
      where: {
        OR: [
          { reraLicenseExpiry:  { lte: horizon } },
          { tradeLicenseExpiry: { lte: horizon } },
          { vatCertificateExpiry: { lte: horizon } },
        ],
      },
      select: {
        id: true,
        name: true,
        reraLicenseNumber: true,
        reraLicenseExpiry: true,
        tradeLicenseNumber: true,
        tradeLicenseExpiry: true,
        vatCertificateNo: true,
        vatCertificateExpiry: true,
      },
    });
    for (const c of companies) {
      if (c.reraLicenseExpiry) {
        const days = daysBetween(c.reraLicenseExpiry, now);
        rows.push({
          kind: "BROKER_RERA_LICENSE",
          category: "BROKER",
          severity: severityFor(days),
          daysToExpiry: days,
          expiresAt: c.reraLicenseExpiry.toISOString(),
          ownerId: c.id,
          ownerType: "BROKER_COMPANY",
          ownerName: c.name,
          ownerSubLabel: c.reraLicenseNumber ? `RERA #${c.reraLicenseNumber}` : undefined,
          documentNumber: c.reraLicenseNumber ?? null,
        });
      }
      if (c.tradeLicenseExpiry) {
        const days = daysBetween(c.tradeLicenseExpiry, now);
        rows.push({
          kind: "BROKER_TRADE_LICENSE",
          category: "BROKER",
          severity: severityFor(days),
          daysToExpiry: days,
          expiresAt: c.tradeLicenseExpiry.toISOString(),
          ownerId: c.id,
          ownerType: "BROKER_COMPANY",
          ownerName: c.name,
          ownerSubLabel: c.tradeLicenseNumber ? `Trade #${c.tradeLicenseNumber}` : undefined,
          documentNumber: c.tradeLicenseNumber ?? null,
        });
      }
      if (c.vatCertificateExpiry) {
        const days = daysBetween(c.vatCertificateExpiry, now);
        rows.push({
          kind: "BROKER_VAT_CERT",
          category: "BROKER",
          severity: severityFor(days),
          daysToExpiry: days,
          expiresAt: c.vatCertificateExpiry.toISOString(),
          ownerId: c.id,
          ownerType: "BROKER_COMPANY",
          ownerName: c.name,
          ownerSubLabel: c.vatCertificateNo ? `VAT #${c.vatCertificateNo}` : undefined,
          documentNumber: c.vatCertificateNo ?? null,
        });
      }
    }
  }

  // ─── Broker agent credentials ────────────────────────────────────────────
  if (!wantsCategory || wantsCategory === "AGENT") {
    const agents = await prisma.brokerAgent.findMany({
      where: {
        OR: [
          { reraCardExpiry: { lte: horizon } },
          { eidExpiry:      { lte: horizon } },
        ],
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        reraCardNumber: true,
        reraCardExpiry: true,
        eidNo: true,
        eidExpiry: true,
      },
    });
    for (const a of agents) {
      if (a.reraCardExpiry) {
        const days = daysBetween(a.reraCardExpiry, now);
        rows.push({
          kind: "AGENT_RERA_CARD",
          category: "AGENT",
          severity: severityFor(days),
          daysToExpiry: days,
          expiresAt: a.reraCardExpiry.toISOString(),
          ownerId: a.id,
          ownerType: "BROKER_AGENT",
          ownerName: a.name,
          ownerSubLabel: a.reraCardNumber ? `RERA card #${a.reraCardNumber}` : undefined,
          documentNumber: a.reraCardNumber ?? null,
          brokerCompanyId: a.companyId,
        });
      }
      if (a.eidExpiry) {
        const days = daysBetween(a.eidExpiry, now);
        rows.push({
          kind: "AGENT_EID",
          category: "AGENT",
          severity: severityFor(days),
          daysToExpiry: days,
          expiresAt: a.eidExpiry.toISOString(),
          ownerId: a.id,
          ownerType: "BROKER_AGENT",
          ownerName: a.name,
          ownerSubLabel: a.eidNo ? `EID ${a.eidNo}` : undefined,
          documentNumber: a.eidNo ?? null,
          brokerCompanyId: a.companyId,
        });
      }
    }
  }

  // ─── Buyer Emirates ID copies on file (Documents of type EMIRATES_ID) ───
  if (!wantsCategory || wantsCategory === "BUYER") {
    const eidDocs = await prisma.document.findMany({
      where: {
        type: "EMIRATES_ID",
        softDeleted: false,
        expiryDate: { lte: horizon },
        leadId: { not: null },
      },
      select: {
        id: true,
        name: true,
        expiryDate: true,
        leadId: true,
        lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    for (const d of eidDocs) {
      if (!d.expiryDate || !d.lead) continue;
      const days = daysBetween(d.expiryDate, now);
      rows.push({
        kind: "BUYER_EID",
        category: "BUYER",
        severity: severityFor(days),
        daysToExpiry: days,
        expiresAt: d.expiryDate.toISOString(),
        ownerId: d.lead.id,
        ownerType: "LEAD",
        ownerName: `${d.lead.firstName} ${d.lead.lastName}`.trim(),
        ownerSubLabel: d.lead.phone,
        documentId: d.id,
      });
    }
  }

  // Filter by minimum severity
  const filtered = rows.filter((r) => SEVERITY_RANK[r.severity] <= minRank);

  // Sort: severity (worst first), then days-to-expiry (smallest first)
  filtered.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return a.daysToExpiry - b.daysToExpiry;
  });

  return filtered;
}

/**
 * For a given deal, return the compliance issues that affect *this deal*:
 *  - the broker company's license/trade/VAT expiry
 *  - the broker agent's RERA card + EID expiry
 *  - the buyer's EID document expiry
 *
 * Returns [] when nothing is at warning level or worse, so the UI can decide
 * whether to render a badge.
 */
export async function dealBlockers(dealId: string): Promise<ExpiryRow[]> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { brokerCompanyId: true, brokerAgentId: true, leadId: true },
  });
  if (!deal) return [];

  const all = await collectExpiries({ minSeverity: "WARNING" });

  return all.filter((row) => {
    if (row.category === "BROKER") return row.ownerId === deal.brokerCompanyId;
    if (row.category === "AGENT")  return row.ownerId === deal.brokerAgentId;
    if (row.category === "BUYER")  return row.ownerId === deal.leadId;
    return false;
  });
}

export function severityCounts(rows: ExpiryRow[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { EXPIRED: 0, CRITICAL: 0, WARNING: 0, ATTENTION: 0, OK: 0 };
  for (const r of rows) counts[r.severity]++;
  return counts;
}
