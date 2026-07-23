/**
 * Admin session cookie v3 payload (HMAC-signed).
 * Binds PlatformAdmin.id + Cloudflare subject — not allowlist email alone.
 */

import { createHmac, timingSafeEqual } from "crypto";
import {
  ADMIN_SESSION_TTL_MS,
  adminSessionCookieOptions,
  type AdminSessionCookieOptions,
} from "@/lib/wexon-admin-auth-cookie-options";

export type AdminSessionV3Payload = {
  adminId: string;
  email: string;
  cloudflareSubject: string;
  issuedAt: number;
  expiresAt: number;
};

const SESSION_VERSION = "v3";

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Admin oturum yapılandırması eksik.");
  }
  return secret;
}

function encodePart(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodePart(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signingInput(payload: AdminSessionV3Payload) {
  return [
    SESSION_VERSION,
    payload.adminId,
    payload.email,
    payload.cloudflareSubject,
    String(payload.issuedAt),
    String(payload.expiresAt),
  ].join(".");
}

function signPayload(payload: AdminSessionV3Payload) {
  return createHmac("sha256", getSessionSecret()).update(signingInput(payload)).digest("hex");
}

function signaturesEqual(expected: string, provided: string) {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function encodeAdminSessionV3CookieValue(payload: AdminSessionV3Payload): string {
  const signature = signPayload(payload);
  return [
    SESSION_VERSION,
    encodePart(payload.adminId),
    encodePart(payload.email),
    encodePart(payload.cloudflareSubject),
    String(payload.issuedAt),
    String(payload.expiresAt),
    signature,
  ].join(".");
}

export function parseAdminSessionV3CookieValue(value: string | undefined | null): AdminSessionV3Payload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 7) return null;
  const [version, encAdminId, encEmail, encSubject, issuedRaw, expiresRaw, signature] = parts;
  if (version !== SESSION_VERSION || !encAdminId || !encEmail || !encSubject || !signature) return null;

  const adminId = decodePart(encAdminId);
  const email = decodePart(encEmail);
  const cloudflareSubject = decodePart(encSubject);
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);

  if (!adminId || !email || !cloudflareSubject) return null;
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Date.now()) return null;
  if (issuedAt > Date.now() + 60_000) return null;

  const payload: AdminSessionV3Payload = {
    adminId,
    email,
    cloudflareSubject,
    issuedAt,
    expiresAt,
  };

  if (!signaturesEqual(signPayload(payload), signature)) return null;
  return payload;
}

export function buildAdminSessionV3Payload(input: {
  adminId: string;
  email: string;
  cloudflareSubject: string;
  now?: number;
  ttlMs?: number;
}): AdminSessionV3Payload {
  const issuedAt = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? ADMIN_SESSION_TTL_MS;
  return {
    adminId: input.adminId,
    email: input.email.trim().toLowerCase(),
    cloudflareSubject: input.cloudflareSubject,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
  };
}

export function adminSessionV3CookieSetOptions(expiresAt: number): AdminSessionCookieOptions {
  return adminSessionCookieOptions(new Date(expiresAt));
}

export { ADMIN_SESSION_TTL_MS };
