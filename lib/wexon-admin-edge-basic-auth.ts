type AdminEdgeAuthEnv = {
  ADMIN_EDGE_BASIC_AUTH_DISABLED?: string;
  ADMIN_EMAILS?: string;
  ADMIN_LOGIN_PASSWORD?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

export function isProductionAdminEdgeAuthEnabled(env: AdminEdgeAuthEnv) {
  if (env.ADMIN_EDGE_BASIC_AUTH_DISABLED === "true") return false;
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function isAdminEdgeProtectedSurface(host: string, pathname: string) {
  const normalizedHost = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    normalizedHost.startsWith("admin.") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

function decodeBase64(value: string) {
  const atobFn = globalThis.atob;
  if (typeof atobFn === "function") {
    const binary = atobFn(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  const bufferCtor = (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(value, "base64").toString("utf8");
  }

  return null;
}

export function parseBasicAuthorizationHeader(header: string | null | undefined) {
  if (!header) return null;
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = decodeBase64(match[1].trim());
    if (!decoded) return null;
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function parseAdminEmails(adminEmails: string | undefined) {
  return new Set(
    (adminEmails ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function isAdminEdgeBasicAuthorized(
  header: string | null | undefined,
  adminEmails: string | undefined,
  adminPassword: string | undefined,
) {
  const parsed = parseBasicAuthorizationHeader(header);
  const allowedEmails = parseAdminEmails(adminEmails);
  const expectedPassword = adminPassword ?? "";

  if (!parsed || allowedEmails.size === 0 || !expectedPassword) return false;
  if (!allowedEmails.has(parsed.username.trim().toLowerCase())) return false;
  return constantTimeEqual(parsed.password, expectedPassword);
}
