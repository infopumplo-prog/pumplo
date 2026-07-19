import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { enterVideoFullscreen } from '@/lib/videoUtils';
import { ExerciseInfoContent } from './ExerciseInfoContent';

interface ExerciseInfoSheetProps {
  // null = closed. An exercise id = open + fetch that exercise's detail.
  exerciseId: string | null;
  onClose: () => void;
}

interface InfoData {
  name: string; nameEn: string | null; videoUrl: string | null; category: string;
  equipmentType: string | null; machineName: string | null;
  primaryMuscles: string[]; secondaryMuscles: string[];
  primaryMusclesEn: string[] | null; secondaryMusclesEn: string[] | null;
  description: string | null; setupInstructions: string | null;
  commonMistakes: string | null; tips: string | null;
}

// Exercise detail sheet opened from the swap sheet's ⓘ. Fetches its own data so
// every swap surface (generated player, custom builder, custom playback) can
// share it. Layered above the swap sheet (z-[85]/[86]).
export const ExerciseInfoSheet = ({ exerciseId, onClose }: ExerciseInfoSheetProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [info, setInfo] = useState<InfoData | null>(null);

  useEffect(() => {
    if (!exerciseId) { setInfo(null); return; }
    let cancelled = false;
    supabase
      .from('exercises')
      .select('name, name_en, category, equipment_type, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, video_path, description, setup_instructions, common_mistakes, tips, machines!exercises_machine_id_fkey(name)')
      .eq('id', exerciseId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const d = data as Record<string, unknown> & { machines?: { name?: string } | null };
        setInfo({
          name: d.name as string, nameEn: (d.name_en as string) || null, videoUrl: (d.video_path as string) || null,
          category: (d.category as string) || '', equipmentType: (d.equipment_type as string) || null,
          machineName: d.machines?.name || null,
          primaryMuscles: (d.primary_muscles as string[]) || [], secondaryMuscles: (d.secondary_muscles as string[]) || [],
          primaryMusclesEn: (d.primary_muscles_en as string[]) || null, secondaryMusclesEn: (d.secondary_muscles_en as string[]) || null,
          description: (d.description as string) || null, setupInstructions: (d.setup_instructions as string) || null,
          commonMistakes: (d.common_mistakes as string) || null, tips: (d.tips as string) || null,
        });
      });
    return () => { cancelled = true; };
  }, [exerciseId]);

  return (
    <AnimatePresence>
      {info && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-[86] bg-background rounded-t-3xl max-h-[85vh] flex flex-col safe-bottom"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <p className="text-base font-bold truncate">{(isEn && info.nameEn) ? info.nameEn : info.name}</p>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-8">
              {info.videoUrl ? (
                <div className="relative rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                  <video
                    src={info.videoUrl}
                    playsInline autoPlay loop muted preload="auto"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={(e) => enterVideoFullscreen(e.currentTarget.parentElement?.querySelector('video') ?? null)}
                    className="absolute bottom-2 right-2 z-10 p-2 rounded-lg bg-black/50 text-white active:scale-90 transition-transform"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">{t('workout.no_video')}</p>
                </div>
              )}
              <ExerciseInfoContent
                category={info.category}
                equipmentType={info.equipmentType}
                machineName={info.machineName}
                primaryMuscles={info.primaryMuscles}
                secondaryMuscles={info.secondaryMuscles}
                primaryMusclesEn={info.primaryMusclesEn}
                secondaryMusclesEn={info.secondaryMusclesEn}
                description={info.description}
                descriptionEn={null}
                setupInstructions={info.setupInstructions}
                setupInstructionsEn={null}
                commonMistakes={info.commonMistakes}
                commonMistakesEn={null}
                tips={info.tips}
                tipsEn={null}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExerciseInfoSheet;
