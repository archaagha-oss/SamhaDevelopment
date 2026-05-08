import crypto from "crypto";
import { prisma } from "../lib/prisma";

export type ShareTokenStatus = "OK" | "NOT_FOUND" | "REVOKED" | "EXPIRED";

const TOKEN_HEX_LENGTH = 64; // crypto.randomBytes(32).toString("hex")

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function isWellFormedToken(token: string): boolean {
  return (
    typeof token === "string" &&
    token.length === TOKEN_HEX_LENGTH &&
    /^[0-9a-f]{64}$/.test(token)
  );
}

export async function resolveShareToken(token: string) {
  if (!isWellFormedToken(token)) {
    return { status: "NOT_FOUND" as const, row: null };
  }
  const row = await prisma.unitShareToken.findUnique({ where: { token } });
  if (!row) return { status: "NOT_FOUND" as const, row: null };
  if (row.revokedAt !== null) return { status: "REVOKED" as const, row };
  if (row.expiresAt !== null && row.expiresAt.getTime() < Date.now()) {
    return { status: "EXPIRED" as const, row };
  }
  return { status: "OK" as const, row };
}

export function recordShareTokenView(tokenRowId: string): void {
  // Fire-and-forget — never block the read path.
  prisma.unitShareToken
    .update({
      where: { id: tokenRowId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    })
    .catch(() => {
      /* swallow — view tracking is best-effort */
    });
}

export function buildPublicShareUrl(token: string): string {
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/share/u/${token}`;
}
