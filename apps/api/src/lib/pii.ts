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
 * Look up the calling user's role. Cached on the request object so multiple
 * calls within one request hit the DB only once.
 */
export async function resolveCallerRole(req: Request): Promise<Role | null> {
  const cached = (req as any)._cachedRole;
  if (cached !== undefined) return cached;

  const userId = req.auth?.userId;
  if (!userId) {
    (req as any)._cachedRole = null;
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { clerkId: userId },
    select: { role: true },
  });
  const role = (user?.role as Role | undefined) ?? null;
  (req as any)._cachedRole = role;
  return role;
}
