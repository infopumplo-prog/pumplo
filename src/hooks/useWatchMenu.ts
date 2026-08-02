import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { addWatchActionListener, buildWatchMenu, updateWatchMenu, type WatchAction } from '@/lib/watchWorkout';
import { usePausedCustomWorkout } from '@/hooks/usePausedCustomWorkout';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';

interface MenuDay { planId: string; planName: string; dayId: string; dayName: string }

/**
 * Nabídka tréninků pro hodinky a obsluha příkazu „spusť trénink".
 *
 * Musí žít GLOBÁLNĚ (AppLayout), ne v přehrávači — když příkaz dorazí, žádný
 * přehrávač ještě neběží. Hodinky samy trénink nespouštějí; jen řeknou, co
 * otevřít, a telefon zaroutuje na existující cestu.
 */
export function useWatchMenu(): void {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { pausedWorkout } = usePausedCustomWorkout();
  const [days, setDays] = useState<MenuDay[]>([]);

  // useCustomPlans vrací jen souhrny (počet dnů, ne jejich názvy), a nabídka
  // potřebuje konkrétní dny. Jeden dotaz při startu appky, ne dotaz na plán.
  useEffect(() => {
    if (!user) { setDays([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('custom_plans')
        .select('id, name, custom_plan_days(id, day_number, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled || error || !data) return;
      const rows = data.flatMap(p =>
        ((p.custom_plan_days as { id: string; day_number: number; name: string | null }[] | null) ?? [])
          .slice()
          .sort((a, b) => a.day_number - b.day_number)
          .map(d => ({
            planId: p.id,
            planName: p.name,
            dayId: d.id,
            dayName: d.name || t('custom_plan.day_prefix', { n: d.day_number }),
          })));
      setDays(rows);
    })();
    return () => { cancelled = true; };
  }, [user, t]);

  // Nabídka se posílá jen při skutečné změně — jinak by každý render appky
  // budil hodinky.
  const lastSentRef = useRef<string | null>(null);
  useEffect(() => {
    const menu = buildWatchMenu({
      resumeLabel: pausedWorkout
        ? `${t('custom_plan.continue_workout')}: ${pausedWorkout.planName}`
        : null,
      hasPlanWorkout: true,
      planLabel: t('home.today_workout'),
      customDays: days,
    });
    const serialized = JSON.stringify(menu);
    if (serialized === lastSentRef.current) return;
    lastSentRef.current = serialized;
    void updateWatchMenu(menu);
  }, [pausedWorkout, days, t]);

  // Listener se připojuje jen při mountu, ale musí volat aktuální closure —
  // jinak by routoval podle zastaralého profilu nebo rozdělaného tréninku.
  const startRef = useRef<(a: WatchAction) => void>(() => {});
  startRef.current = (a: WatchAction) => {
    if (a.type !== 'startWorkout') return;
    if (a.kind === 'resume') {
      if (pausedWorkout) navigate(`/custom-workout/${pausedWorkout.planId}?resume=true`);
      else navigate('/training?resume=true');
      return;
    }
    if (a.kind === 'plan') {
      navigate('/training?start=true');
      return;
    }
    if (a.kind === 'custom' && a.planId && a.dayId) {
      // Bez uložené posilovny telefon ukáže výběr — hodinky na to nemají vliv.
      const gym = profile?.selected_gym_id;
      const query = gym ? `?gym=${gym}&day=${a.dayId}` : `?day=${a.dayId}`;
      navigate(`/custom-workout/${a.planId}${query}`);
    }
  };

  useEffect(() => {
    const off = addWatchActionListener(a => startRef.current(a));
    return off;
  }, []);
}
