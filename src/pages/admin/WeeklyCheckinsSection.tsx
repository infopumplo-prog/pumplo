import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { HeartPulse } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { aggregateCheckinsByWeek, addDays, type CheckinRow } from '@/lib/weeklyCheckin';

// Týdenní check-iny (feedback 13. 10.): průměr nálady/tréninků po týdnech + volné texty.
// Čtení všech řádků povoluje RLS jen adminům (has_role admin).

const WeeklyCheckinsSection = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('weekly_checkins')
      .select('id, week_start, mood, training, hardest, app_feedback, created_at')
      .order('week_start', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) console.error('Error fetching weekly checkins:', error);
        setRows((data ?? []) as CheckinRow[]);
        setLoading(false);
      });
  }, []);

  const weeks = useMemo(() => aggregateCheckinsByWeek(rows), [rows]);
  const fmtDay = (iso: string) => format(new Date(`${iso}T12:00:00`), 'd. M.');

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <HeartPulse className="w-5 h-5 text-primary" />
        {t('admin.checkins_title')}
      </h2>
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : weeks.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t('admin.checkins_empty')}</CardContent></Card>
      ) : (
        weeks.map((w) => (
          <Card key={w.weekStart}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold">{fmtDay(w.weekStart)} – {fmtDay(addDays(w.weekStart, 6))}</span>
                <span className="text-sm text-muted-foreground">
                  {t('admin.checkins_count', { count: w.count })} · {t('admin.checkins_avg_mood')} <strong className="text-foreground">{w.avgMood}</strong> · {t('admin.checkins_avg_training')} <strong className="text-foreground">{w.avgTraining}</strong>
                </span>
              </div>
            </CardHeader>
            {w.texts.length > 0 && (
              <CardContent className="space-y-3">
                {w.texts.map((x) => (
                  <div key={x.id} className="text-sm space-y-1 border-l-2 border-primary/40 pl-3">
                    {x.hardest && <p><span className="text-muted-foreground">{t('admin.checkins_hardest')}:</span> {x.hardest}</p>}
                    {x.appFeedback && <p><span className="text-muted-foreground">{t('admin.checkins_app')}:</span> {x.appFeedback}</p>}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
};

export default WeeklyCheckinsSection;
