/**
 * In-app review prompt — adapter over the native store review dialog.
 *
 * Talks to a Capacitor plugin registered as "InAppReview" with `requestReview()`,
 * which is exactly what `@capacitor-community/in-app-review` (v8, Capacitor 8) registers
 * (SKStoreReviewController on iOS, Play In-App Review API on Android).
 *
 * The npm package is NOT installed yet: until it is (`npm i @capacitor-community/in-app-review@8`
 * + `npx cap sync`), `Capacitor.isPluginAvailable('InAppReview')` is false and every call is a
 * no-op that does not consume a milestone. No JS change is needed after installing it.
 *
 * Decision rules live in ./inAppReviewCore (unit-tested).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { isGuestMode } from '@/lib/guestMode';
import {
  REVIEW_STATE_KEY,
  decideReviewPrompt,
  markReviewAsked,
  parseReviewState,
  type ReviewState,
} from '@/lib/inAppReviewCore';

interface InAppReviewPlugin {
  requestReview(): Promise<void>;
}

const PLUGIN_NAME = 'InAppReview';
const InAppReview = registerPlugin<InAppReviewPlugin>(PLUGIN_NAME);

/** Let the "workout finished" screen render before the system dialog appears. */
const DEFAULT_DELAY_MS = 1500;

const readState = (): ReviewState => {
  try { return parseReviewState(localStorage.getItem(REVIEW_STATE_KEY)); } catch { return parseReviewState(null); }
};

const writeState = (state: ReviewState) => {
  try { localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state)); } catch { /* noop */ }
};

const isPluginAvailable = (): boolean => {
  try { return Capacitor.isPluginAvailable(PLUGIN_NAME); } catch { return false; }
};

/** Number of workout sessions of the signed-in user (null when unknown). */
export const countOwnWorkoutSessions = async (): Promise<number | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id);
  return error ? null : count;
};

let inFlight = false;

/**
 * Call ONLY from the finish-workout flow, after the session was saved.
 * Never throws; resolves to true when the system dialog was requested.
 */
export const requestReviewAfterWorkout = async (
  countCompleted: () => Promise<number | null> = countOwnWorkoutSessions,
  delayMs: number = DEFAULT_DELAY_MS,
): Promise<boolean> => {
  if (inFlight) return false;
  inFlight = true;
  try {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative || isGuestMode() || !isPluginAvailable()) return false;

    const completedWorkouts = await countCompleted().catch(() => null);
    const state = readState();
    const decision = decideReviewPrompt({
      isNative,
      isGuest: isGuestMode(),
      afterWorkoutCompleted: true,
      completedWorkouts,
      now: new Date(),
      state,
    });
    if (!decision.ask) return false;

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await InAppReview.requestReview();
    // The OS decides whether the dialog is actually shown (Apple max 3×/365 days);
    // we only record that we asked.
    writeState(markReviewAsked(state, decision.milestone, new Date()));
    return true;
  } catch {
    return false;
  } finally {
    inFlight = false;
  }
};
