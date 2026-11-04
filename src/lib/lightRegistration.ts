// Krátká registrace klienta trenéra → zápis do profilu (bez dotazníku, bez plánu).
// Logika „kdy“ je v trainerClientOnboarding.ts; tady jen zápis s opakováním
// (řádek profilu zakládá trigger při signUp a nemusí ještě existovat).

import { supabase } from '@/integrations/supabase/client';
import { LIGHT_REGISTRATION_PATCH } from '@/lib/trainerClientOnboarding';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface LightRegistrationExtras {
  firstName?: string;
  lastName?: string;
  /** Zaškrtnuté „Nechci dostávat tipy a novinky e-mailem“ (§ 7 odst. 3 zák. 480/2004 Sb.). */
  marketingOptOut?: boolean;
  /** Formulář odmítnutí opravdu ukázal (jen e-mailová krátká registrace). */
  optOutOffered?: boolean;
}

/** true = profil zapsaný. Hotový onboarding nikdy nepřepíše (podmínka v dotazu). */
export async function applyLightRegistration(userId: string, extras: LightRegistrationExtras = {}): Promise<boolean> {
  const at = new Date().toISOString();
  const first = extras.firstName?.trim();
  const last = extras.lastName?.trim();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: rows, error } = await supabase
      .from('user_profiles')
      .update({
        ...LIGHT_REGISTRATION_PATCH,
        ...(first ? { first_name: first } : {}),
        ...(last ? { last_name: last } : {}),
        ...(extras.marketingOptOut ? { marketing_optout_at: at } : {}),
        ...(extras.optOutOffered ? { email_optout_offered_at: at } : {}),
      })
      .eq('user_id', userId)
      // Souběh s jiným zařízením / plnou registrací: hotový profil nechat být.
      .or('onboarding_completed.is.null,onboarding_completed.eq.false')
      .select('user_id');
    if (!error && rows?.length) return true;
    if (!error) {
      // Žádný řádek: buď ještě neexistuje (trigger), nebo už je onboarding hotový.
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing?.onboarding_completed) return true;
    } else {
      console.error(`Light registration profile update failed (attempt ${attempt}):`, error);
    }
    if (attempt < 3) await wait(500);
  }
  return false;
}
