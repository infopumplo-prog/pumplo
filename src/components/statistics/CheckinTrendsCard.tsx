import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ClipboardCheck, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { OPEN_CHECKIN_EVENT, buildCheckinTrend, weightChange, type CheckinTrendRow } from '@/lib/weeklyCheckin';

// Statistiky z týdenních check-inů: váha v čase + průměrná nálada a hodnocení tréninků (David 15. 10.).
const CheckinTrendsCard = ({ goal }: { goal?: string | null }) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const { user } = useAuth();
  const [rows, setRows] = useState<CheckinTrendRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('weekly_checkins')
      .select('week_start, mood, training, weight_kg')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(26)
      .then(({ data, error }: { data: CheckinTrendRow[] | null; error: unknown }) => {
        if (cancelled) return;
        if (error) console.error('[stats] check-ins not loaded', error);
        setRows(data ?? []);
      });
    return () => { cancelled = true; };
  }, [user]);

  const trend = useMemo(() => buildCheckinTrend(rows ?? []), [rows]);
  const weightPoints = trend.points
    .filter(p => p.weight != null)
    .map(p => ({ label: format(parseISO(p.week), 'd.M.', { locale: isEn ? enUS : cs }), weight: p.weight }));
  const change = weightChange(trend.firstWeight, trend.lastWeight, goal);
  const fmt = (n: number) => n.toLocaleString(isEn ? 'en-US' : 'cs-CZ', { maximumFractionDigits: 1 });

  if (rows === null) return null;

  return (
    <Card>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          {t('stats.checkin_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {rows.length === 0 ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('stats.checkin_empty')}</p>
            <Button size="sm" onClick={() => window.dispatchEvent(new Event(OPEN_CHECKIN_EVENT))}>
              {t('stats.checkin_fill')}
            </Button>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Scale className="w-4 h-4" /> {t('stats.checkin_weight')}
                </div>
                {trend.lastWeight != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tabular-nums">{fmt(trend.lastWeight)} kg</span>
                    {change && change.delta !== 0 && (
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-1',
                        change.trend === 'good' && 'bg-green-500/15 text-green-600 dark:text-green-400',
                        change.trend === 'bad' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        change.trend === 'neutral' && 'bg-muted text-foreground',
                      )}>
                        {change.delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        {change.delta > 0 ? '+' : '−'}{fmt(Math.abs(change.delta))} kg
                      </span>
                    )}
                  </div>
                )}
              </div>
              {weightPoints.length >= 2 ? (
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={weightPoints} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="checkin-weight-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      formatter={(v: number) => [`${fmt(v)} kg`, t('stats.checkin_weight')]}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2.5}
                      fill="url(#checkin-weight-gradient)" dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">{t('stats.checkin_weight_more')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{t('stats.checkin_avg_mood')}</p>
                <p className="text-lg font-bold tabular-nums">{trend.avgMood != null ? `${fmt(trend.avgMood)} / 5` : '—'}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{t('stats.checkin_avg_training')}</p>
                <p className="text-lg font-bold tabular-nums">{trend.avgTraining != null ? `${fmt(trend.avgTraining)} / 5` : '—'}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('stats.checkin_count', { count: rows.length })}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CheckinTrendsCard;
