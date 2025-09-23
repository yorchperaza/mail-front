// lib/consent.ts
export type ConsentState = {
    necessary: true;           // always true
    analytics: boolean;
    marketing: boolean;
};

const COOKIE_NAME = "mm_consent";
const COOKIE_TTL_DAYS = 180;

function parseCookie(): ConsentState | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (!m) return null;
    try {
        return JSON.parse(decodeURIComponent(m[1]));
    } catch {
        return null;
    }
}

export function getConsent(): ConsentState | null {
    return parseCookie();
}

export function hasConsent(kind: keyof ConsentState): boolean {
    const c = parseCookie();
    if (!c) return false;
    return !!c[kind];
}

export function setConsent(value: ConsentState) {
    if (typeof document === "undefined") return;
    const expires = new Date();
    expires.setDate(expires.getDate() + COOKIE_TTL_DAYS);
    document.cookie = [
        `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}`,
        `Path=/`,
        `SameSite=Lax`,
        `Expires=${expires.toUTCString()}`,
    ].join("; ");
}
