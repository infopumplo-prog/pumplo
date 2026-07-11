import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// First-run guided tour ("coach marks"). Each screen declares its steps; the
// tour auto-opens once per (screenId, version) — new users and everyone after
// an update that bumps the version — and can be replayed via CoachHelpButton.
// A step with a `target` selector gets a spotlight + anchored tooltip; without
// one it renders as a centered card.

export interface CoachStep {
  /** CSS selector, typically [data-coach="..."]. Omit for a centered card. */
  target?: string;
  title: string;
  body: string;
}

const seenKey = (screenId: string) => `pumplo_tour_${screenId}`;

export const hasSeenTour = (screenId: string, version: number): boolean => {
  try { return Number(localStorage.getItem(seenKey(screenId)) || 0) >= version; } catch { return true; }
};

export const markTourSeen = (screenId: string, version: number) => {
  try { localStorage.setItem(seenKey(screenId), String(version)); } catch { /* noop */ }
};

interface SpotRect { top: number; left: number; width: number; height: number }

const PAD = 8;

export const CoachTour = ({ screenId, steps, version = 1, open, onClose }: {
  screenId: string;
  steps: CoachStep[];
  version?: number;
  /** Controlled visibility (replay via help button). */
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);
  const measureTimer = useRef<number | undefined>(undefined);

  useEffect(() => { if (open) setIdx(0); }, [open]);

  const step = steps[idx];

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: Math.max(r.left - PAD, 4), width: Math.min(r.width + PAD * 2, window.innerWidth - 8), height: r.height + PAD * 2 });
  }, [step]);

  useEffect(() => {
    if (!open) return;
    // Wait a beat for layout/scroll to settle before measuring the target.
    measureTimer.current = window.setTimeout(measure, 120);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(measureTimer.current); window.removeEventListener('resize', measure); };
  }, [open, idx, measure]);

  const finish = useCallback(() => {
    markTourSeen(screenId, version);
    onClose();
  }, [screenId, version, onClose]);

  if (!open || !step) return null;

  const isLast = idx === steps.length - 1;
  // Tooltip above or below the spotlight, whichever half has more room.
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : false;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="coach-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spotlight hole: transparent div whose huge shadow dims the rest. */}
        {rect ? (
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="absolute rounded-2xl pointer-events-none"
            style={{
              top: rect.top, left: rect.left, width: rect.width, height: rect.height,
              boxShadow: '0 0 0 9999px rgba(4, 10, 24, 0.78)',
              border: '2px solid rgba(91, 200, 245, 0.9)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[rgba(4,10,24,0.78)]" />
        )}

        {/* Tooltip card */}
        <motion.div
          key={`step-${idx}`}
          initial={{ opacity: 0, y: below ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('absolute left-4 right-4 max-w-md mx-auto', !rect && 'top-1/2 -translate-y-1/2')}
          style={rect ? (below
            ? { top: Math.min(rect.top + rect.height + 14, window.innerHeight - 220) }
            : { bottom: Math.max(window.innerHeight - rect.top + 14, 96) }) : undefined}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
            <p className="text-sm font-bold text-[#5BC8F5] mb-1">{step.title}</p>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{step.body}</p>
            <div className="flex items-center justify-between mt-4">
              <button onClick={finish} className="text-xs text-muted-foreground py-2 pr-3 active:opacity-70">
                {t('tour.skip')}
              </button>
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div key={i} className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === idx ? 'bg-[#5BC8F5]' : 'bg-muted-foreground/30')} />
                ))}
              </div>
              <button
                onClick={() => (isLast ? finish() : setIdx(i => i + 1))}
                className="text-sm font-bold text-white bg-[#5BC8F5] rounded-xl px-4 py-2 active:scale-95 transition-transform"
              >
                {isLast ? t('tour.done') : t('tour.next')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

/** Auto-open state for a screen's tour + replay control. */
export const useCoachTour = (screenId: string, version = 1, ready = true) => {
  const [open, setOpen] = useState(false);
  const autoShown = useRef(false);
  useEffect(() => {
    if (!ready || autoShown.current) return;
    if (hasSeenTour(screenId, version)) return;
    // Small delay so the screen paints first (and skeletons disappear).
    // autoShown flips only when the timer actually fires — StrictMode's
    // double-invoke clears the first timer, and the second must still run.
    const id = window.setTimeout(() => {
      if (autoShown.current) return;
      autoShown.current = true;
      setOpen(true);
    }, 700);
    return () => clearTimeout(id);
  }, [ready, screenId, version]);
  return { open, openTour: () => setOpen(true), closeTour: () => setOpen(false) };
};

/** Small "?" button for screen headers — replays the tour on demand. */
export const CoachHelpButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Help"
    className={cn('p-2 rounded-xl text-muted-foreground hover:text-foreground active:scale-90 transition-transform', className)}
  >
    <HelpCircle className="w-5 h-5" />
  </button>
);
