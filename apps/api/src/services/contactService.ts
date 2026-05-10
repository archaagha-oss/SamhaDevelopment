// ============================================================
// Contact sync service
// ============================================================
// Mirrors Lead, BrokerCompany, and BrokerAgent records into the
// Contact table so the Contacts module acts as a master directory
// of every name/number ever entered into the CRM. This lets future
// project launches reach the full contact pool without hunting
// through individual lead/broker tables.
//
// Idempotency: each mirrored Contact carries a sentinel marker in
// its `tags` field (e.g. `__src:lead:<leadId>`). Repeat calls
// update the existing row instead of duplicating.
//
// Failure policy: sync failures are logged but never thrown, so
// they cannot break the source create/update flow.
// ============================================================

import { ContactSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export type ContactSourceRef =
  | { kind: "lead"; id: string }
  | { kind: "broker-company"; id: string }
  | { kind: "broker-agent"; id: string };

export interface ContactSyncInput {
  ref: ContactSourceRef;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  nationality?: string | null;
  notes?: string | null;
}

export const SOURCE_TAG_PREFIX = "__src:";

export function buildSourceTag(ref: ContactSourceRef): string {
  return `${SOURCE_TAG_PREFIX}${ref.kind}:${ref.id}`;
}

function refToContactSource(kind: ContactSourceRef["kind"]): ContactSource {
  return kind === "lead" ? "LEAD" : "BROKER";
}

async function getDefaultOrgId(): Promise<string | null> {
  const org = await prisma.organization.findFirst({ select: { id: true } });
  return org?.id ?? null;
}

function mergeTags(existing: string | null | undefined, marker: string): string {
  const parts = (existing ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!parts.includes(marker)) parts.push(marker);
  return parts.join(",");
}

export async function syncContactFromSource(input: ContactSyncInput): Promise<void> {
  try {
    const orgId = await getDefaultOrgId();
    if (!orgId) {
      logger.warn("[contactService] no organization found, skipping sync", { ref: input.ref });
      return;
    }

    const tag = buildSourceTag(input.ref);
    const source = refToContactSource(input.ref.kind);

    const existing = await prisma.contact.findFirst({
      where: { organizationId: orgId, tags: { contains: tag } },
      select: { id: true, tags: true },
    });

    const fields = {
      firstName: (input.firstName ?? "").trim() || "Unknown",
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      company: input.company ?? null,
      jobTitle: input.jobTitle ?? null,
      nationality: input.nationality ?? null,
      notes: input.notes ?? null,
      source,
    };

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          ...fields,
          tags: mergeTags(existing.tags, tag),
        },
      });
    } else {
      await prisma.contact.create({
        data: {
          ...fields,
          organizationId: orgId,
          tags: tag,
        },
      });
    }
  } catch (err) {
    logger.error("[contactService] syncContactFromSource failed", {
      ref: input.ref,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
