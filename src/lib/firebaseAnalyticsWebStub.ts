// Web build stub for `firebase/analytics`.
//
// `@capacitor-firebase/analytics` imports the Firebase JS SDK in its lazily loaded
// web implementation. Pumplo measures only in the native app (appAnalytics.ts is a
// no-op off native), so the web build resolves this stub instead of the SDK.

const unavailable = (): never => {
  throw new Error('firebase/analytics is not available on web (native-only in Pumplo)');
};

export const getAnalytics = (): never => unavailable();
export const logEvent = (): never => unavailable();
export const setAnalyticsCollectionEnabled = (): never => unavailable();
export const setConsent = (): never => unavailable();
export const setUserId = (): never => unavailable();
export const setUserProperties = (): never => unavailable();
