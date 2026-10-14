import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Bike, Building2, Cable, Check, CircleDot, Cog, Columns2, Dumbbell, Footprints,
  GripHorizontal, Link, Loader2, PersonStanding, RectangleHorizontal, Weight, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ALL_EQUIPMENT, EQUIPMENT_GROUPS, sanitizeCustomEquipment, toggleEquipment,
  type EquipmentGroup, type EquipmentSection,
} from '@/lib/customEquipment';

const ICONS: Record<string, LucideIcon> = {
  PersonStanding, Dumbbell, Weight, Cable, GripHorizontal, RectangleHorizontal, Link, CircleDot,
  Columns2, Footprints, Cog, Bike,
};

interface CustomEquipmentPickerProps {
  initial?: string[] | null;
  onSave: (equipment: string[]) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

/**
 * Výběr vlastního vybavení pro trénink bez posilovny (feedback 13. 10.:
 * „Nejsem v žádné z těchto posiloven"). Celoobrazovkový, nad GymSelectorem.
 */
export const CustomEquipmentPicker = ({ initial, onSave, onCancel, isSaving }: CustomEquipmentPickerProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(() => {
    const clean = sanitizeCustomEquipment(initial);
    return clean.length > 0 ? clean : ['bodyweight'];
  });
  const isAll = selected.includes(ALL_EQUIPMENT);
  const toggle = (id: string) => setSelected(prev => toggleEquipment(prev, id));

  const renderGroup = (g: EquipmentGroup) => {
    const Icon = ICONS[g.icon] ?? CircleDot;
    const checked = isAll || selected.includes(g.id);
    return (
      <button
        key={g.id}
        type="button"
        onClick={() => toggle(g.id)}
        aria-pressed={checked}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
          checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
          isAll && 'opacity-60',
        )}
      >
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          checked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{t(`nogym.eq_${g.id}`)}</p>
          <p className="text-xs text-muted-foreground truncate">{t(`nogym.eq_${g.id}_desc`)}</p>
        </div>
        <div className={cn(
          'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0',
          checked ? 'border-primary bg-primary' : 'border-muted-foreground/50',
        )}>
          {checked && <Check className="w-4 h-4 text-primary-foreground" />}
        </div>
      </button>
    );
  };

  const section = (id: EquipmentSection) => (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
        {t(`nogym.section_${id}`)}
      </h2>
      {EQUIPMENT_GROUPS.filter(g => g.section === id).map(renderGroup)}
    </div>
  );

  const count = isAll ? EQUIPMENT_GROUPS.length : selected.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[210] bg-background flex flex-col"
    >
      <div className="flex items-start gap-2 px-4 pb-4 border-b border-border" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label={t('nogym.back_to_gyms')} className="shrink-0 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('nogym.picker_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('nogym.picker_subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-32">
        <button
          type="button"
          onClick={() => toggle(ALL_EQUIPMENT)}
          aria-pressed={isAll}
          className={cn(
            'w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',
            isAll ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40',
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            isAll ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}>
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{t('nogym.all')}</p>
            <p className="text-xs text-muted-foreground">{t('nogym.all_desc')}</p>
          </div>
          {isAll && <Check className="w-5 h-5 text-primary shrink-0" />}
        </button>

        {section('home')}
        {section('gym')}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <Button
          size="lg"
          className="w-full gap-2"
          disabled={selected.length === 0 || isSaving}
          onClick={() => onSave(sanitizeCustomEquipment(selected))}
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {selected.length > 0 ? t('nogym.save_count', { count }) : t('nogym.save')}
        </Button>
      </div>
    </motion.div>
  );
};
