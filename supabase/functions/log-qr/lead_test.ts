import { assertEquals } from "jsr:@std/assert";
import { normalizeEmail, isValidEmail, isBot, consentTextFor, toLang, CONSENT_TEXT_VERSION } from "./lead.ts";

Deno.test("normalize trims and lowercases", () => assertEquals(normalizeEmail("  Ana@Gmail.COM "), "ana@gmail.com"));
Deno.test("normalize non-string", () => assertEquals(normalizeEmail(42), ""));
Deno.test("valid emails", () => { for (const e of ["ana@gmail.com", "a.b+c@seznam.cz", "xy@yz.co"]) assertEquals(isValidEmail(e), true, e); });
Deno.test("invalid emails", () => { for (const e of ["", "ana", "ana@", "ana@gmail", "a na@gmail.com", "a@b.c", "x".repeat(250) + "@gmail.com"]) assertEquals(isValidEmail(e), false, e); });
Deno.test("honeypot", () => { assertEquals(isBot("http://x"), true); assertEquals(isBot(""), false); assertEquals(isBot(undefined), false); });
Deno.test("lang + consent text", () => {
  assertEquals(toLang("en"), "en"); assertEquals(toLang("de"), "cs");
  assertEquals(consentTextFor("cs"), "Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli.");
  assertEquals(consentTextFor("en"), "By sending you agree to receive tips and news from Pumplo. You can unsubscribe anytime.");
  assertEquals(CONSENT_TEXT_VERSION, "qr-lead-2026-10-05");
});
