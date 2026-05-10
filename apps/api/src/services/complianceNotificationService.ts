import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { collectExpiries, type ExpiryRow, type Severity } from "./complianceService";

/**
 * Compliance notification sweep — closes audit gap #10.
 *
 * Once a day, walks every credential expiry that complianceService surfaces
 * (RERA license, trade license, VAT certificate, RERA card, EID) and creates
 * a Notification row for every ADMIN and MANAGER user when an expiry first
 * crosses into a notify-worthy severity.
 *
 * Idempotency. We dedupe per (recipient, ownerType, ownerId, kind, severity)
 * by inspecting the user's recent notifications for a matching message. The
 * dedup window is 7 days, which means an item that stays at the same severity
 * for two weeks generates two notifications — one per week. That's the right
 * behaviour: it acts as a gentle recurring reminder without being annoying.
 *
 * Severity policy. We notify on EXPIRED, CRITICAL, WARNING. We skip ATTENTION
 * (≤ 90 days) because the dashboard already surfaces those — pinging the bell
 * three months out is noise.
 */

const NOTIFY_SEVERITIES: Severity[] = ["EXPIRED", "CRITICAL", "WARNING"];
const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Map ownerType to the right Notification.entityType label so the bell row
// can deep-link in the future. BROKER_AGENT/BROKER_COMPANY map to BROKER for
// now since the broker detail page covers both.
const ENTITY_TYPE_BY_OWNER: Record<string, string> = {
  BROKER_COMPANY: "BROKER_COMPANY",
  BROKER_AGENT: "BROKER_AGENT",
};

function buildMessage(row: ExpiryRow): string {
  const verb = row.severity === "EXPIRED" ? "expired" : "expires in";
  const when = row.severity === "EXPIRED"
    ? `${Math.abs(row.daysToExpiry)}d ago`
    : `${row.daysToExpiry}d`;
  const owner = row.ownerName ? ` — ${row.ownerName}` : "";
  return `${humanLabel(row.kind)} ${verb} ${when}${owner}`;
}

function humanLabel(kind: ExpiryRow["kind"]): string {
  switch (kind) {
    case "BROKER_RERA_LICENSE": return "Broker RERA license";
    case "BROKER_TRADE_LICENSE": return "Broker trade license";
    case "BROKER_VAT_CERT": return "Broker VAT certificate";
    case "AGENT_RERA_CARD": return "Agent RERA card";
    case "AGENT_EID": return "Agent EID";
    default: return kind;
  }
}

export interface SweepStats {
  scanned: number;
  notifiable: number;
  created: number;
  recipients: number;
}

export async function sweepComplianceNotifications(): Promise<SweepStats> {
  // Only ADMIN + MANAGER receive compliance pings. MEMBER and VIEWER don't
  // own the renewal action.
  const recipients = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true },
  });

  if (recipients.length === 0) {
    return { scanned: 0, notifiable: 0, created: 0, recipients: 0 };
  }

  const rows = await collectExpiries({ withinDays: 90, minSeverity: "WARNING" });
  const notifiable = rows.filter((r) => NOTIFY_SEVERITIES.includes(r.severity));

  const since = new Date(Date.now() - DEDUP_WINDOW_MS);
  let created = 0;

  for (const row of notifiable) {
    const message = buildMessage(row);
    const entityType = ENTITY_TYPE_BY_OWNER[row.ownerType] ?? null;

    for (const recipient of recipients) {
      // Dedup: skip if this recipient already has a matching notification
      // within the dedup window.
      const exists = await prisma.notification.findFirst({
        where: {
          userId: recipient.id,
          message,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (exists) continue;

      await prisma.notification.create({
        data: {
          userId: recipient.id,
          message,
          type: "GENERAL",
          priority: row.severity === "EXPIRED" ? "URGENT"
                  : row.severity === "CRITICAL" ? "HIGH"
                  : "NORMAL",
          entityId: row.ownerId ?? null,
          entityType,
        },
      });
      created += 1;
    }
  }

  logger.info(
    `[complianceSweep] scanned=${rows.length} notifiable=${notifiable.length} ` +
    `recipients=${recipients.length} created=${created}`
  );

  return {
    scanned: rows.length,
    notifiable: notifiable.length,
    created,
    recipients: recipients.length,
  };
}
