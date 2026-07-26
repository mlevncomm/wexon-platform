import dotenv from "dotenv";

dotenv.config({ path: ".env", quiet: true });

// Preserve caller-injected DB targets (e.g. isolated e2e Postgres) across .env.local.
const injectedDatabaseUrl = process.env.DATABASE_URL;
const injectedDirectUrl = process.env.DIRECT_URL;

dotenv.config({ path: ".env.local", override: true, quiet: true });

if (injectedDatabaseUrl) process.env.DATABASE_URL = injectedDatabaseUrl;
if (injectedDirectUrl) process.env.DIRECT_URL = injectedDirectUrl;

/**
 * Strip ephemeral public-QR security E2E pins so a polluted parent shell
 * (e.g. leftover WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT) cannot skew unit tests.
 * Tests that need these values set them inside withEnv and restore afterward.
 */
for (const key of [
  "WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT",
  "WEXON_PUBLIC_ASSIST_COOLDOWN_MS",
  "WEXON_PUBLIC_QR_MENU_LIMIT",
  "WEXON_PUBLIC_QR_ORDER_LIMIT",
  "WEXON_PUBLIC_QR_BILL_LIMIT",
  "WEXON_PUBLIC_QR_WAITER_LIMIT",
  "WEXON_PUBLIC_QR_PAYMENT_REQUEST_LIMIT",
  "WEXON_PUBLIC_QR_CHECKOUT_LIMIT",
  "WEXON_PUBLIC_QR_WINDOW_MS",
]) {
  delete process.env[key];
}
