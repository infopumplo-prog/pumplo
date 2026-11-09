import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { ChevronRight, ClipboardCheck, Loader2, Scale, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInvalidateTrainerData, useTrainerAssignments } from '@/hooks/useTrainerAssignments';
import { Switch } from '@/components/ui/switch';
import { endTrainerCooperation, setWeightSharing } from '@/lib/trainerApi';
import type { MyTrainer } from '@/lib/trainerClient';
import { hasCheckinConfigured } from '@/lib/trainerCheckin';
import { useTrainerCheckins } from '@/hooks/useTrainerCheckins';
import TrainerCheckinSheet from '@/components/trainer/TrainerCheckinSheet';
import BodyWeightSheet from '@/components/trainer/BodyWeightSheet';

// Nastavení → „Můj trenér“: s kým klient spolupracuje + ukončení spolupráce. Bez trenéra se neukazuje.
export const MyTrainersSection = () => {
  const { t, i18n } = useTranslation();
  const { trainers } = useTrainerAssignments();
  const invalidateTrainerData = useInvalidateTrainerData();
  const [confirming, setConfirming] = useState<MyTrainer | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const { byLink } = useTrainerCheckins();
  const [checkinFor, setCheckinFor] = useState<MyTrainer | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  // Optimistický stav přepínače sdílení vah (link_id → hodnota), než se načte znovu my_trainers.
  const [shareOverride, setShareOverride] = useState<Record<string, boolean>>({});
  const [sharingId, setSharingId] = useState<string | null>(null);

  if (trainers.length === 0) return null;
  // Sloupce z migrace 20261030 — bez nich se váhy ani sdílení neukazují.
  const weightsAvailable = trainers.some((tr) => typeof tr.client_shares_weight === 'boolean');

  const handleShare = async (trainer: MyTrainer, share: boolean) => {
    if (sharingId) return;
    setSharingId(trainer.link_id);
    setShareOverride((prev) => ({ ...prev, [trainer.link_id]: share }));
    const { error } = await setWeightSharing(trainer.link_id, share);
    setSharingId(null);
    if (error) {
      console.warn('[trainer] weight sharing not saved', error);
      setShareOverride((prev) => ({ ...prev, [trainer.link_id]: !share }));
      toast.error(t('trainer_client.share_weight_error'));
      return;
    }
    toast.success(share ? t('trainer_client.share_weight_on') : t('trainer_client.share_weight_off'));
    await invalidateTrainerData();
  };

  const locale = i18n.language === 'en' ? enUS : cs;
  const since = (iso: string | null) => {
    if (!iso) return null;
    try { return format(parseISO(iso), 'd. M. yyyy', { locale }); } catch { return null; }
  };

  const handleEnd = async () => {
    const trainer = confirming;
    if (!trainer || endingId) return;
    setEndingId(trainer.link_id);
    const { error } = await endTrainerCooperation(trainer.link_id);
    setEndingId(null);
    setConfirming(null);
    if (error) {
      console.warn('[trainer] end cooperation failed', error);
      toast.error(t('trainer_client.end_error'));
      return;
    }
    toast.success(t('trainer_client.end_done', { name: trainer.trainer_name }));
    await invalidateTrainerData();
  };

  return (
    <section>
      <h2 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('trainer_client.my_trainer_title')}</h2>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {trainers.map((trainer) => {
          const sinceText = since(trainer.accepted_at);
          return (
            <div key={trainer.link_id} className="divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
              <span className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                {trainer.trainer_photo ? (
                  <img src={trainer.trainer_photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserRound className="w-5 h-5 text-primary" />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium truncate">{trainer.trainer_name}</span>
                {sinceText && (
                  <span className="block text-xs text-muted-foreground">{t('trainer_client.my_trainer_since', { date: sinceText })}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setConfirming(trainer)}
                disabled={endingId === trainer.link_id}
                className="shrink-0 min-h-[44px] px-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/15 transition-colors disabled:opacity-50"
              >
                {endingId === trainer.link_id ? <Loader2 className="w-4 h-4 animate-spin" /> : t('trainer_client.end_cooperation')}
              </button>
            </div>
            {(hasCheckinConfigured(trainer) || (byLink.get(trainer.link_id)?.length ?? 0) > 0) && (
              <button
                type="button"
                onClick={() => setCheckinFor(trainer)}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left active:bg-muted/60"
              >
                <ClipboardCheck className="w-5 h-5 text-primary shrink-0" />
                <span className="flex-1 text-[15px]">{t('trainer_client.ci_open_from_settings')}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            {typeof trainer.client_shares_weight === 'boolean' && (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="flex-1 min-w-0">
                  <label htmlFor={`share-weight-${trainer.link_id}`} className="block text-[15px] font-medium">{t('trainer_client.share_weight_label')}</label>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t('trainer_client.share_weight_desc')}</span>
                </span>
                <Switch
                  id={`share-weight-${trainer.link_id}`}
                  checked={shareOverride[trainer.link_id] ?? trainer.client_shares_weight}
                  disabled={sharingId === trainer.link_id}
                  onCheckedChange={(v) => void handleShare(trainer, v)}
                  className="mt-1"
                />
              </div>
            )}
            </div>
          );
        })}
        {weightsAvailable && (
          <button
            type="button"
            onClick={() => setWeightOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left active:bg-muted/60"
          >
            <Scale className="w-5 h-5 text-primary shrink-0" />
            <span className="flex-1 text-[15px]">{t('trainer_client.weight_title')}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <p className="px-4 mt-2 text-xs text-muted-foreground">{t('trainer_client.my_trainer_footer')}</p>

      <TrainerCheckinSheet trainer={checkinFor} open={!!checkinFor} onClose={() => setCheckinFor(null)} initialTab="history" />
      <BodyWeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />

      <AlertDialog open={!!confirming} onOpenChange={(open) => { if (!open && !endingId) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('trainer_client.end_confirm_title', { name: confirming?.trainer_name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('trainer_client.end_confirm_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!endingId}>{t('trainer_client.end_confirm_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleEnd(); }}
              disabled={!!endingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {endingId ? <Loader2 className="w-4 h-4 animate-spin" /> : t('trainer_client.end_cooperation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default MyTrainersSection;
