import { useEffect, useReducer } from 'react';
import { getAppConsent, onAnalyticsUiChange } from '@/lib/appAnalytics';

/** In-app measurement consent; re-renders when it changes or a workout starts/ends. */
export const useAppConsent = () => {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onAnalyticsUiChange(bump), []);
  return getAppConsent();
};
