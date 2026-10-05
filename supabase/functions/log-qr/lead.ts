// Pure helpers for e-mail capture on the machine page (app.pumplo.com/s/<code>).
export const CONSENT_TEXT_VERSION = "qr-lead-2026-10-05";
export const LEAD_RATE_LIMIT_PER_HOUR = 20;

const CONSENT_TEXT = {
  cs: "Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli.",
  en: "By sending you agree to receive tips and news from Pumplo. You can unsubscribe anytime.",
} as const;

export type LeadLang = keyof typeof CONSENT_TEXT;
export const toLang = (v: unknown): LeadLang => (v === "en" ? "en" : "cs");
export const consentTextFor = (lang: LeadLang): string => CONSENT_TEXT[lang];

export const normalizeEmail = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim().toLowerCase() : "";

// One @, a dot in the domain, no spaces, TLD ≥ 2 chars, sane length.
export const isValidEmail = (email: string): boolean =>
  email.length >= 6 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

// A filled honeypot field means a bot; such requests get a fake success.
export const isBot = (honeypot: unknown): boolean =>
  typeof honeypot === "string" && honeypot.trim().length > 0;
