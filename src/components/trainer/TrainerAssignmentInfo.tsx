import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { CalendarRange } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { TrainerPlanBadge } from '@/components/trainer/TrainerPlanBadge';
import { useAssignmentProgress, useTrainerAssignments } from '@/hooks/useTrainerAssignments';
import { assignmentEndDate, assignmentLastDay, progressPercent } from '@/lib/trainerClient';

// Detail plánu: štítek „Od trenéra“, období přiřazení a plnění. Plán se nijak nepřepíná.
export const TrainerAssignmentInfo = ({ planId }: { planId: string }) => {
  const { t, i18n } = useTranslation();
  const { assignmentForPlan, trainerNameFor } = useTrainerAssignments();
  const assignment = assignmentForPlan(planId);
  const { data: progress } = useAssignmentProgress(assignment?.id);
  if (!assignment) return null;

  const locale = i18n.language === 'en' ? enUS : cs;
  const fmt = (iso: string | null) => {
    if (!iso) return '';
    try { return format(parseISO(iso), 'd. M. yyyy', { locale }); } catch { return iso; }
  };
  // end_date je výlučný (první den po plánu); klient vidí poslední den plánu.
  const lastDay = assignmentLastDay(progress?.end_date ?? assignmentEndDate(assignment.start_date, assignment.weeks));
  const target = progress?.target_sessions ?? assignment.weeks * assignment.sessions_per_week;
  const done = progress?.done_sessions ?? null;
  const pct = progress?.progress_pct ?? (done !== null ? progressPercent(done, target) : null);

  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
      <TrainerPlanBadge trainerName={trainerNameFor(assignment)} />
      <p className="flex items-center gap-1.5 text-sm text-foreground">
        <CalendarRange className="w-4 h-4 text-primary shrink-0" />
        {t('trainer_client.assignment_period', { start: fmt(assignment.start_date), end: fmt(lastDay) })}
      </p>
      {done !== null && pct !== null && (
        <div className="space-y-1.5">
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {t('trainer_client.assignment_progress', { done, target })} · {pct} %
          </p>
        </div>
      )}
    </div>
  );
};

export default TrainerAssignmentInfo;
