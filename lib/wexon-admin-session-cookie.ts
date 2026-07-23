/**
 * Admin session cookie names shared by Edge proxy and Node auth.
 * Keep this module free of Node built-ins so `proxy.ts` can import it.
 *
 * Migration (PR2B):
 * - Active session: `wexon_admin_session_v3` (host-only on admin.wexon.dev)
 * - Prior: `wexon_admin_session_v2` (shared-password era) — never authorize
 * - Legacy: `wexon_admin_session` (pre-PR1 Domain=.wexon.dev) — never authorize
 * Proxy and assertAdminAccess accept only v3. Users must sign in once after deploy.
 */

/** Active admin session cookie (host-only). */
export const ADMIN_SESSION_COOKIE = "wexon_admin_session_v3";

/** Prior v2 session cookie — cleared on login/logout; never treat as authenticated. */
export const ADMIN_SESSION_COOKIE_V2 = "wexon_admin_session_v2";

/** Legacy admin session cookie name — never treat as authenticated. */
export const ADMIN_SESSION_COOKIE_LEGACY = "wexon_admin_session";
