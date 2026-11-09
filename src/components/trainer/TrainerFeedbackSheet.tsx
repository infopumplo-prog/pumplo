import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { saveSessionFeedback } from '@/lib/trainerApi';
import { buildFeedbackUpdate, DIFFICULTY_LABEL_KEYS, DIFFICULTY_LEVELS, NOTE_MAX_LENGTH, noteLength, type Difficulty } from '@/lib/trainerClient';

/**
 * Po tréninku plánu od trenéra: obtížnost 1–5 + poznámka. Trénink je v tu chvíli
 * už uložený — sheet jen doplní client_difficulty/client_note. Přeskočit = rovnou domů.
 */
export const TrainerFeedbackSheet = ({
  sessionId,
  trainerName,
  onDone,
}: {
  sessionId: string;
  trainerName: string | null;
  onDone: () => void;
}) => {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const update = buildFeedbackUpdate(difficulty, note);
  const tooLong = noteLength(note) > NOTE_MAX_LENGTH;

  const submit = async () => {
    if (sending) return;
    if (!update) { onDone(); return; }
    setSending(true);
    const { error } = await saveSessionFeedback(sessionId, update);
    setSending(false);
    if (error) {
      console.warn('[trainer] feedback not saved', error);
      toast.error(t('trainer_client.feedback_error'));
    } else {
      toast.success(t('trainer_client.feedback_sent'));
    }
    onDone();
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="trainer-feedback-title">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[90dvh] overflow-y-auto"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <h2 id="trainer-feedback-title" className="text-lg font-bold text-center">{t('trainer_client.feedback_title')}</h2>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-5">
          {trainerName
            ? t('trainer_client.feedback_subtitle', { name: trainerName })
            : t('trainer_client.feedback_subtitle_noname')}
        </p>

        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('trainer_client.feedback_title')}>
          {DIFFICULTY_LEVELS.map((level) => {
            const active = difficulty === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDifficulty(active ? null : level)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 min-h-[72px] transition-colors active:scale-95',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-foreground hover:bg-muted',
                )}
              >
                <span className="text-xl font-bold leading-none">{level}</span>
                <span className={cn('text-[10px] leading-tight text-center', active ? 'text-primary-foreground/90' : 'text-muted-foreground')}>
                  {t(DIFFICULTY_LABEL_KEYS[level])}
                </span>
              </button>
            );
          })}
        </div>

        <label htmlFor="trainer-feedback-note" className="block text-sm font-medium mt-5 mb-2">
          {t('trainer_client.feedback_note_label')}
        </label>
        <Textarea
          id="trainer-feedback-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('trainer_client.feedback_note_placeholder')}
          maxLength={NOTE_MAX_LENGTH * 2}
          rows={3}
          className="rounded-xl resize-none text-base"
        />
        <p className={cn('text-right text-xs mt-1', tooLong ? 'text-destructive' : 'text-muted-foreground')}>
          {noteLength(note)}/{NOTE_MAX_LENGTH}
        </p>

        <div className="flex gap-2 mt-4">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={onDone} disabled={sending}>
            {t('trainer_client.feedback_skip')}
          </Button>
          <Button className="flex-1 h-12 rounded-xl font-semibold" onClick={submit} disabled={sending || !update || tooLong}>
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('trainer_client.feedback_send')}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default TrainerFeedbackSheet;
