import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { trackSignUp } from '@/lib/appAnalytics';

interface GuestSignUpSheetProps {
  open: boolean;
  /** keepReturn = po přihlášení se vrátit tam, odkud host sheet otevřel. */
  onClose: (keepReturn: boolean) => void;
}

/**
 * Rychlá registrace z režimu hosta (feedback 13. 10.): Apple / Google / e-mail bez dotazníku.
 * Dotazník lze vyplnit později — Home pak ukáže výzvu „doplň profil“.
 */
const GuestSignUpSheet = ({ open, onClose }: GuestSignUpSheetProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, login, loginWithProvider } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const emailValid = firstName.trim().length >= 2 && email.trim() !== '' && password.length >= 6;

  const handleProvider = async (provider: 'google' | 'apple') => {
    setError('');
    setIsSubmitting(true);
    try {
      const result = await loginWithProvider(provider);
      if (!result.success) setError(result.error || t('auth.login_failed'));
    } catch {
      setError(t('auth.something_wrong'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await register(email.trim(), password, firstName.trim(), '');
      if (result.success && result.userId) trackSignUp('email');
      // Pomalá síť: účet mohl vzniknout i přes chybu/timeout → zkusit přihlásit (stejně jako Auth).
      // Bez relace po úspěšném signUp (potvrzení e-mailu) se přihlášení taky dorovná tady.
      const signedIn = await login(email.trim(), password);
      if (!signedIn.success && !result.success) {
        setError(result.error || t('guest.register_failed'));
      } else if (!signedIn.success) {
        setError(signedIn.error || t('guest.register_failed'));
      }
      // Úspěch: GuestProvider zachytí přihlášení, zavře sheet a vrátí člověka zpět.
    } catch {
      setError(t('auth.something_wrong'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToQuestionnaire = () => {
    // Plán na míru vede přes dotazník — po něm platí cíl z dotazníku, ne návrat z katalogu.
    onClose(false);
    navigate('/auth?start=questionnaire');
  };

  const goToLogin = () => {
    onClose(true);
    navigate('/auth?mode=login');
  };

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(false); }}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <DrawerHeader className="px-0 text-center sm:text-center max-w-md mx-auto w-full">
            <div className="mx-auto mb-2 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <DrawerTitle className="text-xl font-bold">{t('guest.sheet_title')}</DrawerTitle>
            <DrawerDescription>{t('guest.sheet_desc')}</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 max-w-md mx-auto">
            {Capacitor.getPlatform() !== 'android' && (
              <Button variant="outline" size="lg" className="w-full" onClick={() => handleProvider('apple')} disabled={isSubmitting}>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                {t('auth.apple_register')}
              </Button>
            )}
            <Button variant="outline" size="lg" className="w-full" onClick={() => handleProvider('google')} disabled={isSubmitting}>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('auth.google_register')}
            </Button>

            {!showEmail ? (
              <Button variant="outline" size="lg" className="w-full" onClick={() => setShowEmail(true)} disabled={isSubmitting}>
                <Mail className="w-5 h-5 mr-2" />
                {t('guest.continue_email')}
              </Button>
            ) : (
              <form onSubmit={handleEmail} className="space-y-3 pt-1">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input type="text" autoComplete="given-name" placeholder={t('auth.first_name')} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pl-12" required />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input type="email" autoComplete="email" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} className="pl-12" required />
                </div>
                <div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('auth.password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 pl-1">{t('auth.min_chars')}</p>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !emailValid}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('guest.creating')}</span>
                    </>
                  ) : (
                    <span>{t('guest.create_account')}</span>
                  )}
                </Button>
              </form>
            )}

            {error && <p className="text-destructive text-sm text-center py-1">{error}</p>}

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              {t('auth.terms_consent')}{' '}
              <Link to="/terms" className="underline" target="_blank">{t('auth.terms')}</Link>{' '}{t('auth.and')}{' '}
              <Link to="/privacy" className="underline" target="_blank">{t('auth.privacy')}</Link>.
            </p>

            <button type="button" onClick={goToQuestionnaire} className="w-full text-center text-sm font-semibold text-primary py-2">
              {t('guest.questionnaire_link')}
            </button>
            <button type="button" onClick={goToLogin} className="w-full text-center text-sm text-muted-foreground py-1">
              {t('guest.have_account')}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default GuestSignUpSheet;
