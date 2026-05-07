import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "./env";

export interface SessionTokenPayload {
  sub: string;        // internal user id
  role: string;
  email: string;
}

const ALGO = "HS256";

export function signSessionToken(payload: SessionTokenPayload): string {
  const opts: SignOptions = {
    algorithm: ALGO,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGO] });
    if (typeof decoded === "string") return null;
    const { sub, role, email } = decoded as jwt.JwtPayload & Partial<SessionTokenPayload>;
    if (!sub || !role || !email) return null;
    return { sub, role, email };
  } catch {
    return null;
  }
}
