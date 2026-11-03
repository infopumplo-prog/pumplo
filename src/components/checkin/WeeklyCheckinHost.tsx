import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { OPEN_CHECKIN_EVENT, currentCheckinWeekStart, pragueWeekStart, shouldShowCheckin } from '@/lib/weeklyCheckin';
import {
  PENDING_CHECKIN_KEY,
  listenWeeklyCheckinTap,
  scheduleWeeklyCheckinNotification,
} from '@/lib/weeklyCheckinNotification';
import WeeklyCheckinSheet from './WeeklyCheckinSheet';

// Týdenní check-in (feedback 13. 10.). Pravidlo Davida: kdo neodpoví v neděli,
// dostane panel při dalším otevření appky (dokud ho nenahradí další týden).
// „Přeskočit" = pro ten týden konec; zavření gestem = znovu až po dalším otevření.

const dismissedKey = (userId: string) => `weekly_checkin_dismissed_${userId}`;
// Návrat z pozadí po delší pauze bereme jako „nové otevření appky".
const RESUME_AS_NEW_OPEN_MS = 10 * 60 * 1000;
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_OPEN_DELAY_MS = 2500;

let snoozedThisSession = false;

const readDismissed = (userId: string): string | null => {
  try { return localStorage.getItem(dismissedKey(userId)); } catch { return null; }
};

const WeeklyCheckinHost = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const location = useLocation();
  const [answered, setAnswered] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => currentCheckinWeekStart(new Date()));
  const [tick, setTick] = useState(0);
  const backgroundedAt = useRef<number | null>(null);

  // Zodpovězené týdny (stačí poslední tři)
  useEffect(() => {
    if (!user) { setAnswered(null); return; }
    let cancelled = false;
    supabase
      .from('weekly_checkins')
      .select('week_start')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (cancelled) return;
        // Bez tabulky / při chybě raději nic neukazujeme
        setAnswered(error ? null : (data ?? []).map((r) => r.week_start));
      });
    return () => { cancelled = true; };
  }, [user]);

  // Nedělní notifikace (jen když appka už má povolení)
  useEffect(() => {
    if (!user || !profile?.onboarding_completed) return;
    scheduleWeeklyCheckinNotification(t('checkin.notification_title'), t('checkin.notification_body'));
  }, [user, profile?.onboarding_completed, t]);

  // currentWeek = admin test z profilu (David 17. 10.): ukázat rozběhnutý týden,
  // ne ten minulý — jinak souhrn ukazuje nuly, i když se tento týden cvičilo.
  const forceOpen = useCallback((currentWeek = false) => {
    const now = new Date();
    setWeekStart(currentWeek ? pragueWeekStart(now) : currentCheckinWeekStart(now));
    setOpen(true);
  }, []);

  // Klepnutí na notifikaci, admin tlačítko v profilu
  useEffect(() => {
    const onOpen = (e: Event) => {
      try { sessionStorage.removeItem(PENDING_CHECKIN_KEY); } catch { /* noop */ }
      forceOpen(!!(e as CustomEvent<{ currentWeek?: boolean }>).detail?.currentWeek);
    };
    window.addEventListener(OPEN_CHECKIN_EVENT, onOpen);
    let removeTap: (() => void) | undefined;
    listenWeeklyCheckinTap().then((remove) => { removeTap = remove; });
    return () => {
      window.removeEventListener(OPEN_CHECKIN_EVENT, onOpen);
      removeTap?.();
    };
  }, [forceOpen]);

  // Studený start z notifikace — otevřít, až je uživatel načtený
  useEffect(() => {
    if (!user) return;
    let pending = false;
    try { pending = sessionStorage.getItem(PENDING_CHECKIN_KEY) === '1'; } catch { /* noop */ }
    if (pending) {
      try { sessionStorage.removeItem(PENDING_CHECKIN_KEY); } catch { /* noop */ }
      forceOpen();
    }
  }, [user, forceOpen]);

  // Návrat z pozadí + průběžná kontrola (neděle 19:00 při otevřené appce)
  useEffect(() => {
    const interval = window.setInterval(() => setTick((n) => n + 1), RECHECK_INTERVAL_MS);
    let removeState: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) { backgroundedAt.current = Date.now(); return; }
        if (backgroundedAt.current && Date.now() - backgroundedAt.current >= RESUME_AS_NEW_OPEN_MS) {
          snoozedThisSession = false;
        }
        backgroundedAt.current = null;
        setTick((n) => n + 1);
      }).then((h) => { removeState = () => { h.remove(); }; });
    }
    return () => { window.clearInterval(interval); removeState?.(); };
  }, []);

  // Rozhodnutí o automatickém otevření
  useEffect(() => {
    if (!user || !profile || answered === null || open) return;
    const decision = shouldShowCheckin({
      now: new Date(),
      userCreatedAt: user.created_at,
      onboardingCompleted: !!profile.onboarding_completed,
      answeredWeekStarts: answered,
      dismissedWeekStart: readDismissed(user.id),
      snoozedThisSession,
      pathname: location.pathname,
    });
    if (!decision.show) return;
    const timer = window.setTimeout(() => {
      // Nepřekrývat jiný otevřený panel / dialog (onboarding, prohlídka, téma…)
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      setWeekStart(decision.weekStart);
      setOpen(true);
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [user, profile, answered, open, location.pathname, tick]);

  if (!user) return null;

  return (
    <WeeklyCheckinSheet
      open={open}
      weekStart={weekStart}
      trainingDaysCount={profile?.training_days?.length ?? 0}
      onSubmitted={(ws) => {
        setAnswered((prev) => [ws, ...(prev ?? [])]);
        setOpen(false);
      }}
      onSkip={() => {
        try { localStorage.setItem(dismissedKey(user.id), weekStart); } catch { /* noop */ }
        snoozedThisSession = true;
        setOpen(false);
      }}
      onLater={() => {
        snoozedThisSession = true;
        setOpen(false);
      }}
    />
  );
};

export default WeeklyCheckinHost;
