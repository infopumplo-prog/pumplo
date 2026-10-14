import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Dumbbell, Flame, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatistics } from '@/hooks/useStatistics';
import { cn } from '@/lib/utils';
import { CHECKIN_TEXT_MAX, clampText, recordsInWeek, weekRange } from '@/lib/weeklyCheckin';

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

  // Nový týden = čistý formulář
  useEffect(() => {
    setMood(0); setTraining(0); setHardest(''); setAppFeedback(''); setDone(false);
  }, [weekStart]);

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
    }, { onConflict: 'user_id,week_start' });
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
    <Drawer open={open} onOpenChange={(next) => { if (!next && !done) onLater(); }}>
      <DrawerContent className="px-5 pb-6 max-h-[92dvh]">
        <div className="mx-auto w-full max-w-md pt-2 overflow-y-auto">
          {done ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <DrawerTitle className="text-xl font-bold">{t('checkin.thanks_title')}</DrawerTitle>
              <p className="text-sm text-muted-foreground">{t('checkin.thanks_body')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <DrawerTitle className="text-xl font-bold">{t('checkin.title')}</DrawerTitle>
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
      </DrawerContent>
    </Drawer>
  );
};

export default WeeklyCheckinSheet;
