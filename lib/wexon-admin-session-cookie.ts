/**
 * Admin session cookie names shared by Edge proxy and Node auth.
 * Keep this module free of Node built-ins so `proxy.ts` can import it.
 *
 * Migration (PR1 follow-up):
 * - Active session: `wexon_admin_session_v2` (host-only on admin.wexon.dev)
 * - Legacy: `wexon_admin_session` (pre-PR1 Domain=.wexon.dev / interim host-only)
 * Proxy and assertAdminAccess accept only v2. Users must sign in once after deploy.
 */

/** Active admin session cookie (host-only). */
export const ADMIN_SESSION_COOKIE = "wexon_admin_session_v2";

/** Legacy admin session cookie name — never treat as authenticated. */
export const ADMIN_SESSION_COOKIE_LEGACY = "wexon_admin_session";
