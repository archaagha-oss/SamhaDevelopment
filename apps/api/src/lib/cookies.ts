import type { CookieOptions, Response } from "express";
import { env, isProd } from "./env";

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
    domain: env.COOKIE_DOMAIN,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, { ...sessionCookieOptions(), maxAge: 0 });
}
