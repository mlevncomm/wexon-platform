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

export function resolveEmailTransportConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailTransportConfig {
  const providerRaw = (env.WEXON_EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const from = (env.WEXON_EMAIL_FROM ?? "").trim() || "Wexon <davet@mail.wexon.dev>";
  const replyTo = (env.WEXON_EMAIL_REPLY_TO ?? "").trim() || null;
  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  const production = env.VERCEL_ENV === "production" || env.NODE_ENV === "production";

  if (providerRaw === "fake" || (!production && providerRaw !== "resend")) {
    return { ready: true, provider: "fake", from, replyTo, apiKeyPresent: false };
  }

  if (providerRaw && providerRaw !== "resend") {
    return { ready: false, provider: "resend", reasonCode: "UNSUPPORTED_EMAIL_PROVIDER" };
  }

  if (!apiKey) {
    return { ready: false, provider: "resend", reasonCode: "MISSING_RESEND_API_KEY" };
  }
  if (!from.includes("@")) {
    return { ready: false, provider: "resend", reasonCode: "MISSING_EMAIL_FROM" };
  }

  return { ready: true, provider: "resend", from, replyTo, apiKeyPresent: true };
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = resolveEmailTransportConfig();
  if (!config.ready) {
    return { ok: false, errorCode: config.reasonCode, provider: config.provider };
  }

  if (config.provider === "fake") {
    FAKE_OUTBOX.push({
      to: input.to,
      subject: input.subject,
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
        subject: input.subject,
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
  const origin = resolveWexonPublicOrigin() || "https://www.wexon.dev";
  const inviteUrl = `${origin.replace(/\/+$/, "")}/invite/${encodeURIComponent(input.invitePathToken)}`;
  const org = escapeEmailHtml(input.organizationName);
  const role = escapeEmailHtml(input.roleLabel);
  const expires = escapeEmailHtml(input.expiresAt.toLocaleString("tr-TR"));
  const safeUrl = escapeEmailHtml(inviteUrl);

  const subject = `${input.organizationName} — Wexon personel daveti`;
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
