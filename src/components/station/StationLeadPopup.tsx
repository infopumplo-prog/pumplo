import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';
import {
  LEAD_PROMPT_DELAY_MS, LEAD_THANKS_MS, isValidLeadEmail, leadCardTop, readLeadPromptState,
  shouldAutoShowLeadPrompt, writeLeadPromptState,
} from '@/lib/leadCapture';
import { logLeadPromptEvent, submitLead } from '@/lib/qrTracking';

type Phase = 'hidden' | 'form' | 'sending' | 'thanks' | 'leaving';

/** Small subscribe card over the exercise title; dims the page until closed or sent. */
export const StationLeadPopup = ({ code, gymName, onDone, onSubmitted }: {
  code: string; gymName: string;
  /** Called once the prompt is out of the way: not shown, closed, or sent and gone. */
  onDone?: () => void;
  onSubmitted?: () => void;
}) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('hidden');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) { onDone?.(); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (!shouldAutoShowLeadPrompt(readLeadPromptState(), document.cookie, Date.now())) { onDone?.(); return; }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) { onDone?.(); return; }
      setPhase('form');
      logLeadPromptEvent(code, 'lead_prompt_shown');
    }, LEAD_PROMPT_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per machine code
  }, [code]);

  // Align the card's top edge with the exercise title; keep it above the keyboard.
  useLayoutEffect(() => {
    if (phase === 'hidden') return;
    const place = () => {
      const el = document.querySelector('[data-station-title]');
      const vv = window.visualViewport;
      const titleTop = el ? el.getBoundingClientRect().top - 6 : null;
      setTop(leadCardTop(titleTop, vv?.height ?? window.innerHeight, vv?.offsetTop ?? 0));
    };
    place();
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    window.addEventListener('resize', place);
    return () => {
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [phase]);

  if (phase === 'hidden') return null;

  const close = () => {
    if (phase !== 'form') return;
    writeLeadPromptState('dismissed');
    logLeadPromptEvent(code, 'lead_prompt_dismissed');
    setPhase('hidden');
    onDone?.();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLeadEmail(email)) { setMessage(t('station.lead_bad_email')); return; }
    setMessage(null);
    setPhase('sending');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'cs';
    const result = await submitLead(code, email.trim(), lang, website);
    if (result === 'bad_email') { setMessage(t('station.lead_bad_email')); setPhase('form'); return; }
    if (result === 'error') { setMessage(t('station.lead_error')); setPhase('form'); return; }
    writeLeadPromptState('submitted');
    onSubmitted?.();
    setPhase('thanks');
    window.setTimeout(() => setPhase('leaving'), LEAD_THANKS_MS);
    window.setTimeout(() => { setPhase('hidden'); onDone?.(); }, LEAD_THANKS_MS + 300);
  };

  const dimmed = phase === 'form' || phase === 'sending';
  const pos = top === null ? { bottom: 176 } : { top };

  return (
    <>
      {/* Dim blocks the page; only × or sending closes the card (taps on the arrows used to dismiss it). */}
      {dimmed && <div data-lead-dim className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,.6)' }} />}
      <div
        data-lead-popup={phase}
        role="dialog"
        aria-label={t('station.lead_title', { gym: gymName })}
        className="fixed left-4 right-4 z-[61] rounded-[18px] text-white"
        style={{
          ...pos,
          background: 'rgba(11,18,34,.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(76,201,255,.3)', boxShadow: '0 14px 40px rgba(0,0,0,.5)',
          padding: '12px 12px 10px 14px',
          transition: 'transform 300ms ease-in, opacity 300ms ease-in',
          transform: phase === 'leaving' ? 'translateY(120%)' : 'none',
          opacity: phase === 'leaving' ? 0 : 1,
        }}
      >
        {phase === 'thanks' || phase === 'leaving' ? (
          <p className="text-[15px] font-extrabold">{t('station.lead_thanks')}</p>
        ) : (
          <form onSubmit={send} noValidate>
            <button type="button" data-lead-close aria-label={t('station.lead_close')} onClick={close}
              className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full text-[15px] leading-[26px]"
              style={{ background: 'rgba(255,255,255,.12)' }}>×</button>
            <p className="text-[15px] font-extrabold leading-tight mr-8 mb-2">{t('station.lead_title', { gym: gymName })}</p>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website}
              onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
            <div className="flex gap-1.5">
              <input type="email" inputMode="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder={t('station.lead_placeholder')}
                className="flex-1 min-w-0 h-10 rounded-[11px] px-3 text-base text-white placeholder:text-white/40"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)' }} />
              <button type="submit" disabled={phase === 'sending'} data-lead-submit
                className="h-10 px-3.5 rounded-[11px] font-extrabold text-sm disabled:opacity-60"
                style={{ background: '#4CC9FF', color: '#0B1222' }}>{t('station.lead_submit')}</button>
            </div>
            {message && <p data-lead-message className="text-xs mt-1.5" style={{ color: '#FF8A8A' }}>{message}</p>}
            <p className="mt-1.5 leading-snug" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,.55)' }}>
              {t('station.lead_consent')}{' '}
              <a href="/privacy#email" target="_blank" rel="noopener noreferrer" className="underline">{t('station.lead_terms')}</a>
            </p>
          </form>
        )}
      </div>
    </>
  );
};
