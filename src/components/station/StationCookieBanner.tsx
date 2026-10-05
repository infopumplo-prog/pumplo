import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COOKIE_SETTINGS_EVENT, getConsent, setConsent, trackingDisabled, type ConsentCategories } from '@/lib/webAnalytics';

const Toggle = ({ checked, disabled, onChange, label, name }: {
  checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void; label: string; name: string;
}) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} data-cookie-toggle={name}
    disabled={disabled} onClick={() => onChange?.(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#4CC9FF]' : 'bg-white/25'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

/**
 * Cookie consent for the QR machine page. Shown only when `active` (after the e-mail
 * prompt is done) and no choice is stored. Layer 1: Accept all / Reject all / Customize;
 * layer 2: per-category switches, off by default.
 */
export const StationCookieBanner = ({ active, onDecided }: { active: boolean; onDecided?: (c: ConsentCategories) => void }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [choice, setChoice] = useState<ConsentCategories>({ analytics: false, marketing: false });

  useEffect(() => {
    if (!active || trackingDisabled()) return;
    if (getConsent() === null) setOpen(true);
    const reopen = () => { setChoice(getConsent() ?? { analytics: false, marketing: false }); setCustomize(true); setOpen(true); };
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, [active]);

  if (!open) return null;

  const save = (c: ConsentCategories) => { setConsent(c); setOpen(false); setCustomize(false); onDecided?.(c); };
  const btn = 'rounded-xl border border-white/30 px-3 py-2 text-sm font-semibold whitespace-nowrap';
  const primary = 'rounded-xl px-5 py-2.5 text-sm font-bold';

  return (
    <div data-cookie-banner role="dialog" aria-label={t('station.cookie_title')} className="fixed inset-x-0 bottom-0 z-[70] p-3">
      <div className="mx-auto max-w-md rounded-2xl text-white p-4 shadow-2xl"
        style={{ background: 'rgba(11,18,34,.97)', border: '1px solid rgba(255,255,255,.12)' }}>
        {!customize ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold text-sm mb-1">{t('station.cookie_title')}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.8)' }}>
                {t('station.cookie_text')}{' '}
                <a href="/privacy#cookies" target="_blank" rel="noopener noreferrer" className="underline">{t('station.cookie_more')}</a>
              </p>
            </div>
            <button data-cookie-accept onClick={() => save({ analytics: true, marketing: true })}
              className={primary} style={{ background: '#4CC9FF', color: '#0B1222' }}>{t('station.cookie_accept_all')}</button>
            <div className="flex gap-2">
              <button data-cookie-reject onClick={() => save({ analytics: false, marketing: false })} className={`flex-1 ${btn}`}>{t('station.cookie_reject_all')}</button>
              <button data-cookie-customize onClick={() => setCustomize(true)} className={`flex-1 ${btn}`}>{t('station.cookie_customize')}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-sm">{t('station.cookie_settings_title')}</p>
            {([{ key: 'necessary', locked: true }, { key: 'analytics', locked: false }, { key: 'marketing', locked: false }] as const).map(({ key, locked }) => (
              <div key={key} className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{t(`station.cookie_cat_${key}`)}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.7)' }}>{t(`station.cookie_cat_${key}_desc`)}</p>
                </div>
                <Toggle name={key} label={t(`station.cookie_cat_${key}`)} checked={locked ? true : choice[key]} disabled={locked}
                  onChange={locked ? undefined : (v) => setChoice((c) => ({ ...c, [key]: v }))} />
              </div>
            ))}
            <button data-cookie-accept-all-2 onClick={() => save({ analytics: true, marketing: true })}
              className={primary} style={{ background: '#4CC9FF', color: '#0B1222' }}>{t('station.cookie_accept_all')}</button>
            <button data-cookie-save onClick={() => save(choice)} className={btn}>{t('station.cookie_save')}</button>
          </div>
        )}
      </div>
    </div>
  );
};
