// Web build stub for `firebase/messaging`.
//
// `@capacitor-firebase/messaging` statically imports the Firebase JS SDK in its
// web implementation, but Pumplo only uses that plugin on NATIVE (all calls are
// guarded by Capacitor.isNativePlatform()). On the web/PWA we use VAPID web push
// instead. This stub lets the Vite web build resolve `firebase/messaging`
// without pulling in the Firebase JS SDK; none of it runs on web.

export const isSupported = async (): Promise<boolean> => false;

const unavailable = () => {
  throw new Error('firebase/messaging is not available on web (native-only in Pumplo)');
};

export const getMessaging = (): never => unavailable();
export const getToken = async (): Promise<never> => unavailable();
export const deleteToken = async (): Promise<never> => unavailable();
export const onMessage = (): (() => void) => () => {};
