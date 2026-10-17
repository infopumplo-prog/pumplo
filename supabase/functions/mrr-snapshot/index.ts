// Denní snímek MRR (měsíční opakovaný příjem) pro sekci Report → report_mrr_daily.
//
// DEFINICE MRR (Kč, bez DPH tak, jak je cena ve Stripe):
//   součet předplatných posiloven ve Stripe se stavem active nebo past_due,
//   přepočtených na měsíc (roční / 12, čtvrtletní / 3, …), po slevách z kupónů
//   (percent_off a amount_off; kupón s duration "once" se nezapočítává),
//   jen měna CZK, bez ukázkové posilovny. Trial (trialing) se nepočítá.
//   Zdroj pravdy = Stripe API (read-only list), ne tabulka gym_subscriptions —
//   ta umí mít zastaralé current_period_end.
//
// Mimo MRR, ale v snímku zvlášť:
//   manual_gyms / manual_list_mrr_czk — aktivní předplatné v gym_subscriptions
//     bez Stripe a bez is_grandfathered (ruční / dočasné dohody, např. faktura);
//     hodnota podle ceníku subscription_plans, NEZAHRNUJE se do mrr_czk, dokud
//     se platba neprokáže.
//   free_gyms — is_grandfathered (custom deal bez Stripe, např. pilot Eurogym).
import { addDays, guard, json, logRun, pragueDay, serviceClient } from "../_shared/report.ts";

const DEMO_GYM_ID = "deadbeef-0000-4000-8000-000000000001";

// deno-lint-ignore no-explicit-any
type Any = any;

const monthlyFactor = (interval: string, count: number) => {
  const c = count || 1;
  switch (interval) {
    case "day": return 365 / 12 / c;
    case "week": return 52 / 12 / c;
    case "month": return 1 / c;
    case "year": return 1 / 12 / c;
    default: return 0;
  }
};

async function stripeList(key: string, status: string): Promise<Any[]> {
  const out: Any[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const p = new URLSearchParams({ status, limit: "100" });
    p.append("expand[]", "data.items.data.price");
    p.append("expand[]", "data.discounts");
    if (after) p.set("starting_after", after);
    const res = await fetch(`https://api.stripe.com/v1/subscriptions?${p}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Stripe ${status}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    out.push(...body.data);
    if (!body.has_more || body.data.length === 0) break;
    after = body.data[body.data.length - 1].id;
  }
  return out;
}


// Konec dne (23:59:59) v Praze jako unix sekundy — pro zpětný výpočet.
const pragueDayEnd = (day: string) => {
  const noonUtc = Date.parse(`${day}T12:00:00Z`);
  const offsetMin = (Date.parse(new Date(noonUtc).toLocaleString("sv-SE", { timeZone: "Europe/Prague" }).replace(" ", "T") + "Z") - noonUtc) / 60000;
  return Math.floor((Date.parse(`${day}T23:59:59Z`) - offsetMin * 60000) / 1000);
};

/**
 * Zpětné doplnění report_mrr_daily (body {"backfill_days": N}).
 * Přibližné: cena = dnešní položky předplatného, slevy podle start/end kupónu,
 * předplatné se počítá od start_date do ended_at a mimo trial. Ruční a zdarma podle
 * gym_subscriptions.created_at. Existující dny NEPŘEPISUJE (jen doplní chybějící).
 */
async function backfill(key: string, days: number) {
  const db = serviceClient();
  const today = pragueDay();
  const [{ data: subs, error: e1 }, { data: plans, error: e2 }] = await Promise.all([
    db.from("gym_subscriptions").select("gym_id, plan_id, status, billing_period, stripe_subscription_id, is_grandfathered, created_at"),
    db.from("subscription_plans").select("id, price_monthly, price_annual"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const planById = new Map((plans ?? []).map((p) => [p.id, p]));
  const bySubId = new Map((subs ?? []).filter((s) => s.stripe_subscription_id).map((s) => [s.stripe_subscription_id, s]));
  const all = (await stripeList(key, "all")).filter((s) => (s.currency ?? "").toLowerCase() === "czk");
  const rows: Any[] = [];
  for (let i = days; i >= 1; i--) {
    const day = addDays(today, -i);
    const t = pragueDayEnd(day);
    const byPlan: Record<string, { gyms: number; mrr_czk: number }> = {};
    const paying = new Set<string>();
    let mrr = 0;
    for (const s of all) {
      const local = bySubId.get(s.id);
      const gymId = local?.gym_id ?? s.metadata?.gym_id ?? s.id;
      if (gymId === DEMO_GYM_ID) continue;
      if ((s.start_date ?? 0) > t) continue;
      if (s.ended_at && s.ended_at <= t) continue;
      if (s.trial_end && s.trial_end > t && (s.trial_start ?? 0) <= t) continue;
      let gross = 0;
      for (const it of s.items?.data ?? []) {
        const pr = it.price ?? {};
        if (!pr.recurring) continue;
        gross += (pr.unit_amount ?? 0) / 100 * (it.quantity ?? 1) * monthlyFactor(pr.recurring.interval, pr.recurring.interval_count);
      }
      const ds: Any[] = (s.discounts ?? []).filter((d: Any) => d && typeof d === "object" && d.coupon);
      if (!ds.length && s.discount?.coupon) ds.push(s.discount);
      const first = s.items?.data?.[0]?.price?.recurring;
      let net = gross;
      for (const d of ds) {
        const c = d.coupon;
        if (c.duration === "once") continue;
        if ((d.start ?? 0) > t || (d.end && d.end <= t)) continue;
        if (c.percent_off) net *= 1 - c.percent_off / 100;
        else if (c.amount_off && first) net -= c.amount_off / 100 * monthlyFactor(first.interval, first.interval_count);
      }
      net = Math.max(0, Math.round(net * 100) / 100);
      const plan = local?.plan_id ?? s.metadata?.plan_id ?? "(neznámý)";
      const b = byPlan[plan] ??= { gyms: 0, mrr_czk: 0 };
      b.gyms += 1; b.mrr_czk = Math.round((b.mrr_czk + net) * 100) / 100;
      mrr += net;
      if (net > 0) paying.add(gymId);
    }
    const tIso = new Date(t * 1000).toISOString();
    const local = (subs ?? []).filter((x) => x.gym_id !== DEMO_GYM_ID && !x.stripe_subscription_id && x.status === "active" && x.created_at <= tIso);
    const manual = local.filter((x) => !x.is_grandfathered);
    rows.push({
      day, mrr_czk: Math.round(mrr * 100) / 100, active_paying_gyms: paying.size, by_plan: byPlan,
      manual_gyms: manual.length,
      manual_list_mrr_czk: Math.round(manual.reduce((a, x) => {
        const p = planById.get(x.plan_id);
        return a + (x.billing_period === "annual" ? (p?.price_annual ?? 0) / 12 : (p?.price_monthly ?? 0));
      }, 0) * 100) / 100,
      free_gyms: local.filter((x) => x.is_grandfathered).length,
      details: { backfill: true, note: "zpětný výpočet ze Stripe (start/konec předplatného, dnešní ceny)" },
      updated_at: new Date().toISOString(),
    });
  }
  const { error } = await db.from("report_mrr_daily").upsert(rows, { onConflict: "day", ignoreDuplicates: true });
  if (error) throw new Error(`report_mrr_daily backfill: ${error.message}`);
  return { days: rows.length, first: rows[0], last: rows[rows.length - 1] };
}

Deno.serve(async (req) => {
  const denied = guard(req);
  if (denied) return denied;
  const started = new Date();
  const db = serviceClient();
  const day = pragueDay();
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    await logRun(db, "mrr", started, "not_configured", "Chybí secret STRIPE_SECRET_KEY.");
    return json({ status: "not_configured" });
  }
  const body = await req.json().catch(() => ({}));
  const backfillDays = Math.min(parseInt(body?.backfill_days, 10) || 0, 400);
  if (backfillDays > 0) {
    try {
      return json({ status: "ok", backfill: await backfill(key, backfillDays) });
    } catch (e) {
      return json({ status: "error", message: String(e) }, 500);
    }
  }

  try {
    const [{ data: subs, error: e1 }, { data: plans, error: e2 }, { data: gyms, error: e3 }] = await Promise.all([
      db.from("gym_subscriptions").select("gym_id, plan_id, status, billing_period, stripe_subscription_id, is_grandfathered"),
      db.from("subscription_plans").select("id, name, price_monthly, price_annual"),
      db.from("gyms").select("id, name"),
    ]);
    if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);
    const gymName = new Map((gyms ?? []).map((g) => [g.id, g.name]));
    const planById = new Map((plans ?? []).map((p) => [p.id, p]));
    const bySubId = new Map((subs ?? []).filter((s) => s.stripe_subscription_id).map((s) => [s.stripe_subscription_id, s]));

    const stripeSubs = [...await stripeList(key, "active"), ...await stripeList(key, "past_due")];
    const lines: Any[] = [];
    const skipped: Any[] = [];
    for (const s of stripeSubs) {
      const local = bySubId.get(s.id);
      const gymId = local?.gym_id ?? s.metadata?.gym_id ?? null;
      if (gymId === DEMO_GYM_ID) { skipped.push({ id: s.id, reason: "demo" }); continue; }
      if ((s.currency ?? "").toLowerCase() !== "czk") { skipped.push({ id: s.id, reason: `měna ${s.currency}` }); continue; }
      let gross = 0;
      for (const it of s.items?.data ?? []) {
        const pr = it.price ?? {};
        if (!pr.recurring) continue;
        gross += (pr.unit_amount ?? 0) / 100 * (it.quantity ?? 1) *
          monthlyFactor(pr.recurring.interval, pr.recurring.interval_count);
      }
      // Slevy: nové API vrací pole discounts (expandované), staré pole discount.
      const coupons: Any[] = [];
      for (const d of s.discounts ?? []) if (d && typeof d === "object" && d.coupon) coupons.push(d.coupon);
      if (!coupons.length && s.discount?.coupon) coupons.push(s.discount.coupon);
      let net = gross;
      const firstItem = s.items?.data?.[0]?.price?.recurring;
      for (const c of coupons) {
        if (c.duration === "once") continue;
        if (c.percent_off) net *= 1 - c.percent_off / 100;
        else if (c.amount_off && (c.currency ?? "czk") === "czk" && firstItem) {
          net -= c.amount_off / 100 * monthlyFactor(firstItem.interval, firstItem.interval_count);
        }
      }
      net = Math.max(0, Math.round(net * 100) / 100);
      lines.push({
        stripe_subscription_id: s.id, status: s.status, gym_id: gymId,
        gym: gymId ? gymName.get(gymId) ?? null : null,
        plan_id: local?.plan_id ?? s.metadata?.plan_id ?? "(neznámý)",
        mrr_czk: net, gross_czk: Math.round(gross * 100) / 100,
        coupons: coupons.map((c) => c.id),
      });
    }

    const byPlan: Record<string, { gyms: number; mrr_czk: number }> = {};
    for (const l of lines) {
      const b = byPlan[l.plan_id] ??= { gyms: 0, mrr_czk: 0 };
      b.gyms += 1;
      b.mrr_czk = Math.round((b.mrr_czk + l.mrr_czk) * 100) / 100;
    }
    const mrr = Math.round(lines.reduce((a, l) => a + l.mrr_czk, 0) * 100) / 100;
    const payingGyms = new Set(lines.filter((l) => l.mrr_czk > 0).map((l) => l.gym_id ?? l.stripe_subscription_id)).size;

    const localActive = (subs ?? []).filter((s) =>
      s.status === "active" && s.gym_id !== DEMO_GYM_ID && !s.stripe_subscription_id);
    const manual = localActive.filter((s) => !s.is_grandfathered).map((s) => {
      const p = planById.get(s.plan_id);
      const list = s.billing_period === "annual" ? (p?.price_annual ?? 0) / 12 : (p?.price_monthly ?? 0);
      return { gym_id: s.gym_id, gym: gymName.get(s.gym_id) ?? null, plan_id: s.plan_id, list_mrr_czk: Math.round(list * 100) / 100 };
    });
    const free = localActive.filter((s) => s.is_grandfathered).map((s) => ({
      gym_id: s.gym_id, gym: gymName.get(s.gym_id) ?? null, plan_id: s.plan_id,
    }));
    // Lokální řádek se Stripe ID, které Stripe nevrátil jako aktivní → nesoulad k prověření.
    const activeIds = new Set(stripeSubs.map((s) => s.id));
    const mismatched = (subs ?? []).filter((s) =>
      s.status === "active" && s.stripe_subscription_id && !activeIds.has(s.stripe_subscription_id) && s.gym_id !== DEMO_GYM_ID)
      .map((s) => ({ gym: gymName.get(s.gym_id) ?? s.gym_id, stripe_subscription_id: s.stripe_subscription_id }));

    const row = {
      day, mrr_czk: mrr, active_paying_gyms: payingGyms, by_plan: byPlan,
      manual_gyms: manual.length,
      manual_list_mrr_czk: Math.round(manual.reduce((a, m) => a + m.list_mrr_czk, 0) * 100) / 100,
      free_gyms: free.length,
      details: { stripe: lines, manual, free, skipped, mismatched, livemode: stripeSubs[0]?.livemode ?? null },
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("report_mrr_daily").upsert(row, { onConflict: "day" });
    if (error) throw new Error(`report_mrr_daily: ${error.message}`);

    const status = mismatched.length ? "partial" : "ok";
    const message = `MRR ${mrr} Kč, platících posiloven ${payingGyms}, ručních ${manual.length}, zdarma ${free.length}` +
      (mismatched.length ? `; ⚠️ ${mismatched.length} aktivních v DB, které Stripe nevede jako aktivní` : "") + ".";
    await logRun(db, "mrr", started, status, message, { stripe_subs: stripeSubs.length, mismatched });
    return json({ status, message, row });
  } catch (e) {
    await logRun(db, "mrr", started, "error", String(e));
    return json({ status: "error", message: String(e) }, 500);
  }
});
