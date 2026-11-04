import { useEffect, useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAppConsent, isWorkoutActive, onAnalyticsUiChange } from '@/lib/appAnalytics';
import { isConsentPromptPending } from '@/lib/appConsent';

/** In-app measurement consent; re-renders when it changes or a workout starts/ends. */
export const useAppConsent = () => {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onAnalyticsUiChange(bump), []);
  return getAppConsent();
};

/** First-run consent sheet is due here: anything auto-opening (coach tour) waits for the answer. */
export const useConsentPromptPending = () => {
  const consent = useAppConsent();
  const { user } = useAuth();
  const { pathname } = useLocation();
  return isConsentPromptPending({ hasUser: !!user, consent, pathname, workoutActive: isWorkoutActive() });
};
