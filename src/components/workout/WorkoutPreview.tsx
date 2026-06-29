import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Play, Clock, Dumbbell, Flame, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { WorkoutExercise } from '@/lib/trainingGoals';
import { TRAINING_ROLE_NAMES } from '@/lib/trainingRoles';
import { CARDIO_ROLE_IDS } from '@/lib/bmiUtils';
import { supabase } from '@/integrations/supabase/client';
import { getSignedVideoUrl } from '@/lib/videoUtils';
import { WorkoutExitDialog } from './WorkoutExitDialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const SLOT_CATEGORY_COLORS: Record<string, string> = {
  main: 'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  isolation: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  core_or_compensatory: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  conditioning: 'bg-green-500/15 text-green-600 border-green-500/30',
};

interface ExerciseDetail {
  video_path: string | null;
  category: string | null;
  equipment_type: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  primary_muscles_en: string[] | null;
  secondary_muscles_en: string[] | null;
  difficulty: number | null;
  description: string | null;
  description_en: string | null;
  setup_instructions: string | null;
  setup_instructions_en: string | null;
  common_mistakes: string | null;
  common_mistakes_en: string | null;
  tips: string | null;
  tips_en: string | null;
}

interface WorkoutPreviewProps {
  exercises: WorkoutExercise[];
  dayLetter: string;
  dayName: string;
  estimatedDuration: number;
  gymId?: string;
  planId?: string;
  onStartWarmup: () => void;
  onClose: () => void;
  onPause?: () => void;
  onExercisesChange?: (exercises: WorkoutExercise[]) => void;
  isLoading?: boolean;
}

export const WorkoutPreview = ({
  exercises,
  dayLetter,
  dayName,
  estimatedDuration,
  gymId,
  planId,
  onStartWarmup,
  onClose,
  onPause,
  onExercisesChange,
  isLoading = false
}: WorkoutPreviewProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const navigate = useNavigate();

  const SLOT_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    main: { label: t('slot.main'), color: SLOT_CATEGORY_COLORS.main },
    secondary: { label: t('slot.secondary'), color: SLOT_CATEGORY_COLORS.secondary },
    isolation: { label: t('slot.isolation'), color: SLOT_CATEGORY_COLORS.isolation },
    core_or_compensatory: { label: t('slot.core'), color: SLOT_CATEGORY_COLORS.core_or_compensatory },
    conditioning: { label: t('slot.conditioning'), color: SLOT_CATEGORY_COLORS.conditioning },
  };
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<WorkoutExercise | null>(null);
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | null>(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [signedDetailVideoUrl, setSignedDetailVideoUrl] = useState<string | null>(null);

  // Fetch exercise detail when info drawer opens
  useEffect(() => {
    if (!selectedExercise?.exerciseId || !showInfoDrawer) return;
    setExerciseDetail(null);
    setSignedDetailVideoUrl(null);
    supabase
      .from('exercises')
      .select('video_path, category, equipment_type, primary_muscles, secondary_muscles, primary_muscles_en, secondary_muscles_en, difficulty, description, description_en, setup_instructions, setup_instructions_en, common_mistakes, common_mistakes_en, tips, tips_en')
      .eq('id', selectedExercise.exerciseId)
      .single()
      .then(({ data }) => {
        if (data) {
          setExerciseDetail(data as ExerciseDetail);
          getSignedVideoUrl((data as ExerciseDetail).video_path).then(url => setSignedDetailVideoUrl(url));
        }
      });
  }, [selectedExercise?.exerciseId, showInfoDrawer]);

  const handleSwapExercise = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (swappingIndex !== null || !gymId) return;
    setSwappingIndex(idx);

    try {
      const exercise = exercises[idx];
      if (!exercise) return;

      const roleId = exercise.roleId;
      const isCardio = CARDIO_ROLE_IDS.includes(roleId);
      const excludeIds = exercises.map(ex => ex.exerciseId).filter((id): id is string => !!id);

      const { data: gymMachines } = await supabase
        .from('gym_machines')
        .select('machine_id')
        .eq('gym_id', gymId);
      const machineIds = new Set((gymMachines || []).map(m => m.machine_id));

      let query = supabase
        .from('exercises')
        .select('id, name, name_en, primary_role, machine_id, equipment_type, category')
        .eq('allowed_phase', 'main');

      if (isCardio) {
        query = query.eq('category', 'cardio');
      } else {
        query = query.eq('primary_role', roleId);
      }

      const { data: candidates, error } = await query;
      if (error || !candidates?.length) {
        toast.error(t('workout.no_replacement'));
        return;
      }

      const valid = candidates.filter(c => {
        if (excludeIds.includes(c.id)) return false;
        if (c.machine_id && !machineIds.has(c.machine_id)) return false;
        return true;
      });

      if (valid.length === 0) {
        toast.error(t('workout.no_replacement'));
        return;
      }

      const pick = valid[Math.floor(Math.random() * valid.length)];

      let newMachineName: string | null = null;
      let newMachineNameEn: string | null = null;
      if (pick.machine_id) {
        const { data: machine } = await supabase
          .from('machines')
          .select('name, name_en')
          .eq('id', pick.machine_id)
          .single();
        newMachineName = machine?.name || null;
        newMachineNameEn = (machine as Record<string, unknown> | null)?.name_en as string | null || null;
      }

      // Update DB
      if (planId) {
        await supabase
          .from('user_workout_exercises')
          .update({
            exercise_id: pick.id,
            is_fallback: true,
            fallback_reason: 'user_swap',
          })
          .eq('plan_id', planId)
          .eq('day_letter', dayLetter)
          .eq('slot_order', exercise.slotOrder);
      }

      // Update parent state
      const updated = [...exercises];
      updated[idx] = {
        ...exercise,
        exerciseId: pick.id,
        exerciseName: pick.name,
        // Localized fields MUST follow the new exercise — keeping the old
        // exerciseNameEn made EN-mode users see the old exercise's name while
        // the video already showed the new one (bug D2).
        exerciseNameEn: (pick as Record<string, unknown>).name_en as string | null || null,
        machineName: newMachineName,
        machineNameEn: newMachineNameEn,
        isFallback: true,
        fallbackReason: 'user_swap',
      };
      onExercisesChange?.(updated);

      toast.success(t('workout.swap_success', { name: pick.name }));
    } catch (err) {
      console.error('[PreviewSwap] Error:', err);
      toast.error(t('workout.swap_error'));
    } finally {
      setSwappingIndex(null);
    }
  };

  const handleExerciseTap = (ex: WorkoutExercise) => {
    setSelectedExercise(ex);
    setShowInfoDrawer(true);
  };

  const handleCloseClick = () => {
    setShowExitDialog(true);
  };

  const handleEnd = () => {
    onClose();
    navigate('/');
  };

  const handlePause = () => {
    if (onPause) {
      onPause();
    }
    navigate('/');
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col w-screen max-w-full overflow-x-hidden"
    >
      {/* Header */}
      <div className="flex-none px-4 pb-4 border-b border-border flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <Button variant="ghost" size="icon" onClick={handleCloseClick}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="font-bold text-lg">{t('workout.today_workout')}</h2>
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          ~{estimatedDuration} min
        </Badge>
      </div>

      {/* Day info */}
      <div className="flex-none p-4 bg-gradient-to-br from-primary/10 via-background to-background border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="font-bold text-lg text-primary">{dayLetter}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg truncate">{dayName}</h3>
            <p className="text-sm text-muted-foreground">
              {t('workout.exercises_ready', { count: exercises.length })}
            </p>
          </div>
        </div>
      </div>

      {/* Exercise list - native scroll */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-4 space-y-2">
          {exercises.map((ex, idx) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center gap-3 py-3 px-3 rounded-xl bg-muted/50 border border-border/50 active:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => handleExerciseTap(ex)}
            >
              {/* Index - fixed width */}
              <div className="w-8 h-8 shrink-0 flex-none rounded-full bg-primary/20 flex items-center justify-center">
                <span className="font-bold text-sm text-primary">{idx + 1}</span>
              </div>

              {/* Name + details - takes remaining space, truncates */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <p className={`font-medium text-sm truncate ${!ex.exerciseName ? 'text-muted-foreground italic' : ''}`}>
                    {((isEn && ex.exerciseNameEn) ? ex.exerciseNameEn : ex.exerciseName) || TRAINING_ROLE_NAMES[ex.roleId as keyof typeof TRAINING_ROLE_NAMES] || ex.roleId}
                  </p>
                  {ex.slotCategory && SLOT_CATEGORY_LABELS[ex.slotCategory] && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${SLOT_CATEGORY_LABELS[ex.slotCategory].color}`}>
                      {SLOT_CATEGORY_LABELS[ex.slotCategory].label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('workout.sets_x_reps', { sets: ex.sets, min: ex.repMin, max: ex.repMax })}
                  {ex.machineName && ` · ${(isEn && ex.machineNameEn) ? ex.machineNameEn : ex.machineName}`}
                </p>
              </div>

              {/* Swap button */}
              {gymId && (
                <button
                  onClick={(e) => handleSwapExercise(idx, e)}
                  disabled={swappingIndex !== null}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 text-muted-foreground ${swappingIndex === idx ? 'animate-spin text-primary' : ''}`} />
                </button>
              )}

              {/* Chevron */}
              <ChevronRight className="w-4 h-4 shrink-0 flex-none text-muted-foreground/50" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Action button */}
      <div className="flex-none p-4 pb-28 border-t border-border bg-background">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <Flame className="w-4 h-4 shrink-0 text-orange-500" />
          <span>{t('workout.warmup_note')}</span>
        </div>
        <Button 
          size="lg" 
          className="w-full gap-2"
          onClick={onStartWarmup}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Flame className="w-5 h-5" />
              </motion.div>
              {t('workout.preparing_warmup')}
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              {t('workout.start_warmup')}
            </>
          )}
        </Button>
      </div>

      {/* Exit Dialog */}
      <WorkoutExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onEnd={handleEnd}
        onPause={handlePause}
        isWarmup={false}
      />

      {/* Exercise Info Drawer */}
      <Drawer open={showInfoDrawer} onOpenChange={setShowInfoDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{((isEn && selectedExercise?.exerciseNameEn) ? selectedExercise.exerciseNameEn : selectedExercise?.exerciseName) || t('workout.exercise_label')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {signedDetailVideoUrl ? (
              <div className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video">
                <video
                  key={signedDetailVideoUrl}
                  src={signedDetailVideoUrl}
                  playsInline autoPlay loop muted preload="auto"
                  controlsList="nodownload"
                  className="w-full h-full object-contain"
                  style={{ opacity: 0, transition: 'opacity 0.3s' }}
                  onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-muted mb-4 aspect-video flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {exerciseDetail === null ? t('workout.loading') : t('workout.no_video')}
                </p>
              </div>
            )}

            {selectedExercise && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('workout.sets_x_reps', { sets: selectedExercise.sets, min: selectedExercise.repMin, max: selectedExercise.repMax })}
                  {selectedExercise.machineName && ` · ${(isEn && selectedExercise.machineNameEn) ? selectedExercise.machineNameEn : selectedExercise.machineName}`}
                </p>

                {selectedExercise.slotCategory && SLOT_CATEGORY_LABELS[selectedExercise.slotCategory] && (
                  <span className={`inline-block text-xs px-2 py-1 rounded-full border ${SLOT_CATEGORY_LABELS[selectedExercise.slotCategory].color}`}>
                    {SLOT_CATEGORY_LABELS[selectedExercise.slotCategory].label}
                  </span>
                )}

                {(() => {
                  const primary = isEn && exerciseDetail?.primary_muscles_en?.length ? exerciseDetail.primary_muscles_en : exerciseDetail?.primary_muscles;
                  return primary && primary.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('workout.primary_muscles')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {primary.map((m) => (
                          <span key={m} className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-medium">{m}</span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const secondary = isEn && exerciseDetail?.secondary_muscles_en?.length ? exerciseDetail.secondary_muscles_en : exerciseDetail?.secondary_muscles;
                  return secondary && secondary.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('workout.secondary_muscles')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {secondary.map((m) => (
                          <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const desc = isEn && exerciseDetail?.description_en ? exerciseDetail.description_en : exerciseDetail?.description;
                  return desc ? (
                    <div className="p-3 bg-muted/50 rounded-xl">
                      <p className="text-xs font-semibold text-foreground mb-1">{t('workout.description_technique')}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{desc}</p>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const setup = isEn && exerciseDetail?.setup_instructions_en ? exerciseDetail.setup_instructions_en : exerciseDetail?.setup_instructions;
                  return setup ? (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">{t('workout.setup')}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{setup}</p>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const mistakes = isEn && exerciseDetail?.common_mistakes_en ? exerciseDetail.common_mistakes_en : exerciseDetail?.common_mistakes;
                  return mistakes ? (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 mb-1">{t('workout.common_mistakes')}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{mistakes}</p>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const tipsText = isEn && exerciseDetail?.tips_en ? exerciseDetail.tips_en : exerciseDetail?.tips;
                  return tipsText ? (
                    <div>
                      <p className="text-xs font-semibold text-green-600 mb-1">{t('workout.tips')}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tipsText}</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </motion.div>
  );
};
