/**
 * Frontend auth glue between Clerk, axios, and the React Query cache.
 *
 *  - `clerkPublishableKey()` reads `VITE_CLERK_PUBLISHABLE_KEY`.
 *    If unset (or set to a transparent dev placeholder) we fall back to the
 *    long-standing dev mock — the API is happy because it pins the request
 *    user to `dev-user-1` whenever no Clerk session exists.
 *
 *  - `setSessionTokenGetter()` is called once by <AuthSync /> after Clerk
 *    boots. The axios request interceptor below pulls a fresh JWT for every
 *    outbound API call.
 */

let getToken: (() => Promise<string | null>) | null = null;

export function setSessionTokenGetter(fn: (() => Promise<string | null>) | null) {
  getToken = fn;
}

export async function fetchSessionToken(): Promise<string | null> {
  if (!getToken) return null;
  try {
    return await getToken();
  } catch {
    return null;
  }
}

export function clerkPublishableKey(): string | undefined {
  // import.meta.env is provided by Vite at build time. We avoid the
  // /// <reference types="vite/client" /> dependency so this file can be
  // tsc-checked without the Vite type augmentation.
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> });
  const raw = meta.env?.VITE_CLERK_PUBLISHABLE_KEY?.trim();
  if (!raw) return undefined;
  // Transparent dev placeholders — surface them as "no key" so we use the
  // mock-auth path. Stops anyone shipping prod with the example key.
  if (raw === "pk_test_dev_key" || raw === "your_clerk_publishable_key") return undefined;
  return raw;
}

export function isClerkEnabled(): boolean {
  return !!clerkPublishableKey();
}
