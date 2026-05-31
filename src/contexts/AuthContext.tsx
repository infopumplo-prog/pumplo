import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '@/integrations/supabase/client';

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
    
    const { data, error } = await supabase.auth.signUp({
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
