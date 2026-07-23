/**
 * Shared admin session cookie option builders (Edge-safe consumers import cookie names only).
 * Split so session-v3 encoding can reuse options without a circular import through auth.
 */

import { PRODUCTION_ROOT_HOST } from "@/lib/wexon-canonical-host";

export const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SESSION_COOKIE_PATH = "/";

export type AdminSessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
  domain?: string;
};

/** Host-only admin cookie options — never sets Domain (not shared across *.wexon.dev). */
export function adminSessionCookieOptions(expires: Date): AdminSessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: SESSION_COOKIE_PATH,
    expires,
  };
}

export function adminSessionCookieClearOptions(): AdminSessionCookieOptions {
  return adminSessionCookieOptions(new Date(0));
}

/** Legacy Domain=.wexon.dev clear options (legacy cookie name only). */
export function adminSessionCookieLegacyDomainClearOptions(): AdminSessionCookieOptions {
  return {
    ...adminSessionCookieClearOptions(),
    domain: `.${PRODUCTION_ROOT_HOST}`,
  };
}
