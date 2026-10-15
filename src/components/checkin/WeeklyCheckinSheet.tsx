import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Dumbbell, Flame, Scale, TrendingDown, TrendingUp, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatistics } from '@/hooks/useStatistics';
import { cn } from '@/lib/utils';
import { CHECKIN_TEXT_MAX, clampText, parseWeightKg, recordsInWeek, sanitizeWeightInput, weekRange, weightChange } from '@/lib/weeklyCheckin';

// Týdenní check-in (feedback 13. 10.): souhrn týdne + 2 hodnocení 1–5 + 2 volné texty.

interface WeeklyCheckinSheetProps {
  open: boolean;
  weekStart: string;
  trainingDaysCount: number;
  onSubmitted: (weekStart: string) => void;
  onSkip: () => void; // „Přeskočit" — pro tento týden už neukazovat
  onLater: () => void; // zavřeno gestem — znovu při dalším otevření appky
}

const MOOD_EMOJI = ['😫', '😕', '😐', '🙂', '😄'];

const RatingRow = ({ value, onChange, emoji, label }: {
  value: number; onChange: (v: number) => void; emoji?: string[]; label: string;
}) => (
  <div className="flex gap-2" role="radiogroup" aria-label={label}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        role="radio"
        aria-checked={value === n}
        onClick={() => onChange(n)}
        className={cn(
          'flex-1 h-12 rounded-xl border text-lg font-semibold transition-colors',
          value === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-foreground',
        )}
      >
        {emoji ? emoji[n - 1] : n}
      </button>
    ))}
  </div>
);

const WeekSummary = ({ weekStart, trainingDaysCount }: { weekStart: string; trainingDaysCount: number }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { stats } = useStatistics();
  const [week, setWeek] = useState<{ workouts: number; sets: number; kg: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const { from, to } = weekRange(weekStart);
    supabase
      .from('workout_sessions')
      .select('total_sets, total_weight_kg')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('started_at', from.toISOString())
      .lt('started_at', to.toISOString())
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data ?? [];
        setWeek({
          workouts: rows.length,
          sets: rows.reduce((a, r) => a + (r.total_sets || 0), 0),
          kg: Math.round(rows.reduce((a, r) => a + (Number(r.total_weight_kg) || 0), 0)),
        });
      });
    return () => { cancelled = true; };
  }, [user, weekStart]);

  const records = useMemo(
    () => (stats ? recordsInWeek(stats.personalRecords, weekStart) : []),
    [stats, weekStart],
  );
  const isEn = i18n.language === 'en';

  return (
    <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xl font-bold">
            {week ? week.workouts : '–'}{trainingDaysCount > 0 && <span className="text-muted-foreground text-sm">/{trainingDaysCount}</span>}
          </div>
          <div className="text-xs text-muted-foreground">{t('checkin.summary_workouts')}</div>
        </div>
        <div>
          <div className="text-xl font-bold">{week ? week.sets : '–'}</div>
          <div className="text-xs text-muted-foreground">{t('checkin.summary_sets')}</div>
        </div>
        <div>
          <div className="text-xl font-bold">{week ? week.kg.toLocaleString(isEn ? 'en-US' : 'cs-CZ') : '–'}</div>
          <div className="text-xs text-muted-foreground">{t('checkin.summary_kg')}</div>
        </div>
      </div>

      {stats && stats.streak.current > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Flame className="w-4 h-4 text-primary" />
          <span>{t('checkin.streak', { count: stats.streak.current })}</span>
        </div>
      )}

      {records.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="w-4 h-4 text-primary" />
            {t('checkin.new_records', { count: records.length })}
          </div>
          <ul className="text-sm text-muted-foreground space-y-0.5">
            {records.slice(0, 4).map((r) => (
              <li key={r.exerciseId}>
                {(isEn && r.exerciseNameEn) || r.exerciseName}: {r.previousMax} → <span className="text-foreground font-medium">{r.maxWeight} kg</span>
              </li>
            ))}
          </ul>
        </div>
      ) : stats ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Dumbbell className="w-4 h-4" />
          {t('checkin.no_records')}
        </div>
      ) : null}
    </div>
  );
};

const WeeklyCheckinSheet = ({ open, weekStart, trainingDaysCount, onSubmitted, onSkip, onLater }: WeeklyCheckinSheetProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [mood, setMood] = useState(0);
  const [training, setTraining] = useState(0);
  const [hardest, setHardest] = useState('');
  const [appFeedback, setAppFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // Váha (David 15. 10.): předvyplní se poslední známá, ukáže se změna proti minulému check-inu.
  const [weightInput, setWeightInput] = useState('');
  const [previousWeight, setPreviousWeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<string | null>(null);

  // Nový týden = čistý formulář
  useEffect(() => {
    setMood(0); setTraining(0); setHardest(''); setAppFeedback(''); setDone(false); setWeightInput('');
  }, [weekStart]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const [{ data: last }, { data: profile }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('weekly_checkins').select('weight_kg, week_start')
          .eq('user_id', user.id).lt('week_start', weekStart).not('weight_kg', 'is', null)
          .order('week_start', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('user_profiles').select('weight_kg, primary_goal').eq('user_id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const prev = (last?.weight_kg ?? profile?.weight_kg ?? null) as number | null;
      setPreviousWeight(prev != null ? Number(prev) : null);
      setGoal((profile?.primary_goal as string | null) ?? null);
      setWeightInput(w => w || (prev != null ? String(prev).replace('.', ',') : ''));
    })().catch(err => console.error('[weeklyCheckin] weight load failed', err));
    return () => { cancelled = true; };
  }, [open, user, weekStart]);

  const weightKg = parseWeightKg(weightInput);
  const change = weightChange(previousWeight, weightKg, goal);

  const submit = async () => {
    if (!user || !mood || !training) return;
    setSaving(true);
    const { error } = await supabase.from('weekly_checkins').upsert({
      user_id: user.id,
      week_start: weekStart,
      mood,
      training,
      hardest: clampText(hardest),
      app_feedback: clampText(appFeedback),
      weight_kg: weightKg,
    }, { onConflict: 'user_id,week_start' });
    // Aktuální váha i do profilu (plán a statistiky počítají s profilem); neblokuje check-in.
    if (!error && weightKg != null) {
      supabase.from('user_profiles').update({ weight_kg: weightKg }).eq('user_id', user.id)
        .then(({ error: e }) => { if (e) console.error('[weeklyCheckin] profile weight not saved', e); });
    }
    setSaving(false);
    if (error) {
      console.error('[weeklyCheckin] save failed', error);
      toast.error(t('checkin.save_error'));
      return;
    }
    setDone(true);
    setTimeout(() => onSubmitted(weekStart), 1200);
  };

  return (
    // Celá obrazovka místo vysouvacího panelu: vaul Drawer se v iOS s otevřenou
    // klávesnicí rozjel pod stavovou lištu (David 15. 10.). Obsah se tu jen posouvá.
    open ? createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
      className="fixed inset-0 z-[150] bg-background overflow-y-auto overscroll-contain"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
        {!done && (
          <button
            type="button"
            onClick={onLater}
            aria-label={t('checkin.close')}
            className="absolute right-3 w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground active:scale-95 active:bg-muted"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="w-full px-5 pt-14">
          {done ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <h2 id="checkin-title" className="text-xl font-bold">{t('checkin.thanks_title')}</h2>
              <p className="text-sm text-muted-foreground">{t('checkin.thanks_body')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 id="checkin-title" className="text-xl font-bold">{t('checkin.title')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('checkin.subtitle')}</p>
              </div>

              {open && <WeekSummary weekStart={weekStart} trainingDaysCount={trainingDaysCount} />}

              <div className="space-y-2">
                <p className="text-sm font-semibold">{t('checkin.q_mood')}</p>
                <RatingRow value={mood} onChange={setMood} emoji={MOOD_EMOJI} label={t('checkin.q_mood')} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">{t('checkin.q_training')}</p>
                <RatingRow value={training} onChange={setTraining} label={t('checkin.q_training')} />
                <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                  <span>{t('checkin.scale_low')}</span><span>{t('checkin.scale_high')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="checkin-weight" className="text-sm font-semibold flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-primary" />
                  {t('checkin.q_weight')} <span className="font-normal text-muted-foreground">({t('checkin.optional')})</span>
                </label>
                <div className="flex items-center gap-3">
                  {/* Pole přes celou šířku, změna vpravo (David 15. 10.: „ať tam není tolik prázdného místa“) */}
                  <div className="relative flex-1 min-w-0">
                    <Input
                      id="checkin-weight"
                      inputMode="decimal"
                      value={weightInput}
                      pattern="[0-9]*[.,]?[0-9]?"
                      maxLength={5}
                      onChange={(e) => setWeightInput(sanitizeWeightInput(e.target.value))}
                      placeholder={t('onboarding.example_value', { value: '75,5' })}
                      className="h-12 pr-10 text-lg font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
                  </div>
                  {change && change.delta !== 0 ? (
                    <span className={cn(
                      'shrink-0 inline-flex items-center gap-1 text-sm font-semibold rounded-full px-3 py-1.5',
                      change.trend === 'good' && 'bg-green-500/15 text-green-600 dark:text-green-400',
                      change.trend === 'bad' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      change.trend === 'neutral' && 'bg-muted text-foreground',
                    )}>
                      {change.delta < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      {change.delta > 0 ? '+' : '−'}{Math.abs(change.delta).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} kg
                    </span>
                  ) : change ? (
                    <span className="shrink-0 text-sm text-muted-foreground">{t('checkin.weight_same')}</span>
                  ) : null}
                </div>
                {previousWeight != null && (
                  <p className="text-xs text-muted-foreground">
                    {t('checkin.weight_previous', { value: previousWeight.toLocaleString('cs-CZ', { maximumFractionDigits: 1 }) })}
                  </p>
                )}
                {weightInput.trim() && weightKg == null && (
                  <p className="text-xs text-destructive">{t('checkin.weight_invalid')}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">{t('checkin.q_hardest')} <span className="font-normal text-muted-foreground">({t('checkin.optional')})</span></p>
                <Textarea
                  value={hardest}
                  maxLength={CHECKIN_TEXT_MAX}
                  onChange={(e) => setHardest(e.target.value)}
                  placeholder={t('checkin.q_hardest_placeholder')}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">{t('checkin.q_app')} <span className="font-normal text-muted-foreground">({t('checkin.optional')})</span></p>
                <Textarea
                  value={appFeedback}
                  maxLength={CHECKIN_TEXT_MAX}
                  onChange={(e) => setAppFeedback(e.target.value)}
                  placeholder={t('checkin.q_app_placeholder')}
                  rows={2}
                />
              </div>

              <div className="space-y-2 pt-1">
                <Button className="w-full h-12" disabled={!mood || !training || saving} onClick={submit}>
                  {saving ? t('checkin.saving') : t('checkin.submit')}
                </Button>
                <Button variant="ghost" className="w-full" onClick={onSkip}>
                  {t('checkin.skip')}
                </Button>
              </div>
            </div>
          )}
        </div>
    </div>,
    document.body) : null
  );
};

export default WeeklyCheckinSheet;
