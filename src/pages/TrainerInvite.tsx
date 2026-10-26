import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Loader2, UserRound, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { acceptTrainerInvite, fetchTrainerInviteInfo, type TrainerInviteInfo } from '@/lib/trainerApi';
import { clearPendingTrainerInvite, mapAcceptInviteError, normalizeInviteToken, savePendingTrainerInvite } from '@/lib/trainerInvite';
import { useInvalidateTrainerData } from '@/hooks/useTrainerAssignments';
import { isPlainBrowser } from '@/lib/webGate';
import { openAppOrStore, APP_STORE_URL, PLAY_STORE_URL } from '@/lib/appRedirect';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; info: TrainerInviteInfo };

// Veřejná stránka pozvánky od trenéra: /trener/:token (odkaz z e-mailu / WhatsAppu).
const TrainerInvite = () => {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = normalizeInviteToken(rawToken);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const invalidateTrainerData = useInvalidateTrainerData();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [showStoreLinks, setShowStoreLinks] = useState(false);
  const plainBrowser = isPlainBrowser();

  const load = useCallback(async () => {
    if (!token) { setState({ kind: 'invalid' }); return; }
    setState({ kind: 'loading' });
    const { data, error } = await fetchTrainerInviteInfo(token);
    if (error) { setState({ kind: 'error' }); return; }
    if (!data || !data.is_valid) { setState({ kind: 'invalid' }); return; }
    setState({ kind: 'ready', info: data });
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Safari Smart App Banner: „Otevřít“ předá odkaz rovnou appce.
  useEffect(() => {
    if (!token || typeof document === 'undefined') return;
    const meta = document.createElement('meta');
    meta.name = 'apple-itunes-app';
    meta.content = `app-id=6768619318, app-argument=https://app.pumplo.com/trener/${token}`;
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, [token]);

  const handleAccept = async () => {
    if (!token || accepting) return;
    // Běžný prohlížeč (bez appky): registrace na webu není → otevřít appku s tímhle odkazem.
    if (plainBrowser) {
      if (!openAppOrStore(`trener/${token}`)) setShowStoreLinks(true);
      return;
    }
    if (!user) {
      // Po registraci/přihlášení pozvánku přijme PendingTrainerInviteAccept (App.tsx).
      savePendingTrainerInvite(token);
      navigate('/auth');
      return;
    }
    setAccepting(true);
    const { data, error } = await acceptTrainerInvite(token);
    setAccepting(false);
    if (error) {
      const info = mapAcceptInviteError(error);
      if (info.clearToken) clearPendingTrainerInvite(token);
      toast.error(t(info.messageKey ?? 'trainer_client.error_generic'), { id: `trainer-invite-${token}` });
      if (info.clearToken) setState({ kind: 'invalid' });
      return;
    }
    clearPendingTrainerInvite(token);
    void invalidateTrainerData();
    const name = data?.trainer_name || (state.kind === 'ready' ? state.info.trainer_name : '');
    toast.success(t('trainer_client.accepted_toast', { name }), { id: `trainer-invite-${token}` });
    navigate('/', { replace: true });
  };

  const shell = (children: React.ReactNode) => (
    // Web: html/body mají overflow-hidden → stránka roluje sama.
    <div className="h-[100dvh] overflow-y-auto bg-background safe-top">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );

  if (state.kind === 'loading' || authLoading) {
    return shell(<Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />);
  }

  if (state.kind === 'invalid' || state.kind === 'error') {
    const isError = state.kind === 'error';
    return shell(
      <>
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
          <LinkIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-2">{t(isError ? 'trainer_client.invite_title' : 'trainer_client.invite_invalid_title')}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t(isError ? 'trainer_client.invite_load_error' : 'trainer_client.invite_invalid_desc')}
        </p>
        <div className="space-y-3">
          {isError && (
            <Button className="w-full rounded-xl h-12" onClick={() => void load()}>{t('trainer_client.retry')}</Button>
          )}
          <Button variant="outline" className="w-full rounded-xl h-12" onClick={() => navigate('/', { replace: true })}>
            {t('trainer_client.go_home')}
          </Button>
        </div>
      </>,
    );
  }

  const { info } = state;
  const ctaLabel = plainBrowser
    ? t('trainer_client.invite_open_app')
    : user ? t('trainer_client.invite_accept') : t('trainer_client.invite_register');

  return shell(
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-4">{t('trainer_client.invite_title')}</p>
      <div className="w-24 h-24 rounded-full mx-auto mb-5 overflow-hidden bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
        {info.trainer_photo ? (
          <img src={info.trainer_photo} alt={info.trainer_name} className="w-full h-full object-cover" />
        ) : (
          <UserRound className="w-12 h-12 text-primary" />
        )}
      </div>
      <h1 className="text-2xl font-bold mb-3">{t('trainer_client.invite_headline', { name: info.trainer_name })}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t('trainer_client.invite_desc')}</p>
      <Button className="w-full rounded-xl h-12 text-base font-semibold" onClick={handleAccept} disabled={accepting}>
        {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : ctaLabel}
      </Button>
      {plainBrowser && (
        <p className="text-xs text-muted-foreground mt-4">{t('trainer_client.invite_no_app_hint')}</p>
      )}
      {plainBrowser && showStoreLinks && (
        <div className="flex gap-2 mt-4">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium">App Store</a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium">Google Play</a>
        </div>
      )}
      <Button variant="ghost" className="w-full rounded-xl h-11 mt-2" onClick={() => navigate('/', { replace: true })}>
        {t('trainer_client.go_home')}
      </Button>
    </motion.div>,
  );
};

export default TrainerInvite;
