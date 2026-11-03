import FocusImageTile from '@/components/FocusImageTile';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe, EyeOff, ImagePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DESCRIPTION_MAX,
  WORKOUT_GOALS,
  WORKOUT_LEVELS,
  WORKOUT_FOCUSES,
  asFocus,
  asGoal,
  asLevel,
  coverFor,
  publishPlan,
  toggleSecondaryFocus,
  uploadWorkoutCover,
  unpublishPlan,
  validatePublish,
  type WorkoutGoal,
  type WorkoutLevel,
  type WorkoutFocus,
} from '@/lib/publicWorkouts';

interface PublishPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id: string;
    published_at: string | null;
    description: string | null;
    goal: string | null;
    level: string | null;
    focus: string | null;
    secondary_focuses?: string[] | null;
    cover_url: string | null;
  };
  exerciseCount: number;
  onChanged: () => void | Promise<void>;
}

const PublishPlanDialog = ({ open, onOpenChange, plan, exerciseCount, onChanged }: PublishPlanDialogProps) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState(plan.description ?? '');
  const [goal, setGoal] = useState<WorkoutGoal | null>(asGoal(plan.goal));
  const [level, setLevel] = useState<WorkoutLevel | null>(asLevel(plan.level));
  const [focus, setFocus] = useState<WorkoutFocus | null>(asFocus(plan.focus));
  const savedSecondary = (plan.secondary_focuses ?? []).map(asFocus).filter((f): f is WorkoutFocus => f !== null);
  const [secondary, setSecondary] = useState<WorkoutFocus[]>(savedSecondary);
  const { user } = useAuth();
  const [coverUrl, setCoverUrl] = useState<string | null>(plan.cover_url);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const isPublished = !!plan.published_at;

  const secondaryKey = (plan.secondary_focuses ?? []).join(',');

  // Při každém otevření začít z uloženého stavu plánu.
  useEffect(() => {
    if (!open) return;
    setDescription(plan.description ?? '');
    setGoal(asGoal(plan.goal));
    setLevel(asLevel(plan.level));
    setFocus(asFocus(plan.focus));
    setSecondary(secondaryKey ? secondaryKey.split(',').map(asFocus).filter((f): f is WorkoutFocus => f !== null) : []);
    setCoverUrl(plan.cover_url);
  }, [open, plan.description, plan.goal, plan.level, plan.focus, plan.cover_url, secondaryKey]);

  const pickPrimary = (f: WorkoutFocus) => {
    const next = focus === f ? null : f;
    setFocus(next);
    if (next) setSecondary((s) => s.filter((x) => x !== next));
  };

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true);
    try {
      setCoverUrl(await uploadWorkoutCover(file, user.id, plan.id));
    } catch {
      toast.error(t('public_workouts.cover_upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    const meta = { description, goal, level, focus, secondary_focuses: secondary, cover_url: coverUrl };
    const problem = validatePublish(meta, exerciseCount);
    if (problem) {
      toast.error(t(`public_workouts.error_${problem}`));
      return;
    }
    setBusy(true);
    try {
      await publishPlan(plan.id, meta, plan.published_at);
      await onChanged();
      toast.success(t(isPublished ? 'public_workouts.updated' : 'public_workouts.published'));
      onOpenChange(false);
    } catch (err) {
      const onlyTrainers = String((err as { message?: string })?.message ?? '').includes('only_trainers_can_publish');
      toast.error(t(onlyTrainers ? 'public_workouts.error_only_trainers' : 'public_workouts.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublish = async () => {
    setBusy(true);
    try {
      await unpublishPlan(plan.id);
      await onChanged();
      toast.success(t('public_workouts.unpublished'));
      onOpenChange(false);
    } catch {
      toast.error(t('public_workouts.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground',
    );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-5 safe-bottom">
        <div className="flex flex-col max-w-md mx-auto w-full max-h-[85dvh]">
        <div className="pt-4 pb-4 space-y-5 overflow-y-auto">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold">
                {t(isPublished ? 'public_workouts.dialog_title_edit' : 'public_workouts.dialog_title')}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground">
                {t('public_workouts.dialog_desc')}
              </DrawerDescription>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('public_workouts.cover_label')}</p>
            <label className="relative block h-36 rounded-2xl overflow-hidden bg-muted cursor-pointer">
              <img src={coverFor({ cover_url: coverUrl, focus })} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <span className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center gap-1 text-white">
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs font-semibold">
                  {uploading ? t('public_workouts.cover_uploading') : t(coverUrl ? 'public_workouts.cover_change' : 'public_workouts.cover_add')}
                </span>
              </span>
              <input type="file" accept="image/*" className="sr-only" onChange={handleCoverPick} disabled={uploading} />
            </label>
            {!coverUrl && <p className="text-[11px] text-muted-foreground">{t('public_workouts.cover_hint')}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="publish-description">
              {t('public_workouts.description_label')}
            </label>
            <textarea
              id="publish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              rows={3}
              placeholder={t('public_workouts.description_placeholder')}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {description.length}/{DESCRIPTION_MAX}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('public_workouts.focus_label')}</p>
            {/* Hlavní partie jako dlaždice s fotkou (feedback 13. 10.) */}
            <div className="grid grid-cols-3 gap-2">
              {WORKOUT_FOCUSES.map((f) => (
                <FocusImageTile
                  key={f}
                  focusKey={f}
                  label={t(`public_workouts.focus_${f}`)}
                  selected={focus === f}
                  onClick={() => pickPrimary(f)}
                  className="h-20"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('public_workouts.secondary_focus_label')}</p>
            <p className="text-[11px] text-muted-foreground -mt-1">{t('public_workouts.secondary_focus_hint')}</p>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_FOCUSES.filter((f) => f !== focus).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSecondary((s) => toggleSecondaryFocus(s, f, focus))}
                  aria-pressed={secondary.includes(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    secondary.includes(f) ? 'bg-primary/15 border-primary text-primary' : 'bg-muted/50 border-border text-foreground',
                  )}
                >
                  {secondary.includes(f) && <Check className="inline-block w-3.5 h-3.5 -mt-0.5 mr-1" strokeWidth={3} aria-hidden="true" />}{t(`public_workouts.focus_${f}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('public_workouts.goal_label')}</p>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_GOALS.map((g) => (
                <button key={g} type="button" onClick={() => setGoal(goal === g ? null : g)} className={chip(goal === g)}>
                  {t(`public_workouts.goal_${g}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('public_workouts.level_label')}</p>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_LEVELS.map((l) => (
                <button key={l} type="button" onClick={() => setLevel(level === l ? null : l)} className={chip(level === l)}>
                  {t(`public_workouts.level_${l}`)}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
            {t('public_workouts.privacy_note')}
          </p>
        </div>

          {/* Tlačítka vždy vidět dole — obsah nad nimi roluje. */}
          <div className="space-y-2 pt-3 pb-6 border-t border-border bg-background">
            <Button onClick={handlePublish} disabled={busy || uploading} className="w-full h-12 rounded-xl text-base font-semibold">
              {t(isPublished ? 'public_workouts.save_changes' : 'public_workouts.publish_btn')}
            </Button>
            {isPublished && (
              <Button
                onClick={handleUnpublish}
                disabled={busy}
                variant="ghost"
                className="w-full h-11 rounded-xl text-destructive hover:text-destructive"
              >
                <EyeOff className="w-4 h-4 mr-2" />
                {t('public_workouts.unpublish_btn')}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PublishPlanDialog;
