// Writes a finished onboarding questionnaire to a freshly created account.
//
// Shared by the e-mail registration (Auth.tsx) and the Apple / Google sign-up,
// which returns to the app only after Auth.tsx has been unmounted — there the
// answers come back from the on-disk draft (PendingOnboardingFinisher in App.tsx).
// Before 13. 10. 2026 the OAuth sign-up never wrote them at all, so every Apple
// and Google user landed on "finish your questionnaire".

import { supabase } from '@/integrations/supabase/client';
import { resolveSplit } from '@/lib/trainingGoals';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboardingTypes';
import type { OnboardingDraft } from '@/lib/onboardingDraft';
import { hasRealInjuries } from '@/lib/trainersDirectory';
import { clampFreeText } from '@/lib/onboardingFlow';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type PersistOnboardingResult =
  | { ok: true; ownPlanId: string | null }
  | { ok: false };

/**
 * Profile → workout plan → Onboarding 2.0 answers → own plan (if chosen).
 * Returns ok:false only when the profile itself could not be written; the
 * extras after it never block the registration.
 */
export async function persistOnboarding(
  userId: string,
  d: OnboardingDraft,
  ownPlanName: string,
): Promise<PersistOnboardingResult> {
  const trainingSplit = d.trainingDays.length > 0 && d.userLevel
    ? resolveSplit(d.trainingDays.length, d.userLevel, d.splitOverride ?? null)
    : d.splitOverride ?? null;
  const motivations = d.motivations ?? [];
  const expectations = d.expectations ?? [];
  const planChoice = d.planChoice ?? 'pumplo';
  // Popis zranění jen u skutečného zranění, jinak nic neukládat (feedback 13. 10., GDPR).
  const injuryNote = hasRealInjuries(d.injuries) ? clampFreeText(d.injuryNote?.trim() ?? '') || null : null;

  // 1. Profile (retry: the signup trigger may not have created the row yet).
  let profileUpdated = false;
  for (let attempt = 1; attempt <= 3 && !profileUpdated; attempt++) {
    // .select() matters: an update that matches no row reports no error.
    const { data: rows, error } = await supabase
      .from('user_profiles')
      .update({
        primary_goal: d.primaryGoal,
        user_level: d.userLevel,
        training_days: d.trainingDays,
        preferred_time: d.preferredTime,
        training_duration_minutes: d.trainingDuration,
        gender: d.gender,
        age: d.age ? parseInt(d.age) : null,
        height_cm: d.height ? parseInt(d.height) : null,
        weight_kg: d.weight ? parseFloat(d.weight) : null,
        injuries: d.injuries,
        equipment_preference: d.equipmentPreference,
        selected_gym_id: d.selectedGymId,
        training_split: trainingSplit,
        split_override: d.splitOverride ?? null,
        onboarding_completed: true,
        current_step: ONBOARDING_TOTAL_STEPS,
        // OAuth fills the name from the provider; never overwrite it with blanks.
        ...(d.firstName ? { first_name: d.firstName } : {}),
        ...(d.lastName ? { last_name: d.lastName } : {}),
        motivations,
        ...(d.accentColor ? { accent_color: d.accentColor } : {}),
      })
      .eq('user_id', userId)
      .select('user_id');

    if (error || !rows?.length) {
      console.error(`Profile update error (attempt ${attempt}):`, error ?? 'no row matched');
      if (attempt < 3) await wait(500);
    } else {
      profileUpdated = true;
    }
  }
  if (!profileUpdated) return { ok: false };

  // 1b. Popis zranění zvlášť a neblokujícně: bez migrace 20261014_injury_note by
  // neznámý sloupec shodil celý zápis profilu a s ním registraci.
  if (injuryNote) {
    const { error } = await supabase.from('user_profiles').update({ injury_note: injuryNote }).eq('user_id', userId);
    if (error) console.error('Injury note not saved:', error);
  }

  // 2. Workout plan.
  if (d.primaryGoal) {
    await supabase.from('user_workout_plans').update({ is_active: false }).eq('user_id', userId);
    await supabase.from('user_workout_plans').insert({
      user_id: userId,
      goal_id: d.primaryGoal,
      is_active: true,
      started_at: new Date().toISOString(),
      current_week: 1,
      gym_id: null, // set when the person picks a gym
      training_days: d.trainingDays,
      split_type: trainingSplit,
    });
  }

  // 3. Wait until the profile reads back as completed (React Query, replicas).
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('user_id', userId)
      .single();
    if (data?.onboarding_completed === true) break;
    await wait(200);
  }

  // 4. Onboarding 2.0 answers + own plan — extras, never block registration.
  try {
    // Table is not in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('onboarding_answers').insert([
      { user_id: userId, question: 'motivation', choices: motivations, free_text: d.motivationText?.trim() || null },
      { user_id: userId, question: 'expectations', choices: expectations, free_text: d.expectationText?.trim() || null },
      { user_id: userId, question: 'plan_choice', choices: [planChoice], free_text: null },
    ]);
    if (error) console.error('Onboarding answers not saved:', error);
  } catch (error) {
    console.error('Onboarding answers not saved:', error);
  }

  let ownPlanId: string | null = null;
  if (planChoice === 'own') {
    const { data } = await supabase
      .from('custom_plans')
      .insert({ user_id: userId, name: ownPlanName })
      .select('id')
      .single();
    ownPlanId = data?.id ?? null;
  }

  return { ok: true, ownPlanId };
}
