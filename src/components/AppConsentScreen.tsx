import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { AppConsent } from '@/lib/appConsent';
import { useAppConsent } from '@/hooks/useAppConsent';
import {
  isWorkoutActive, onAnalyticsUiChange, saveAppConsent, takeConsentPromptRequest,
} from '@/lib/appAnalytics';

const NONE: AppConsent = { analytics: false, marketing: false };
const ALL: AppConsent = { analytics: true, marketing: true };

// Never interrupt sign-in, public share pages, the policy itself or a workout.
const BLOCKED_PREFIXES = ['/auth', '/reset-password', '/privacy', '/terms', '/install', '/plan/', '/cvik/', '/s/', '/go/', '/custom-workout/'];

const AppConsentScreen = ({ startCustomizing, initial, onSave, onCancel }: {
  startCustomizing: boolean;
  initial: AppConsent;
  onSave: (c: AppConsent) => Promise<void>;
  onCancel?: () => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customize, setCustomize] = useState(startCustomizing);
  const [choice, setChoice] = useState<AppConsent>(initial);
  const [saving, setSaving] = useState(false);

  const save = async (c: AppConsent) => {
    setSaving(true);
    try { await onSave(c); } finally { setSaving(false); }
  };

  const categories = [
    { key: 'necessary', locked: true },
    { key: 'analytics', locked: false },
    { key: 'marketing', locked: false },
  ] as const;

  return (
    <div role="dialog" aria-modal="true" aria-label={t('consent.title')} data-app-consent
      className="fixed inset-0 z-[80] flex items-end justify-center bg-background/80 backdrop-blur-sm px-3"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="w-full max-w-md max-h-full overflow-y-auto bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5">
        {!customize ? (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{t('consent.title')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('consent.text')}{' '}
                <button type="button" className="underline text-foreground" onClick={() => navigate('/privacy#cookies')}>
                  {t('consent.more')}
                </button>
              </p>
            </div>
            <Button size="lg" className="w-full" disabled={saving} data-consent-accept onClick={() => save(ALL)}>
              {t('consent.accept_all')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={saving} data-consent-reject onClick={() => save(NONE)}>
                {t('consent.reject_all')}
              </Button>
              <Button variant="outline" className="flex-1" disabled={saving} data-consent-customize onClick={() => setCustomize(true)}>
                {t('consent.customize')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">{t('consent.settings_title')}</h2>
            <div className="space-y-4">
              {categories.map(({ key, locked }) => (
                <div key={key} className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{t(`consent.cat_${key}`)}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t(`consent.cat_${key}_desc`)}</p>
                  </div>
                  <Switch aria-label={t(`consent.cat_${key}`)} data-consent-toggle={key}
                    checked={locked ? true : choice[key]} disabled={locked || saving}
                    onCheckedChange={locked ? undefined : (v) => setChoice((c) => ({ ...c, [key]: v }))} />
                </div>
              ))}
            </div>
            <Button size="lg" className="w-full" disabled={saving} data-consent-save onClick={() => save(choice)}>
              {t('consent.save')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={saving} onClick={() => save(ALL)}>
                {t('consent.accept_all')}
              </Button>
              {onCancel && (
                <Button variant="ghost" className="flex-1" disabled={saving} onClick={onCancel}>
                  {t('consent.cancel')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Native app only. Asks once, after the onboarding questionnaire is complete (new
 * users right after it, existing users on their next open), and reopens from Settings.
 */
export const AppConsentGate = () => {
  const native = Capacitor.isNativePlatform();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const consent = useAppConsent();
  const [onboarded, setOnboarded] = useState(false);
  const [fromSettings, setFromSettings] = useState(false);

  useEffect(() => onAnalyticsUiChange(() => {
    const request = takeConsentPromptRequest();
    if (request === 'settings') setFromSettings(true);
    if (request === 'first') setOnboarded(true);
  }), []);

  useEffect(() => { if (!user) setOnboarded(false); }, [user]);

  // Existing users who finished onboarding before this screen existed.
  useEffect(() => {
    if (!native || !user || onboarded || consent !== null) return;
    let cancelled = false;
    supabase.from('user_profiles').select('onboarding_completed').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled && data?.onboarding_completed) setOnboarded(true); });
    return () => { cancelled = true; };
  }, [native, user, onboarded, consent, pathname]);

  if (!native) return null;

  if (fromSettings) {
    return (
      <AppConsentScreen startCustomizing initial={consent ?? NONE}
        onSave={async (c) => { await saveAppConsent(c); setFromSettings(false); }}
        onCancel={() => setFromSettings(false)} />
    );
  }

  const blocked = BLOCKED_PREFIXES.some((p) => pathname.startsWith(p)) || isWorkoutActive();
  if (!user || !onboarded || consent !== null || blocked) return null;

  return <AppConsentScreen startCustomizing={false} initial={NONE} onSave={saveAppConsent} />;
};
