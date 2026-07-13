export const COOKIE_CONSENT_STORAGE_KEY = "wexon_cookie_consent";

export type CookieConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function defaultRejectedConsent(): CookieConsentPreferences {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultAcceptedConsent(): CookieConsentPreferences {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
    updatedAt: new Date().toISOString(),
  };
}

export function readCookieConsent(): CookieConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") {
      return null;
    }
    return {
      necessary: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeCookieConsent(prefs: CookieConsentPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({ ...prefs, necessary: true }));
  window.dispatchEvent(new CustomEvent("wexon:cookie-consent", { detail: prefs }));
}

/** Future analytics/marketing scripts should call these before loading. */
export function hasAnalyticsConsent() {
  return readCookieConsent()?.analytics === true;
}

export function hasMarketingConsent() {
  return readCookieConsent()?.marketing === true;
}
