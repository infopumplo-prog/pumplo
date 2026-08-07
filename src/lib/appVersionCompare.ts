// Porovnání verzí appky ve tvaru "1.2.4". Používá se při rozesílání zpráv:
// novinku smí dostat jen zařízení, jehož build ji umí zobrazit.
//
// Stejná logika běží i v edge funkci send-message-push.

/** Rozloží "1.2.4" na [1, 2, 4]. Nečíselné části berou 0, aby porovnání nikdy nespadlo. */
const parts = (version: string): number[] =>
  version.split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });

/** -1 když a < b, 0 při shodě, 1 když a > b. Chybějící části se berou jako nula ("1.2" === "1.2.0"). */
export const compareVersions = (a: string, b: string): number => {
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
};

/**
 * Smí zařízení tuhle zprávu dostat?
 * Bez požadavku na verzi ano vždy. Zařízení, které verzi nehlásí (starší build),
 * je z cílených zpráv vynechané — právě ono by novinku neumělo zobrazit.
 */
export const meetsMinVersion = (deviceVersion: string | null, minVersion: string | null): boolean => {
  if (!minVersion) return true;
  if (!deviceVersion) return false;
  return compareVersions(deviceVersion, minVersion) >= 0;
};
