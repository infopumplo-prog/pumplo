// Fáze plánu od trenéra (migrace 20261029): časová osa „Teď: fáze · týden n z N“,
// dny ostatních fází sbalené pod „Další fáze“ / „Předchozí fáze“ a texty progrese.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Layers, TrendingUp } from 'lucide-react';
import { cycleLetter } from '@/lib/customPlanCycle';
import { localizedText } from '@/lib/publicWorkouts';
import { sortPhases, type ExerciseProgression, type PlanPhase, type PlanSchedule } from '@/lib/planPhases';
import { customDayName } from '@/components/workout/CustomPlanDayChips';
import { cn } from '@/lib/utils';

export const usePhaseName = () => {
  const { i18n } = useTranslation();
  return (phase: Pick<PlanPhase, 'name' | 'name_en'>) => localizedText(phase.name, phase.name_en, i18n.language) ?? phase.name;
};

/** „4 série · 8 opakování · 60 kg“ z pravidla progrese (null = beze změny, vynechá se). */
export const useProgressionText = () => {
  const { t } = useTranslation();
  const setsKey = (n: number) =>
    n === 1 ? 'trainer_client.progression_sets_1' : n >= 2 && n <= 4 ? 'trainer_client.progression_sets_few' : 'trainer_client.progression_sets_many';
  const changes = (r: Pick<ExerciseProgression, 'sets' | 'reps' | 'weight_kg'>) => {
    const parts: string[] = [];
    if (r.sets != null) parts.push(t(setsKey(r.sets), { count: r.sets }));
    if (r.reps != null) parts.push(t('trainer_client.progression_reps', { count: r.reps }));
    if (r.weight_kg != null) parts.push(t('trainer_client.progression_weight', { kg: Number(r.weight_kg) }));
    return parts.join(' · ');
  };
  return {
    changes,
    fromWeek: (r: ExerciseProgression) => {
      const c = changes(r);
      return c ? t('trainer_client.progression_from_week', { week: r.from_week, changes: c }) : null;
    },
    thisWeek: (r: Pick<ExerciseProgression, 'sets' | 'reps' | 'weight_kg'>) => {
      const c = changes(r);
      return c ? t('trainer_client.progression_this_week', { changes: c }) : null;
    },
  };
};

/** Nápověda progrese u cviku v detailu plánu. */
export const ProgressionHints = ({ hints }: { hints: string[] }) =>
  hints.length ? (
    <div className="ml-7 mt-1 space-y-0.5">
      {hints.map((h) => (
        <p key={h} className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>{h}</span>
        </p>
      ))}
    </div>
  ) : null;

interface TimelineProps {
  phases: PlanPhase[];
  schedule: PlanSchedule;
}

/** Kompaktní osa fází + „Teď: …“. Bez fází se nevykreslí. */
export const PlanPhaseTimeline = ({ phases, schedule }: TimelineProps) => {
  const { t } = useTranslation();
  const phaseName = usePhaseName();
  const sorted = sortPhases(phases);
  if (!sorted.length) return null;
  const { week, totalWeeks, finished, phase } = schedule;
  const span = Math.max(totalWeeks ?? 0, ...sorted.map(p => p.end_week), week);

  const headline = phase
    ? totalWeeks
      ? t('trainer_client.phase_now', { phase: phaseName(phase), week, total: totalWeeks })
      : t('trainer_client.phase_now_no_total', { phase: phaseName(phase), week })
    : totalWeeks
      ? t('trainer_client.phase_week_of', { week, total: totalWeeks })
      : t('trainer_client.phase_week', { week });

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Layers className="w-4 h-4 text-primary shrink-0" />
        <span className="min-w-0">{headline}</span>
      </p>
      {/* Osa po týdnech: šířka fáze podle počtu týdnů, aktuální týden jako značka. */}
      <div className="relative h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        {sorted.map(p => (
          <div
            key={p.id}
            className={cn('absolute top-0 h-full rounded-full', p.id === phase?.id ? 'bg-primary' : 'bg-primary/30')}
            style={{
              left: `${((p.start_week - 1) / span) * 100}%`,
              width: `calc(${((p.end_week - p.start_week + 1) / span) * 100}% - 2px)`,
            }}
          />
        ))}
      </div>
      <div className="relative h-1.5 -mt-1.5" aria-hidden="true">
        <div
          className="absolute top-0 w-1.5 h-1.5 rounded-full bg-foreground -translate-x-1/2"
          style={{ left: `${((week - 0.5) / span) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {sorted.map(p => (
          <span
            key={p.id}
            className={cn('text-xs', p.id === phase?.id ? 'font-semibold text-foreground' : 'text-muted-foreground')}
          >
            {phaseName(p)} · {p.start_week === p.end_week
              ? t('trainer_client.phase_weeks_single', { start: p.start_week })
              : t('trainer_client.phase_weeks', { start: p.start_week, end: p.end_week })}
          </span>
        ))}
      </div>
      {finished && <p className="text-xs text-muted-foreground">{t('trainer_client.phase_finished')}</p>}
    </div>
  );
};

interface OtherDay {
  id: string;
  name: string | null;
  name_en?: string | null;
  index: number;
  phase: PlanPhase;
}

interface OtherPhaseDaysProps {
  title: string;
  days: OtherDay[];
  selectedDayId: string | null;
  onSelect: (dayId: string) => void;
}

/** Sbalená skupina dnů jiných fází (výběr dne ho otevře v editoru). */
export const OtherPhaseDays = ({ title, days, selectedDayId, onSelect }: OtherPhaseDaysProps) => {
  const { t, i18n } = useTranslation();
  const phaseName = usePhaseName();
  const [open, setOpen] = useState(() => days.some(d => d.id === selectedDayId));
  if (!days.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <span>{title} ({days.length})</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1">
          {days.map(d => {
            const letter = cycleLetter(d.index);
            const custom = customDayName(d, i18n.language);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted transition-colors',
                  d.id === selectedDayId && 'bg-primary/10',
                )}
              >
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                  {letter}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">
                  {custom || t('custom_plan.day_letter_name', { letter })}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[45%]">{phaseName(d.phase)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
