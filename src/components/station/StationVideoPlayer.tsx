import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

interface Exercise {
  id: string;
  name: string;
  name_en: string | null;
  video_path: string | null;
  description: string | null;
  description_en: string | null;
  setup_instructions: string | null;
  setup_instructions_en: string | null;
  common_mistakes: string | null;
  common_mistakes_en: string | null;
  tips: string | null;
  tips_en: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: number | null;
}

interface StationVideoPlayerProps {
  exercises: Exercise[];
  machineName: string;
  machineName_en?: string | null;
  bannerVisible?: boolean;
}

const MUSCLE_MAP: Record<string, string> = {
  // Czech proper names
  'Kvadricepsy': 'Quadriceps',
  'Hamstringy': 'Hamstrings',
  'Hýžďové svaly': 'Glutes',
  'Hýžďové svaly (gluteus maximus)': 'Glutes (gluteus maximus)',
  'Lýtka': 'Calves',
  'Hrudník': 'Chest',
  'Záda': 'Back',
  'Ramena': 'Shoulders',
  'Bicepsy': 'Biceps',
  'Tricepsy': 'Triceps',
  'Břicho': 'Abs',
  'Jádro': 'Core',
  'Trapézový sval': 'Trapezius',
  'Přední deltový sval': 'Front Deltoid',
  'Střední deltový sval': 'Middle Deltoid',
  'Zadní deltový sval': 'Rear Deltoid',
  'Latissimus dorsi': 'Latissimus Dorsi',
  'Rhomboidy': 'Rhomboids',
  'Bederní oblast': 'Lower Back',
  'Adduktory': 'Adductors',
  'Abduktory': 'Abductors',
  'Hlouboké stabilizátory': 'Deep Stabilizers',
  'Stabilizátory páteře': 'Spinal Stabilizers',
  'Kardiovaskulární systém': 'Cardiovascular System',
  'Celé tělo': 'Full Body',
  'Přitahovače': 'Adductors',
  'Odtahovače': 'Abductors',
  'Předloktí': 'Forearms',
  'Hrudní svaly': 'Pectoral Muscles',
  'Mezilopatkové svaly': 'Interscapular Muscles',
  // Czech informal / DB variants
  'kvadriceps': 'Quadriceps',
  'hamstringy': 'Hamstrings',
  'lýtka': 'Calves',
  'záda': 'Back',
  'ramena': 'Shoulders',
  'prsa': 'Chest',
  'prsní svaly': 'Pectoral Muscles',
  'břicho': 'Abs',
  'střed zad': 'Middle Back',
  'střed těla': 'Core',
  'horní prsa': 'Upper Chest',
  'spodní prsa': 'Lower Chest',
  'bedra': 'Lower Back',
  'trapézy': 'Trapezius',
  'lopatky': 'Shoulder Blades',
  'paže': 'Arms',
  'ruce': 'Arms',
  'nohy': 'Legs',
  'nohy a zadek': 'Legs and Glutes',
  'nohy a ruce': 'Legs and Arms',
  'dolní končetiny': 'Lower Limbs',
  'flexory kyčle': 'Hip Flexors',
  'zadek': 'Glutes',
  'Zadek': 'Glutes',
  'latisimy': 'Lats',
  'latissimy': 'Lats',
  'latysimy': 'Lats',
  'pilovitý sval': 'Serratus Anterior',
  'přímý břišní sval': 'Rectus Abdominis',
  'přímé břišní svaly': 'Rectus Abdominis',
  'šikmé břišní svaly': 'Obliques',
  'triceps ramena': 'Triceps & Shoulders',
  'vspřimovače': 'Spinal Erectors',
  'hamstrin': 'Hamstrings',
  'fulbody': 'Full Body',
  // English snake_case / lowercase variants (normalize capitalization)
  'abs': 'Abs',
  'back': 'Back',
  'chest': 'Chest',
  'glutes': 'Glutes',
  'hamstrings': 'Hamstrings',
  'hamstring': 'Hamstrings',
  'quadriceps': 'Quadriceps',
  'quads': 'Quads',
  'calves': 'Calves',
  'shoulders': 'Shoulders',
  'biceps': 'Biceps',
  'triceps': 'Triceps',
  'core': 'Core',
  'forearms': 'Forearms',
  'fullbody': 'Full Body',
  'back_thighs': 'Hamstrings',
  'front_thighs': 'Quadriceps',
  'front_shoulders': 'Front Deltoid',
  'side_shoulders': 'Lateral Deltoid',
  'hip_flexors': 'Hip Flexors',
  'chest_muscles': 'Pectoral Muscles',
  'stabilizing_muscles': 'Stabilizing Muscles',
  'wide_back_muscles': 'Back (Wide)',
  'lower_trapezius': 'Lower Trapezius',
  'middle_trapezius': 'Middle Trapezius',
  'upper_trapezius': 'Upper Trapezius',
  'rhomboid_major': 'Rhomboid Major',
  'rhomboid_minor': 'Rhomboid Minor',
  'traps': 'Trapezius',
};

const DifficultyDots = ({ level }: { level: number | null }) => {
  const max = 4;
  const filled = Math.min(Math.max(level ?? 0, 0), max);
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: i < filled ? '#4CC9FF' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  );
};

export const StationVideoPlayer = ({ exercises, machineName, machineName_en, bannerVisible = false }: StationVideoPlayerProps) => {
  const { t } = useTranslation();
  const topOffset = bannerVisible ? '60px' : '12px';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement>(null);

  const lang = i18n.language;
  const pick = (cs: string | null | undefined, en: string | null | undefined) =>
    lang === 'en' && en ? en : cs ?? null;
  const translateMuscle = (name: string) =>
    lang === 'en' ? (MUSCLE_MAP[name] ?? name) : name;
  const displayMachineName = pick(machineName, machineName_en) ?? machineName;

  const currentExercise = exercises[currentIndex] ?? null;
  const nextExercise = exercises[currentIndex + 1] ?? null;
  const activeUrl = currentExercise?.video_path ?? null;
  const nextUrl = nextExercise?.video_path ?? null;

  useEffect(() => {
    setInfoOpen(false);
    if (activeVideoRef.current) {
      activeVideoRef.current.load();
      activeVideoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, exercises.length - 1)));
  }, [exercises.length]);

  // Lock screen widget — Media Session API
  useEffect(() => {
    if (!currentExercise || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: pick(currentExercise.name, currentExercise.name_en) ?? currentExercise.name,
      artist: displayMachineName,
      artwork: [
        { src: '/pumplo-artwork-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pumplo-artwork-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });

    navigator.mediaSession.setActionHandler('previoustrack',
      currentIndex > 0 ? () => goTo(currentIndex - 1) : null
    );
    navigator.mediaSession.setActionHandler('nexttrack',
      currentIndex < exercises.length - 1 ? () => goTo(currentIndex + 1) : null
    );
  }, [currentExercise, displayMachineName, currentIndex, exercises.length, goTo]);

  // Sync playback state with lock screen widget
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = activeUrl ? 'playing' : 'none';
  }, [activeUrl]);

  // Tap anywhere on video to play (iOS autoplay workaround)
  const handleVideoTap = useCallback(() => {
    if (activeVideoRef.current) {
      activeVideoRef.current.play().catch(() => {});
    }
  }, []);

  if (!currentExercise) {
    return (
      <div
        className="flex items-center justify-center w-full"
        style={{ height: '60vh', background: '#0B1222', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}
      >
        {t('station.no_exercises')}
      </div>
    );
  }

  const displayName = pick(currentExercise.name, currentExercise.name_en) ?? currentExercise.name;

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: '#000' }}>
      {/* Video area — fills all available space */}
      <div className="relative flex-1 overflow-hidden" onClick={handleVideoTap}>
        {/* Active video — visible */}
        <video
          ref={activeVideoRef}
          src={activeUrl || undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          webkit-playsinline="true"
          className="w-full h-full object-cover"
          style={{ opacity: activeUrl ? 1 : 0, transition: 'opacity 0.3s' }}
        />
        {/* Next video — hidden, preloads in background while current plays */}
        {nextUrl && (
          <video
            src={nextUrl}
            muted
            playsInline
            preload="auto"
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            webkit-playsinline="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0, pointerEvents: 'none' }}
          />
        )}
        {/* Loading spinner — only when no video_path */}
        {!activeUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4CC9FF', borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Bottom gradient overlay for text readability — z-10 to stay above video */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10" style={{ height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)' }} />

        {/* Top gradient for info button */}
        <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)' }} />

        {/* Left arrow */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            aria-label={t('station.prev_exercise')}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right arrow */}
        {currentIndex < exercises.length - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            aria-label={t('station.next_exercise')}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Info button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
          className="absolute right-3 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-sm z-20"
          style={{ top: topOffset, background: 'rgba(0,0,0,0.4)', color: '#4CC9FF', border: '1px solid rgba(76,201,255,0.3)', transition: 'top 0.3s' }}
          aria-label={t('station.exercise_info')}
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Exercise counter badge */}
        <div className="absolute left-3 px-3 py-1 rounded-full backdrop-blur-sm z-20"
          style={{ top: topOffset, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', transition: 'top 0.3s' }}>
          <span style={{ color: '#4CC9FF', fontSize: '13px', fontWeight: 700 }}>{currentIndex + 1}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}> / {exercises.length}</span>
        </div>

        {/* Exercise name overlay — z-20 above gradient+video, well above CTA */}
        <div className="absolute left-0 right-0 px-4 z-20" style={{ bottom: '160px' }}>
          <p className="font-bold text-xl leading-tight" style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
            {displayName}
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {displayMachineName}
          </p>
          {/* Dot indicators */}
          {exercises.length > 1 && exercises.length <= 20 && (
            <div className="flex gap-1.5 mt-3">
              {exercises.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  className="rounded-full transition-all"
                  style={{
                    width: i === currentIndex ? '20px' : '6px',
                    height: '6px',
                    background: i === currentIndex ? '#4CC9FF' : 'rgba(255,255,255,0.35)',
                    borderRadius: '3px',
                  }}
                  aria-label={t('station.exercise_label', { n: i + 1 })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info overlay */}
      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(11,18,34,0.97)' }}
        >
          {/* Header — fixed at top, never scrolls */}
          <div className="shrink-0 flex items-center justify-between px-4 py-4" style={{ background: 'rgba(11,18,34,0.97)', borderBottom: '1px solid rgba(76,201,255,0.15)' }}>
            <div>
              <p className="font-bold text-base" style={{ color: '#fff' }}>{displayName}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{displayMachineName}</p>
            </div>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
              aria-label={t('station.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content — scrollable area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            {/* Difficulty */}
            {currentExercise.difficulty !== null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.difficulty')}
                </p>
                <DifficultyDots level={currentExercise.difficulty} />
              </div>
            )}

            {/* Primary muscles */}
            {(currentExercise.primary_muscles ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.primary_muscles')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(currentExercise.primary_muscles ?? []).map((m) => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(76,201,255,0.15)', color: '#4CC9FF', border: '1px solid rgba(76,201,255,0.3)' }}
                    >
                      {translateMuscle(m)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary muscles */}
            {(currentExercise.secondary_muscles ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.secondary_muscles')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(currentExercise.secondary_muscles ?? []).map((m) => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      {translateMuscle(m)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {pick(currentExercise.description, currentExercise.description_en) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.description')}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {pick(currentExercise.description, currentExercise.description_en)}
                </p>
              </div>
            )}

            {/* Setup instructions */}
            {pick(currentExercise.setup_instructions, currentExercise.setup_instructions_en) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.setup')}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {pick(currentExercise.setup_instructions, currentExercise.setup_instructions_en)}
                </p>
              </div>
            )}

            {/* Common mistakes */}
            {pick(currentExercise.common_mistakes, currentExercise.common_mistakes_en) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.common_mistakes')}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {pick(currentExercise.common_mistakes, currentExercise.common_mistakes_en)}
                </p>
              </div>
            )}

            {/* Tips */}
            {pick(currentExercise.tips, currentExercise.tips_en) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('station.tips')}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {pick(currentExercise.tips, currentExercise.tips_en)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
