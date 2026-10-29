import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBodyWeights } from '@/hooks/useTrainerCheckins';
import { useInvalidateTrainerData } from '@/hooks/useTrainerAssignments';
import { deleteWeightEntry, upsertWeightEntry, type BodyWeightEntry, type WeightSource } from '@/lib/bodyWeight';
import { toLocalIsoDate } from '@/lib/trainerClient';
import { parseWeightKg, sanitizeWeightInput } from '@/lib/weeklyCheckin';
import FullscreenSheet from './FullscreenSheet';

const sourceKey: Record<WeightSource, string> = {
  manual: 'trainer_client.weight_source_manual',
  checkin: 'trainer_client.weight_source_checkin',
  apple_health: 'trainer_client.weight_source_apple_health',
  health_connect: 'trainer_client.weight_source_health_connect',
};

/** Den zápisu → okamžik: dnes = teď, jiný den = poledne (časová zóna nepřehodí datum). */
const measuredAtFor = (day: string): Date => (day === toLocalIsoDate() ? new Date() : new Date(`${day}T12:00:00`));

// Moje váha: ruční zápis + graf a seznam (body_weight_entries). Váhy z check-inu
// a ze Zdraví sem padají taky; mazat jde jen ruční zápis.
const BodyWeightSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const weights = useBodyWeights(open);
  const invalidate = useInvalidateTrainerData();
  const [input, setInput] = useState('');
  const [day, setDay] = useState(() => toLocalIsoDate());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const locale = i18n.language === 'en' ? enUS : cs;
  const kg = parseWeightKg(input);

  const chartData = useMemo(() => [...(weights.data ?? [])]
    .slice(0, 60)
    .reverse()
    .map((e) => ({ t: new Date(e.measured_at).getTime(), kg: e.weight_kg })), [weights.data]);

  const save = async () => {
    if (!user || kg == null || saving) return;
    setSaving(true);
    const { error } = await upsertWeightEntry(user.id, { source: 'manual', weightKg: kg, measuredAt: measuredAtFor(day) });
    setSaving(false);
    if (error) {
      console.warn('[weight] not saved', error);
      toast.error(t('trainer_client.weight_error'));
      return;
    }
    setInput('');
    toast.success(t('trainer_client.weight_saved'));
    await invalidate();
  };

  const remove = async (entry: BodyWeightEntry) => {
    setDeletingId(entry.id);
    const { error } = await deleteWeightEntry(entry.id);
    setDeletingId(null);
    if (error) { toast.error(t('trainer_client.weight_error')); return; }
    await invalidate();
  };

  const fmt = (iso: string, pattern: string) => { try { return format(parseISO(iso), pattern, { locale }); } catch { return iso; } };

  return (
    <FullscreenSheet open={open} onClose={onClose} closeLabel={t('trainer_client.ci_close')} labelledBy="body-weight-title">
      <div className="space-y-5">
        <h2 id="body-weight-title" className="text-xl font-bold pr-10">{t('trainer_client.weight_title')}</h2>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">{t('trainer_client.weight_add')}</p>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Input
                inputMode="decimal"
                aria-label={t('trainer_client.weight_input_label')}
                value={input}
                maxLength={5}
                onChange={(e) => setInput(sanitizeWeightInput(e.target.value))}
                placeholder="75,5"
                className="h-12 pr-10 text-lg font-semibold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
            </div>
            <Input
              type="date"
              aria-label={t('trainer_client.weight_date')}
              value={day}
              max={toLocalIsoDate()}
              onChange={(e) => setDay(e.target.value || toLocalIsoDate())}
              className="h-12 w-[150px] shrink-0"
            />
          </div>
          <Button className="w-full rounded-xl min-h-[44px] gap-2" disabled={kg == null || saving} onClick={() => void save()}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('trainer_client.weight_save')}
          </Button>
        </div>

        {weights.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
        ) : weights.isError ? (
          <p className="text-sm text-muted-foreground">{t('trainer_client.weight_load_error')}</p>
        ) : (weights.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('trainer_client.weight_empty')}</p>
        ) : (
          <>
            {chartData.length >= 2 && (
              <div className="h-40 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time"
                      tickFormatter={(v: number) => format(new Date(v), 'd. M.', { locale })} tick={{ fontSize: 11 }} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} width={36} tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(v: number) => format(new Date(v), 'd. M. yyyy', { locale })}
                      formatter={(v: number) => [`${String(v).replace('.', ',')} kg`, '']} />
                    <Line type="monotone" dataKey="kg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="bg-card border border-border rounded-2xl divide-y divide-border">
              {(weights.data ?? []).map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 min-h-[52px]">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold">{String(e.weight_kg).replace('.', ',')} kg</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmt(e.measured_at, 'd. M. yyyy')} · {t(sourceKey[e.source] ?? 'trainer_client.weight_source_manual')}
                    </span>
                  </span>
                  {e.source === 'manual' && (
                    <button
                      type="button"
                      aria-label={t('trainer_client.weight_delete')}
                      onClick={() => void remove(e)}
                      disabled={deletingId === e.id}
                      className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted disabled:opacity-50"
                    >
                      {deletingId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </FullscreenSheet>
  );
};

export default BodyWeightSheet;
