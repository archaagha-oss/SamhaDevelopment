import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
const RESET_TTL_MIN = Number(process.env.PASSWORD_RESET_TTL_MIN || 60);

if (!ACCESS_SECRET) {
  // Fail fast on boot when running outside dev — checked again in authService
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
}

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, ACCESS_SECRET || "dev-only-insecure-secret", {
    expiresIn: ACCESS_TTL,
  } as jwt.SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, ACCESS_SECRET || "dev-only-insecure-secret");
  if (typeof decoded === "string") throw new Error("Invalid token payload");
  return { sub: String(decoded.sub), role: String((decoded as any).role) };
};

const sha256 = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const generateOpaqueToken = (): { raw: string; hash: string } => {
  const raw = crypto.randomBytes(48).toString("base64url");
  return { raw, hash: sha256(raw) };
};

export const hashOpaqueToken = (raw: string): string => sha256(raw);

export const refreshTokenExpiry = (): Date =>
  new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

export const refreshTokenMaxAgeMs = (): number =>
  REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

export const resetTokenExpiry = (): Date =>
  new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);
