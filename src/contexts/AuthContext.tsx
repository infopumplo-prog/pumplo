import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '@/integrations/supabase/client';
import { updateWatchAuth } from '@/lib/watchWorkout';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isRegistering: boolean;
  setIsRegistering: (v: boolean) => void;
  pendingPasswordReset: boolean;
  clearPasswordReset: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<{ success: boolean; error?: string; userId?: string }>;
  loginWithProvider: (provider: 'google' | 'apple') => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Předání relace hodinkám pro samostatný režim. Nesmí nikdy shodit přihlášení
// v telefonu — nespárované hodinky ani chybějící plugin nejsou chyba.
const pushSessionToWatch = async (session: Session | null): Promise<void> => {
  try {
    if (!session?.access_token || !session.refresh_token || !session.user?.id) {
      await updateWatchAuth(null);
      return;
    }
    await updateWatchAuth({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      // Supabase dává expires_at v sekundách; když chybí, dopočítáme z expires_in.
      expiresAt: session.expires_at ?? (Date.now() / 1000 + (session.expires_in ?? 3600)),
      userId: session.user.id,
    });
  } catch { /* hodinky nejsou povinné */ }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const clearPasswordReset = () => setPendingPasswordReset(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        // Hodinky si drží vlastní přihlášení — posíláme jim ho při každé změně
        // relace, aby nikdy nedržely mrtvý token, dokud je telefon po ruce.
        void pushSessionToWatch(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        if (event === 'PASSWORD_RECOVERY') {
          setPendingPasswordReset(true);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      void pushSessionToWatch(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Handle OAuth deep link callback on native (Google iOS web flow)
    let appUrlListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', async ({ url }) => {
        const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (url.includes('login-callback')) {
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
          await Browser.close();
        } else if (url.includes('reset-password')) {
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            setPendingPasswordReset(true);
          }
        }
      }).then(handle => {
        appUrlListener = () => handle.remove();
      });
    }

    return () => {
      subscription.unsubscribe();
      appUrlListener?.();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Neplatné přihlašovací údaje' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const register = async (email: string, password: string, firstName: string, lastName: string): Promise<{ success: boolean; error?: string; userId?: string }> => {
    const redirectUrl = `${window.location.origin}/`;

    // Never hang the registration spinner forever: if the network (or the
    // auth client's internal lock) stalls, surface an error after 20 s.
    const signUpPromise = supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('signup_timeout')), 20000));

    let data, error;
    try {
      ({ data, error } = await Promise.race([signUpPromise, timeout]));
    } catch (e) {
      if (e instanceof Error && e.message === 'signup_timeout') {
        return { success: false, error: 'Registrace vypršela — zkontroluj připojení k internetu a zkus to znovu.' };
      }
      return { success: false, error: e instanceof Error ? e.message : 'Registrace selhala' };
    }

    if (error) {
      if (error.message.includes('User already registered')) {
        return { success: false, error: 'Uživatel s tímto emailem již existuje' };
      }
      if (error.message.includes('Password should be at least 6 characters')) {
        return { success: false, error: 'Heslo musí mít alespoň 6 znaků' };
      }
      return { success: false, error: error.message };
    }

    // Return userId for immediate use (no need to call getUser separately)
    return { success: true, userId: data.user?.id };
  };

  const loginWithProvider = async (provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> => {
    const isNative = Capacitor.isNativePlatform();

    if (isNative && provider === 'google') {
      if (Capacitor.getPlatform() === 'ios') {
        // iOS: web OAuth via browser (native plugin has no SPM support)
        try {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: 'com.pumplo.app://login-callback',
              skipBrowserRedirect: true,
              queryParams: { prompt: 'select_account' },
            },
          });
          if (error) return { success: false, error: error.message };
          if (data?.url) await Browser.open({ url: data.url });
          return { success: true };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Google přihlášení selhalo';
          return { success: false, error: message };
        }
      } else {
        // Android: browser OAuth (same as iOS)
        try {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: 'com.pumplo.app://login-callback',
              skipBrowserRedirect: true,
              queryParams: { prompt: 'select_account' },
            },
          });
          if (error) return { success: false, error: error.message };
          if (data?.url) await Browser.open({ url: data.url });
          return { success: true };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Google přihlášení selhalo';
          return { success: false, error: message };
        }
      }
    }

    if (isNative && provider === 'apple') {
      try {
        const result = await SignInWithApple.authorize({
          clientId: 'com.pumplo.app',
          redirectURI: '',
          scopes: 'email name',
          state: '',
          nonce: '',
        });
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.response.identityToken,
        });
        if (error) return { success: false, error: error.message };
        // Apple sends the name ONLY with the very first authorization — the ID
        // token never carries it, so this is the single chance to store it.
        try {
          const given = result.response.givenName?.trim();
          const family = result.response.familyName?.trim();
          if (given || family) {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (u) {
              const { data: prof } = await supabase
                .from('user_profiles').select('first_name, last_name')
                .eq('user_id', u.id).maybeSingle();
              if (prof && !prof.first_name && !prof.last_name) {
                await supabase.from('user_profiles')
                  .update({ first_name: given || null, last_name: family || null })
                  .eq('user_id', u.id);
              }
            }
          }
        } catch { /* jméno navíc nesmí shodit login */ }
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Apple přihlášení selhalo';
        return { success: false, error: message };
      }
    }

    // Web fallback
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const redirectTo = Capacitor.isNativePlatform()
      ? 'com.pumplo.app://reset-password'
      : `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isRegistering, setIsRegistering, pendingPasswordReset, clearPasswordReset, login, register, loginWithProvider, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
