/**
 * Local/CI Cloudflare Access test JWT cookie (never on Vercel production/preview).
 * proxy.ts copies this cookie onto Cf-Access-Jwt-Assertion for assertAdminAccess.
 */

export const CF_ACCESS_TEST_JWT_COOKIE = "wexon_cf_access_test_jwt";

const COOKIE_PATH = "/";

export type CfAccessTestJwtCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
};

export function cfAccessTestJwtCookieOptions(expires: Date): CfAccessTestJwtCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    expires,
  };
}

export function cfAccessTestJwtCookieClearOptions(): CfAccessTestJwtCookieOptions {
  return cfAccessTestJwtCookieOptions(new Date(0));
}
