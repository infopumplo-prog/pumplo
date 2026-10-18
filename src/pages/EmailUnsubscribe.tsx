import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailX, MailCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import PumploLogo from '@/components/PumploLogo';
import { confirmUnsubscribe, parseUnsubscribeParams } from '@/lib/emailUnsubscribe';

// Veřejná stránka z patičky e-mailu (bez přihlášení). Samotné otevření nic nemění —
// odhlásí až tlačítko (POST na email-unsubscribe), aby skenery odkazů nikoho neodhlásily.
const EmailUnsubscribe = () => {
  const { t } = useTranslation();
  const { search } = useLocation();
  const params = useMemo(() => parseUnsubscribeParams(search), [search]);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'invalid' | 'error'>(params ? 'idle' : 'invalid');

  const confirm = async () => {
    if (!params) return;
    setState('sending');
    const result = await confirmUnsubscribe(import.meta.env.VITE_SUPABASE_URL, params);
    setState(result === 'ok' ? 'done' : result);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="gradient-hero pb-8 px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
        <div className="flex flex-col items-center">
          <PumploLogo className="h-10" />
        </div>
      </div>
      <motion.div
        className="flex-1 px-4 pt-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-md mx-auto w-full text-center space-y-4">
          {state === 'done' ? (
            <>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-xl font-bold">{t('unsubscribe.done_title')}</h1>
              <p className="text-muted-foreground text-sm">{t('unsubscribe.done_desc')}</p>
            </>
          ) : state === 'invalid' ? (
            <>
              <h1 className="text-xl font-bold">{t('unsubscribe.invalid_title')}</h1>
              <p className="text-muted-foreground text-sm">{t('unsubscribe.invalid_desc')}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <MailX className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-xl font-bold">{t('unsubscribe.confirm_title')}</h1>
              <p className="text-muted-foreground text-sm">{t('unsubscribe.confirm_desc')}</p>
              {state === 'error' && <p className="text-destructive text-sm">{t('unsubscribe.error')}</p>}
              <Button size="lg" className="w-full" onClick={confirm} disabled={state === 'sending'}>
                {state === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : t('unsubscribe.confirm_button')}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default EmailUnsubscribe;
