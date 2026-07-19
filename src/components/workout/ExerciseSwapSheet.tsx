import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dumbbell, Info } from 'lucide-react';
import { getVideoThumbUrl } from '@/lib/videoUtils';
import type { SwapCandidate } from '@/lib/exerciseSwap';

interface ExerciseSwapSheetProps {
  // null = closed. A (possibly empty) array = open.
  options: SwapCandidate[] | null;
  onPick: (candidate: SwapCandidate) => void;
  onClose: () => void;
  onShowInfo: (exerciseId: string) => void;
}

// Hold-to-pick sheet listing every valid slot alternative (thumbnail + name +
// ⓘ). Shared by the generated workout player, the custom-plan builder and custom
// playback so all three present swaps identically.
export const ExerciseSwapSheet = ({ options, onPick, onClose, onShowInfo }: ExerciseSwapSheetProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  return (
    <AnimatePresence>
      {options && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-[81] bg-card rounded-t-3xl max-h-[70vh] flex flex-col safe-bottom"
          >
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-bold">{t('workout.swap_pick_title')}</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto pb-8">
              {options.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-muted-foreground">{t('workout.no_replacement')}</p>
              ) : options.map(c => {
                const thumb = getVideoThumbUrl(c.video_path);
                return (
                  <div key={c.id} className="w-full flex items-center gap-1 pr-3 hover:bg-muted transition-colors">
                    <button
                      onClick={() => { onClose(); onPick(c); }}
                      className="flex-1 min-w-0 flex items-center gap-3 pl-5 py-2.5 text-left"
                    >
                      <div className="shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <span className="text-sm font-medium truncate">{(isEn && c.name_en) ? c.name_en : c.name}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onShowInfo(c.id); }}
                      className="p-2.5 rounded-xl text-muted-foreground shrink-0"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExerciseSwapSheet;
