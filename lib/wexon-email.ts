import { Resend } from "resend";
import { publicUrl, resolveWexonPublicOrigin } from "@/lib/wexon/urls";

export type EmailProviderName = "resend" | "fake";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stable idempotency key (e.g. invite id). */
  idempotencyKey: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; providerMessageId: string | null; provider: EmailProviderName }
  | { ok: false; errorCode: string; provider: EmailProviderName };

export type EmailTransportConfig =
  | { ready: true; provider: "resend"; from: string; replyTo: string | null; apiKeyPresent: true }
  | { ready: true; provider: "fake"; from: string; replyTo: string | null; apiKeyPresent: false }
  | { ready: false; provider: EmailProviderName; reasonCode: string };

const FAKE_OUTBOX: Array<{ to: string; subject: string; idempotencyKey: string; at: string }> = [];

/** Test/dev inspection of fake sends — never includes body/token. */
export function getFakeEmailOutbox() {
  return [...FAKE_OUTBOX];
}

export function clearFakeEmailOutbox() {
  FAKE_OUTBOX.length = 0;
}

export function sanitizeEmailErrorCode(raw: unknown): string {
  const text = String(raw ?? "EMAIL_SEND_FAILED")
    .replace(/re_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, 80)
    .trim();
  if (!text) return "EMAIL_SEND_FAILED";
  return text.replace(/\s+/g, "_").toUpperCase().slice(0, 64);
}

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip CR/LF to prevent header injection in subject/from fields. */
export function sanitizeEmailHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

function looksLikeEmailFrom(value: string): boolean {
  // Accept "Name <email@domain>" or bare email
  if (/^[^<>\r\n]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(value)) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHostedProductionEnv(env: NodeJS.ProcessEnv): boolean {
  // Hosted Vercel production only — local `next start` (NODE_ENV=production) must still allow fake.
  return env.VERCEL_ENV === "production";
}

/**
 * Resolve email transport.
 * Hosted production: only `resend` with explicit FROM + API key (no defaults, no fake).
 * Local/test/isolated E2E: `fake` allowed (or default when not explicitly resend).
 *
 * NOTE: invite create/resend/accept rate limits in lib/wexon-rate-limit.ts are
 * process-local (not distributed across Vercel isolates).
 */
export function resolveEmailTransportConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailTransportConfig {
  const providerRaw = (env.WEXON_EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const fromRaw = (env.WEXON_EMAIL_FROM ?? "").trim();
  const replyTo = (env.WEXON_EMAIL_REPLY_TO ?? "").trim() || null;
  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  const production = isHostedProductionEnv(env);

  if (production) {
    if (providerRaw === "fake") {
      return { ready: false, provider: "fake", reasonCode: "FAKE_FORBIDDEN_IN_PRODUCTION" };
    }
    if (providerRaw !== "resend") {
      return { ready: false, provider: "resend", reasonCode: "MISSING_OR_INVALID_EMAIL_PROVIDER" };
    }
    if (!apiKey) {
      return { ready: false, provider: "resend", reasonCode: "MISSING_RESEND_API_KEY" };
    }
    if (!fromRaw || !looksLikeEmailFrom(fromRaw)) {
      return { ready: false, provider: "resend", reasonCode: "MISSING_OR_INVALID_EMAIL_FROM" };
    }
    return {
      ready: true,
      provider: "resend",
      from: sanitizeEmailHeaderValue(fromRaw),
      replyTo: replyTo ? sanitizeEmailHeaderValue(replyTo) : null,
      apiKeyPresent: true,
    };
  }

  // Non-production: fake by default unless explicitly resend with key+from.
  if (providerRaw === "resend") {
    if (!apiKey) {
      return { ready: false, provider: "resend", reasonCode: "MISSING_RESEND_API_KEY" };
    }
    const from = fromRaw || "Wexon <davet@mail.wexon.dev>";
    if (!looksLikeEmailFrom(from)) {
      return { ready: false, provider: "resend", reasonCode: "MISSING_OR_INVALID_EMAIL_FROM" };
    }
    return {
      ready: true,
      provider: "resend",
      from: sanitizeEmailHeaderValue(from),
      replyTo: replyTo ? sanitizeEmailHeaderValue(replyTo) : null,
      apiKeyPresent: true,
    };
  }

  return {
    ready: true,
    provider: "fake",
    from: fromRaw || "Wexon <davet@mail.wexon.dev>",
    replyTo,
    apiKeyPresent: false,
  };
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = resolveEmailTransportConfig();
  if (!config.ready) {
    return { ok: false, errorCode: config.reasonCode, provider: config.provider };
  }

  const subject = sanitizeEmailHeaderValue(input.subject);
  if (!subject) {
    return { ok: false, errorCode: "INVALID_SUBJECT", provider: config.provider };
  }

  if (config.provider === "fake") {
    FAKE_OUTBOX.push({
      to: input.to,
      subject,
      idempotencyKey: input.idempotencyKey,
      at: new Date().toISOString(),
    });
    return {
      ok: true,
      providerMessageId: `fake_${input.idempotencyKey}`,
      provider: "fake",
    };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const result = await resend.emails.send(
      {
        from: config.from,
        to: input.to,
        subject,
        html: input.html,
        text: input.text,
        ...(config.replyTo || input.replyTo
          ? { replyTo: input.replyTo ?? config.replyTo ?? undefined }
          : {}),
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (result.error) {
      return {
        ok: false,
        errorCode: sanitizeEmailErrorCode(result.error.name || result.error.message),
        provider: "resend",
      };
    }

    return {
      ok: true,
      providerMessageId: result.data?.id ?? null,
      provider: "resend",
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: sanitizeEmailErrorCode(error instanceof Error ? error.message : "EMAIL_SEND_FAILED"),
      provider: "resend",
    };
  }
}

export function buildStaffInviteEmailContent(input: {
  organizationName: string;
  roleLabel: string;
  invitePathToken: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string; inviteUrl: string } {
  const origin =
    resolveWexonPublicOrigin() ||
    (process.env.E2E_BASE_URL ?? "").replace(/\/+$/, "") ||
    (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") ||
    "http://localhost:3000";
  const inviteUrl = `${origin.replace(/\/+$/, "")}/invite/${encodeURIComponent(input.invitePathToken)}`;
  const org = escapeEmailHtml(input.organizationName);
  const role = escapeEmailHtml(input.roleLabel);
  const expires = escapeEmailHtml(input.expiresAt.toLocaleString("tr-TR"));
  const safeUrl = escapeEmailHtml(inviteUrl);

  const subject = sanitizeEmailHeaderValue(`${input.organizationName} — Wexon personel daveti`);
  const text = [
    `${input.organizationName} organizasyonuna ${input.roleLabel} olarak davet edildiniz.`,
    "",
    `Daveti kabul etmek için: ${inviteUrl}`,
    `Son geçerlilik: ${input.expiresAt.toLocaleString("tr-TR")}`,
    "",
    "Bu bağlantı tek kullanımlıktır. Bağlantıyı kimseyle paylaşmayın.",
    "Wexon",
  ].join("\n");

  const html = `<!DOCTYPE html><html lang="tr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
<p><strong>${org}</strong> organizasyonuna <strong>${role}</strong> olarak davet edildiniz.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#059669;color:#fff;text-decoration:none;border-radius:999px;font-weight:700">Daveti kabul et</a></p>
<p style="font-size:13px;color:#64748b">Son geçerlilik: ${expires}</p>
<p style="font-size:13px;color:#64748b">Bu bağlantı tek kullanımlıktır. Bağlantıyı kimseyle paylaşmayın.</p>
<p style="font-size:12px;color:#94a3b8">Wexon</p>
</body></html>`;

  return { subject, html, text, inviteUrl };
}

export function buildStaffInvitePublicUrl(plaintextToken: string): string {
  return publicUrl(`/invite/${encodeURIComponent(plaintextToken.trim())}`);
}

export function maskEmailHint(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at < 1) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const localHint = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${localHint}@${domain}`;
}
