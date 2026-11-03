// Dny vlastního tréninku v kruhu A → B → C (feedback 13. 10.): čipy dnů,
// „+ Přidat den“, menu dne (přejmenovat / posunout / smazat s potvrzením).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLongPress } from '@/lib/useLongPress';
import { cycleLetter, isGenericDayName } from '@/lib/customPlanCycle';
import { localizedText } from '@/lib/publicWorkouts';
import { cn } from '@/lib/utils';

export interface ChipDay {
  id: string;
  day_number: number;
  name: string | null;
  name_en?: string | null;
  exerciseCount: number;
}

/** Vlastní název dne, nebo null u prázdného / automatického („Den 1“). */
export const customDayName = (day: Pick<ChipDay, 'name' | 'name_en'>, lang: string): string | null => {
  const text = localizedText(day.name, day.name_en, lang)?.trim() ?? null;
  return isGenericDayName(text) ? null : text;
};

/** Popisek dne: vlastní název, jinak „Den B“ podle pozice v kruhu. */
export const useDayLabel = () => {
  const { t, i18n } = useTranslation();
  return (day: Pick<ChipDay, 'name' | 'name_en'>, index: number) => {
    const custom = customDayName(day, i18n.language);
    return custom || t('custom_plan.day_letter_name', { letter: cycleLetter(index) });
  };
};

interface DayChipProps {
  day: ChipDay;
  index: number;
  active: boolean;
  isNext: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}

const DayChip = ({ day, index, active, isNext, onSelect, onLongPress }: DayChipProps) => {
  const { t, i18n } = useTranslation();
  const { handlers, wasLongPress } = useLongPress(onLongPress);
  const custom = customDayName(day, i18n.language);
  const letter = cycleLetter(index);
  return (
    <button
      type="button"
      {...handlers}
      onClick={() => { if (!wasLongPress()) onSelect(); }}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      aria-pressed={active}
      className={cn(
        'relative shrink-0 flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full border text-sm font-semibold transition-colors select-none',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-border hover:border-primary/50',
        day.exerciseCount === 0 && !active && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
          active ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary',
        )}
      >
        {letter}
      </span>
      <span className="max-w-[9rem] truncate">{custom || t('custom_plan.day_letter_name', { letter })}</span>
      {isNext && (
        <span
          className={cn(
            'absolute -top-2 right-1 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide',
            active ? 'bg-background text-primary border border-primary' : 'bg-primary text-primary-foreground',
          )}
        >
          {t('custom_plan.next_badge')}
        </span>
      )}
    </button>
  );
};

interface Props {
  days: ChipDay[];
  activeDayId: string | null;
  nextDayId: string | null;
  onSelect: (dayId: string) => void;
  onAdd: () => void;
  onRename: (dayId: string, name: string) => void;
  onMove: (dayId: string, direction: -1 | 1) => void;
  onDelete: (dayId: string) => void;
  adding?: boolean;
}

const CustomPlanDayChips = ({ days, activeDayId, nextDayId, onSelect, onAdd, onRename, onMove, onDelete, adding }: Props) => {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeIndex = days.findIndex(d => d.id === activeDayId);
  const active = activeIndex >= 0 ? days[activeIndex] : null;

  // Vybraný čip vždy na očích (po přidání dne je vpravo za okrajem).
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView?.({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeDayId, days.length]);

  const startRename = () => {
    if (!active) return;
    setDraft(dayLabel(active, activeIndex));
    setEditing(true);
  };
  const saveRename = () => {
    if (active && draft.trim() && draft.trim() !== dayLabel(active, activeIndex)) onRename(active.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Repeat className="w-3.5 h-3.5" />
        {t('custom_plan.cycle_title')}
      </div>

      <div ref={scrollRef} className="-mx-6 px-6 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {days.map((day, index) => (
          <DayChip
            key={day.id}
            day={day}
            index={index}
            active={day.id === activeDayId}
            isNext={day.id === nextDayId}
            onSelect={() => { setEditing(false); onSelect(day.id); }}
            onLongPress={() => { setEditing(false); onSelect(day.id); setMenuOpen(true); }}
          />
        ))}
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-full border-2 border-dashed border-border text-sm font-semibold text-primary hover:border-primary/50 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {t('custom_plan.add_day')}
        </button>
      </div>

      {active && (
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              maxLength={40}
              className="flex-1 min-w-0 bg-transparent text-lg font-bold outline-none border-b-2 border-primary"
            />
          ) : (
            <button
              type="button"
              onClick={startRename}
              className="flex-1 min-w-0 text-left text-lg font-bold truncate hover:text-primary transition-colors"
            >
              <span className="text-primary mr-1.5">{cycleLetter(activeIndex)}</span>
              {dayLabel(active, activeIndex)}
            </button>
          )}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('custom_plan.day_menu')}
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors shrink-0"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem onSelect={() => setTimeout(startRename, 0)}>
                <Pencil className="w-4 h-4 mr-2" />
                {t('custom_plan.day_rename')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={activeIndex <= 0} onSelect={() => onMove(active.id, -1)}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                {t('custom_plan.day_move_left')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={activeIndex >= days.length - 1} onSelect={() => onMove(active.id, 1)}>
                <ChevronRight className="w-4 h-4 mr-2" />
                {t('custom_plan.day_move_right')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('custom_plan.day_delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('custom_plan.cycle_hint')}</p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('custom_plan.day_delete_title', { day: active ? dayLabel(active, activeIndex) : '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('custom_plan.day_delete_body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('custom_plan.cancel_btn')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (active) onDelete(active.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('custom_plan.day_delete_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomPlanDayChips;
