import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FocusImageTile from '@/components/FocusImageTile';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BadgeCheck, Calendar, Dumbbell, Download, Heart, Search } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { CoachTour, useCoachTour, CoachHelpButton } from '@/components/coach/CoachTour';
import { readPlanChoice } from '@/lib/onboardingFlow';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { cn } from '@/lib/utils';
import {
  WORKOUT_FOCUSES,
  WORKOUT_GOALS,
  coverFor,
  fetchPublicWorkouts,
  localizedText,
  searchToFocus,
  setWorkoutLiked,
  toggleLikeLocal,
  type PublicWorkout,
  type WorkoutFocus,
  type WorkoutGoal,
  type WorkoutSort,
} from '@/lib/publicWorkouts';

type Scope = 'all' | 'my_gym';

const SEARCH_DEBOUNCE_MS = 300;

const PublicWorkouts = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const myGymId = profile?.selected_gym_id ?? null;
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<WorkoutSort>('popular');
  const [goal, setGoal] = useState<WorkoutGoal | null>(null);
  const [focus, setFocus] = useState<WorkoutFocus | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [workouts, setWorkouts] = useState<PublicWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Průvodce sekcí Tréninky — kdo si v dotazníku vybral plán od trenéra, dostane úvod „vyber si plán“.
  const tour = useCoachTour('workouts', 1, !isLoading);
  const fromTrainerChoice = readPlanChoice() === 'trainer';
  const tourSteps = [
    { title: t(fromTrainerChoice ? 'tour.workouts.intro_trainer_title' : 'tour.workouts.intro_title'), body: t(fromTrainerChoice ? 'tour.workouts.intro_trainer_body' : 'tour.workouts.intro_body') },
    { target: '[data-coach="workouts-focus"]', title: t('tour.workouts.focus_title'), body: t('tour.workouts.focus_body') },
    { target: '[data-coach="workouts-filters"]', title: t('tour.workouts.filters_title'), body: t('tour.workouts.filters_body') },
    { target: '[data-coach="workouts-card"]', title: t('tour.workouts.card_title'), body: t('tour.workouts.card_body') },
    { target: '[data-coach="help-btn"]', title: t('tour.common.help_title'), body: t('tour.common.help_body') },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFailed(false);
    // „Zadek“, „prsa“… v hledání = filtr partie, ne fulltext.
    const searchFocus = searchToFocus(search);
    fetchPublicWorkouts({
      gymId: scope === 'my_gym' ? myGymId : null,
      goal,
      focus: focus ?? searchFocus,
      search: searchFocus ? '' : search,
      sort,
    })
      .then((rows) => { if (!cancelled) setWorkouts(rows); })
      .catch(() => { if (!cancelled) { setWorkouts([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [scope, goal, focus, search, sort, myGymId]);

  const openWorkout = (w: PublicWorkout) => {
    if (w.is_own) { navigate(`/custom-plan/${w.id}`); return; }
    navigate(`/plan/${w.share_token}`, { state: { fromCatalog: true, authorName: w.trainer_name } });
  };

  const toggleLike = async (e: React.MouseEvent, w: PublicWorkout) => {
    e.stopPropagation();
    if (!user) return;
    setWorkouts((prev) => prev.map((x) => (x.id === w.id ? toggleLikeLocal(x) : x)));
    try {
      await setWorkoutLiked(w.id, user.id, !w.liked_by_me);
    } catch {
      // Vrátit zpět, když se lajk neuložil.
      setWorkouts((prev) => prev.map((x) => (x.id === w.id ? toggleLikeLocal(x) : x)));
    }
  };

  const dayLabel = (n: number) => n === 1 ? t('messages.day_singular') : n < 5 ? t('messages.day_2_4') : t('messages.day_plural');
  const exerciseLabel = (n: number) => n === 1 ? t('messages.exercise_singular') : n < 5 ? t('messages.exercise_2_4') : t('messages.exercise_plural');

  const pill = (active: boolean) =>
    cn(
      'shrink-0 min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95',
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground active:bg-muted-foreground/20',
    );

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-nav">
        <div className="gradient-hero px-6 safe-top-hero pb-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">{t('public_workouts.title')}</h1>
            <CoachHelpButton onClick={tour.openTour} />
          </div>
          <p className="text-sm text-muted-foreground">{t('public_workouts.subtitle')}</p>

          <div className="mt-5 relative">
            <Search className="w-5 h-5 text-primary absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('public_workouts.search_placeholder')}
              className="w-full h-12 bg-card border border-border shadow-sm rounded-2xl pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>
        </div>

        {/* Podle partie */}
        <section className="pt-5" data-coach="workouts-focus">
          <h2 className="px-6 text-base font-bold mb-3">{t('public_workouts.by_focus')}</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-6 pb-1">
            {WORKOUT_FOCUSES.map((f) => (
              <FocusImageTile
                key={f}
                focusKey={f}
                label={t(`public_workouts.focus_${f}`)}
                selected={focus === f}
                dimmed={!!focus && focus !== f}
                onClick={() => setFocus(focus === f ? null : f)}
                className="shrink-0 w-28 h-36"
              />
            ))}
          </div>
        </section>

        {/* Od trenérů */}
        <section className="pt-6">
          <h2 className="px-6 text-base font-bold mb-3">{t('public_workouts.from_trainers')}</h2>
          <div className="px-6 space-y-3" data-coach="workouts-filters">
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
              <button onClick={() => setSort('popular')} className={pill(sort === 'popular')}>{t('public_workouts.sort_popular')}</button>
              <button onClick={() => setSort('newest')} className={pill(sort === 'newest')}>{t('public_workouts.sort_newest')}</button>
              <button onClick={() => setSort('liked')} className={pill(sort === 'liked')}>
                <Heart className={cn('w-4 h-4 inline -mt-0.5 mr-1', sort === 'liked' && 'fill-current')} />
                {t('public_workouts.sort_liked')}
              </button>
              <span className="w-px bg-border shrink-0 my-1" />
              <button onClick={() => setScope('all')} className={pill(scope === 'all')}>{t('public_workouts.scope_all')}</button>
              {myGymId && (
                <button onClick={() => setScope('my_gym')} className={pill(scope === 'my_gym')}>{t('public_workouts.scope_my_gym')}</button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
              {WORKOUT_GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(goal === g ? null : g)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    goal === g ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  {t(`public_workouts.goal_${g}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">
            {isLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />)
            ) : workouts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Dumbbell className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  {t(failed ? 'public_workouts.load_failed' : sort === 'liked' ? 'public_workouts.empty_liked_title' : 'public_workouts.empty_title')}
                </h3>
                {!failed && <p className="text-sm text-muted-foreground">{t(sort === 'liked' ? 'public_workouts.empty_liked_desc' : 'public_workouts.empty_desc')}</p>}
              </div>
            ) : (
              workouts.map((w, index) => (
                <motion.div
                  key={w.id}
                  data-coach={index === 0 ? 'workouts-card' : undefined}
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04 }}
                  onClick={() => openWorkout(w)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openWorkout(w); }}
                  className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden cursor-pointer transition-transform active:scale-[0.97] active:brightness-95"
                >
                  {/* Obálka od trenéra (nebo obrázek partie) + kdo trénink vytvořil */}
                  <div className="relative h-44 bg-muted">
                    <img src={coverFor(w)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <button
                      onClick={(e) => toggleLike(e, w)}
                      aria-pressed={w.liked_by_me}
                      aria-label={t(w.liked_by_me ? 'public_workouts.unlike' : 'public_workouts.like')}
                      className="absolute top-2 right-2 h-11 min-w-[44px] px-3.5 rounded-full bg-black/45 backdrop-blur flex items-center justify-center gap-1.5 active:scale-90 active:bg-black/65 transition-transform"
                    >
                      <Heart className={cn('w-4 h-4 transition-colors', w.liked_by_me ? 'fill-rose-500 text-rose-500' : 'text-white')} />
                      <span className="text-xs font-semibold text-white tabular-nums">{w.like_count}</span>
                    </button>
                    <div className="absolute left-4 right-4 bottom-3 flex items-end gap-3">
                      <div className="w-11 h-11 rounded-full ring-2 ring-white overflow-hidden bg-primary flex items-center justify-center shrink-0">
                        {w.trainer_photo_url ? (
                          <img src={w.trainer_photo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-sm font-bold text-primary-foreground">{w.trainer_name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-white leading-snug">{localizedText(w.name, w.name_en, lang)}</h3>
                        <p className="text-xs text-white/85 flex items-center gap-1 flex-wrap">
                          <BadgeCheck className="w-3.5 h-3.5 text-white" />
                          <span className="font-semibold">{w.trainer_name}</span>
                          {w.trainer_gym_name && <span className="text-white/70">· {w.trainer_gym_name}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-3">
                  {w.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{localizedText(w.description, w.description_en, lang)}</p>
                  )}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {w.focus && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        {t(`public_workouts.focus_${w.focus}`)}
                      </span>
                    )}
                    {(w.secondary_focuses ?? []).map((f) => (
                      <span key={f} className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-primary/40 text-primary">
                        {t(`public_workouts.focus_${f}`)}
                      </span>
                    ))}
                    {w.goal && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {t(`public_workouts.goal_${w.goal}`)}
                      </span>
                    )}
                    {w.level && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-foreground">
                        {t(`public_workouts.level_${w.level}`)}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {w.day_count} {dayLabel(w.day_count)}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Dumbbell className="w-3 h-3" />
                      {w.exercise_count} {exerciseLabel(w.exercise_count)}
                    </span>
                    {w.save_count > 0 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {t('public_workouts.save_count', { count: w.save_count })}
                      </span>
                    )}
                  </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      <CoachTour screenId="workouts" steps={tourSteps} open={tour.open} onClose={tour.closeTour} />
      </div>
    </PageTransition>
  );
};

export default PublicWorkouts;
