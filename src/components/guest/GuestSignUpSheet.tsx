import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, LogIn, Sparkles } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

interface GuestSignUpSheetProps {
  open: boolean;
  /** keepReturn = po přihlášení se vrátit tam, odkud host sheet otevřel. */
  onClose: (keepReturn: boolean) => void;
}

/**
 * Výzva pro hosta, když chce něco, co potřebuje účet.
 * Nový člověk jde nejdřív přes dotazník (registrace je na jeho konci) — přímá registrace
 * přes Apple/Google/e-mail bez dotazníku byla zbytečná (David 15. 10.).
 * Kdo už účet má, se jen přihlásí a vrátí se tam, kde byl.
 */
const GuestSignUpSheet = ({ open, onClose }: GuestSignUpSheetProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goToQuestionnaire = () => {
    // Plán na míru vede přes dotazník — po něm platí cíl z dotazníku, ne návrat z katalogu.
    onClose(false);
    navigate('/auth?start=questionnaire');
  };

  const goToLogin = () => {
    onClose(true);
    navigate('/auth?mode=login');
  };

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(false); }}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <DrawerHeader className="px-0 text-center sm:text-center max-w-md mx-auto w-full">
            <div className="mx-auto mb-2 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <DrawerTitle className="text-xl font-bold">{t('guest.sheet_title')}</DrawerTitle>
            <DrawerDescription>{t('guest.sheet_desc')}</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 max-w-md mx-auto">
            <Button size="lg" className="w-full h-14 text-base font-semibold" onClick={goToQuestionnaire}>
              <ClipboardList className="w-5 h-5 mr-2" />
              {t('guest.start_questionnaire')}
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={goToLogin}>
              <LogIn className="w-4 h-4 mr-2" />
              {t('guest.have_account')}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default GuestSignUpSheet;
