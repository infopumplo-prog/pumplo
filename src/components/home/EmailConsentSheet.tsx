import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { consentUpdate, markEmailConsentAsked, type ConsentAnswer, type ConsentProfile } from '@/lib/emailConsent';

// Jednorázová žádost o souhlas s tipy e-mailem (F1 e-maily 19. 10.). O zobrazení
// rozhoduje shouldAskEmailConsent (Home); tady jen panel a zápis odpovědi.
// Zavření bez odpovědi = už se neptáme (jednou), tipy dál nechodí.

interface EmailConsentSheetProps {
  enabled: boolean;
  onAnswer: (updates: ConsentProfile) => Promise<{ success: boolean }>;
}

const EmailConsentSheet = ({ enabled, onAnswer }: EmailConsentSheetProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Krátká prodleva, ať panel nevyskočí do rozanimované obrazovky.
    const timer = window.setTimeout(() => {
      markEmailConsentAsked();
      setOpen(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const answer = async (a: ConsentAnswer) => {
    setSaving(true);
    await onAnswer(consentUpdate(a));
    setSaving(false);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) setOpen(false); }}>
      <DrawerContent className="px-6 pb-8" data-testid="email-consent-sheet">
        <div className="mx-auto w-full max-w-md pt-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <DrawerTitle className="text-xl font-bold text-center mb-2">
            {t('email_consent.title')}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t('email_consent.body')}
          </p>
          <div className="flex flex-col gap-2">
            <Button className="w-full h-12 rounded-xl font-bold" disabled={saving} onClick={() => answer('yes')}>
              {t('email_consent.yes')}
            </Button>
            <Button variant="ghost" className="w-full h-12 rounded-xl" disabled={saving} onClick={() => answer('no')}>
              {t('email_consent.no')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            {t('email_consent.hint')}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EmailConsentSheet;
