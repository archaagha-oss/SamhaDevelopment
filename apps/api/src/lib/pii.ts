import type { Request } from "express";
import { prisma } from "./prisma";

/**
 * PII redaction for non-privileged roles.
 *
 * VIEWER and MEMBER roles see leads but don't need full government IDs or
 * source-of-funds details to do their job. We mask those fields in API
 * responses; ADMIN and MANAGER continue to see them in full.
 *
 * What's masked:
 *   - emiratesId          → "***-****-XXXX"
 *   - passportNumber      → "******XXXX"
 *   - sourceOfFunds       → "[redacted]"
 *   - phone               → "+971XX***XXXX" (last 4 visible)
 *   - email               → "u***@example.com" (first char + domain)
 *
 * Address, name, and free-text notes are NOT masked — they're operationally
 * necessary for sales agents.
 */

export type Role = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

const FULL_ACCESS_ROLES: Role[] = ["ADMIN", "MANAGER"];

function tail(value: string | null | undefined, n: number): string {
  if (!value) return "";
  return value.length <= n ? value : value.slice(-n);
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone ?? null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  const last4 = digits.slice(-4);
  return `+${digits.slice(0, 3)}** **** ${last4}`;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return email ?? null;
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

export function maskLeadPii<T extends Record<string, any>>(lead: T, role: Role | null | undefined): T {
  if (!lead) return lead;
  if (role && FULL_ACCESS_ROLES.includes(role)) return lead;

  const masked: Record<string, any> = { ...lead };
  if (masked.emiratesId) {
    masked.emiratesId = `***-****-${tail(String(masked.emiratesId), 4)}`;
  }
  if (masked.passportNumber) {
    masked.passportNumber = `******${tail(String(masked.passportNumber), 4)}`;
  }
  if (masked.sourceOfFunds) {
    masked.sourceOfFunds = "[redacted]";
  }
  if (masked.phone) {
    masked.phone = maskPhone(masked.phone);
  }
  if (masked.email) {
    masked.email = maskEmail(masked.email);
  }
  return masked as T;
}

export function maskLeadList<T extends Record<string, any>>(leads: T[], role: Role | null | undefined): T[] {
  if (!leads || leads.length === 0) return leads;
  if (role && FULL_ACCESS_ROLES.includes(role)) return leads;
  return leads.map((l) => maskLeadPii(l, role));
}

/**
 * Look up the calling user's role + DB id. Cached on the request object so
 * multiple calls within one request hit the DB only once. Returns the User.id
 * (NOT the clerkId) for use in scoped where-clauses.
 */
export interface ResolvedCaller {
  role: Role | null;
  userId: string | null;
}

export async function resolveCaller(req: Request): Promise<ResolvedCaller> {
  const cached = (req as any)._cachedCaller as ResolvedCaller | undefined;
  if (cached !== undefined) return cached;

  const clerkId = req.auth?.userId;
  if (!clerkId) {
    const empty: ResolvedCaller = { role: null, userId: null };
    (req as any)._cachedCaller = empty;
    return empty;
  }

  const user = await prisma.user.findFirst({
    where: { clerkId },
    select: { id: true, role: true },
  });
  const resolved: ResolvedCaller = {
    role: (user?.role as Role | undefined) ?? null,
    userId: user?.id ?? null,
  };
  (req as any)._cachedCaller = resolved;
  return resolved;
}

/** Backward-compat: just the role. */
export async function resolveCallerRole(req: Request): Promise<Role | null> {
  return (await resolveCaller(req)).role;
}

/**
 * Single-org data scoping (closes audit D.1.2 / D.1.3 follow-up).
 *
 * - ADMIN, MANAGER: see everything; returns {}.
 * - MEMBER, VIEWER: see only records where they are the assigned owner.
 *
 * Returns a Prisma where-fragment to merge into existing queries. The caller
 * decides which field to scope on (assignedAgentId for Lead, lead.assignedAgentId
 * for Deal, etc.) — this helper just produces the value side.
 *
 * Usage:
 *   const scope = await leadAccessFilter(req);
 *   const where = { ...existingWhere, ...scope };
 */
export async function leadAccessFilter(req: Request): Promise<Record<string, unknown>> {
  const { role, userId } = await resolveCaller(req);
  if (!role || !userId) return { id: "__none__" }; // unknown caller → see nothing
  if (FULL_ACCESS_ROLES.includes(role)) return {};
  return { assignedAgentId: userId };
}

/**
 * Same as leadAccessFilter but produces the relational filter for queries
 * over Deal (deals don't have assignedAgentId directly; they inherit from lead).
 */
export async function dealAccessFilter(req: Request): Promise<Record<string, unknown>> {
  const { role, userId } = await resolveCaller(req);
  if (!role || !userId) return { id: "__none__" };
  if (FULL_ACCESS_ROLES.includes(role)) return {};
  return { lead: { assignedAgentId: userId } };
}
