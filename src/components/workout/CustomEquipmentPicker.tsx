import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  ArrowLeft, Bike, Cable, Check, Cog, Dumbbell, GripHorizontal, Loader2, Megaphone, Share2, Sparkles,
  RectangleHorizontal, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeCustomEquipment, type EquipmentGroupId } from '@/lib/customEquipment';

/**
 * Okruhy vybavení fitka (David 17. 10.): člověk, jehož posilovna v Pumplu ještě není,
 * řekne, co jeho fitko má — plán poskládáme z toho. Každý okruh = několik technických
 * skupin z customEquipment (ukládá se dál jako custom_equipment).
 * Režim „jen vlastní váha / doma" zatím není — na celé tréninky nemáme dost cviků (17. 10.).
 */
const GYM_AREAS: { id: string; icon: LucideIcon; groups: EquipmentGroupId[] }[] = [
  { id: 'free_weights', icon: Dumbbell, groups: ['dumbbells', 'kettlebell', 'barbell'] },
  { id: 'benches', icon: RectangleHorizontal, groups: ['bench', 'smith'] },
  { id: 'cables', icon: Cable, groups: ['cables'] },
  { id: 'machines', icon: Cog, groups: ['machines', 'leg_press'] },
  { id: 'bars', icon: GripHorizontal, groups: ['pull_up_bar'] },
  { id: 'cardio', icon: Bike, groups: ['cardio'] },
  { id: 'functional', icon: Sparkles, groups: ['bands', 'trx', 'accessories', 'bodyweight'] },
];

const SHARE_URL = 'https://pumplo.com';

interface CustomEquipmentPickerProps {
  initial?: string[] | null;
  onSave: (equipment: string[]) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

/** Okruh je vybraný, když uložené vybavení obsahuje všechny jeho skupiny (nebo „všechno"). */
const initialAreas = (initial?: string[] | null): string[] => {
  const clean = sanitizeCustomEquipment(initial);
  if (clean.includes('all')) return GYM_AREAS.map(a => a.id);
  return GYM_AREAS.filter(a => a.groups.every(g => clean.includes(g))).map(a => a.id);
};

export const CustomEquipmentPicker = ({ initial, onSave, onCancel, isSaving }: CustomEquipmentPickerProps) => {
  const { t } = useTranslation();
  const [areas, setAreas] = useState<string[]>(() => initialAreas(initial));
  const toggle = (id: string) => setAreas(prev => (prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]));

  const save = () => {
    const groups = Array.from(new Set(GYM_AREAS.filter(a => areas.includes(a.id)).flatMap(a => a.groups)));
    return onSave(sanitizeCustomEquipment(groups));
  };

  // „Řekni o nás ve svém fitku" — sdílení odkazu na Pumplo (nativně share sheet, jinak kopie).
  const shareWithGym = async () => {
    const text = t('nogym.share_text', { url: SHARE_URL });
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Pumplo', text, url: SHARE_URL });
      } else if (navigator.share) {
        await navigator.share({ title: 'Pumplo', text, url: SHARE_URL });
      } else {
        await navigator.clipboard.writeText(`${text} ${SHARE_URL}`);
        toast.success(t('nogym.share_copied'));
      }
    } catch {
      // zrušené sdílení není chyba
    }
  };

  // Portál do <body>: uvnitř stránky (PageTransition s transformací) by fixed vrstva zůstala
  // pod spodní lištou a tlačítkem feedbacku (David 17. 10.).
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-background flex flex-col"
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
        {/* Řekni o nás ve svém fitku */}
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">{t('nogym.tell_gym_title')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t('nogym.tell_gym_desc')}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full gap-2 bg-background" onClick={shareWithGym}>
            <Share2 className="w-4 h-4" />
            {t('nogym.tell_gym_button')}
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold px-1">{t('nogym.areas_title')}</h2>
          {GYM_AREAS.map(a => {
            const checked = areas.includes(a.id);
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                aria-pressed={checked}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.99]',
                  checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className={cn(
                  'w-11 h-11 rounded-lg flex items-center justify-center shrink-0',
                  checked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{t(`nogym.area_${a.id}`)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(`nogym.area_${a.id}_desc`)}</p>
                </div>
                <div className={cn(
                  'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0',
                  checked ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                )}>
                  {checked && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <Button size="lg" className="w-full gap-2" disabled={areas.length === 0 || isSaving} onClick={save}>
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {areas.length > 0 ? t('nogym.save_count', { count: areas.length }) : t('nogym.save_pick')}
        </Button>
      </div>
    </motion.div>,
    document.body,
  );
};
