import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MapPin, Check, X, Building2, Home, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublishedGyms } from '@/hooks/usePublishedGyms';
import { getTodayOpeningStatus } from '@/lib/gymUtils';
import { cn } from '@/lib/utils';
import { OpeningHours } from '@/hooks/useGym';
import { getCachedFileUrl } from '@/lib/videoCache';
import { CustomEquipmentPicker } from '@/components/workout/CustomEquipmentPicker';
import { sanitizeCustomEquipment } from '@/lib/customEquipment';

/** Logo posilovny: z telefonu (cache), jinak ze sítě; když se nenačte, ikona místo rozbitého obrázku. */
const GymLogo = ({ url, name }: { url: string; name: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getCachedFileUrl(url).then((s) => { if (!cancelled) setSrc(s); });
    return () => { cancelled = true; };
  }, [url]);
  if (failed || !src) return <Building2 className="w-6 h-6 text-muted-foreground" />;
  return <img src={src} alt={name} className="w-full h-full object-contain p-1" onError={() => setFailed(true)} />;
};

interface GymSelectorProps {
  onSelect: (gymId: string) => void;
  onCancel: () => void;
  selectedGymId?: string | null;
  /**
   * „Nejsem v žádné z těchto posiloven" (feedback 13. 10.) — bez tohoto propu se
   * volba nezobrazí (např. vlastní plány, které se přizpůsobují konkrétní posilovně).
   */
  onSelectNoGym?: (equipment: string[]) => void | Promise<void>;
  /** Uložené vlastní vybavení z profilu (předvyplní picker). */
  customEquipment?: string[] | null;
}

export const GymSelector = ({ onSelect, onCancel, selectedGymId, onSelectNoGym, customEquipment }: GymSelectorProps) => {
  const { t } = useTranslation();
  const { gyms, isLoading } = usePublishedGyms();
  const [selected, setSelected] = useState<string | null>(selectedGymId || null);
  const [showPicker, setShowPicker] = useState(false);
  const [isSavingEquipment, setIsSavingEquipment] = useState(false);
  const hasCustomEquipment = !selectedGymId && sanitizeCustomEquipment(customEquipment).length > 0;

  // Sort order: Premium (featured) > open > closed, then alphabetical
  const sortedGyms = [...gyms].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;

    const aStatus = getTodayOpeningStatus(a.opening_hours as OpeningHours);
    const bStatus = getTodayOpeningStatus(b.opening_hours as OpeningHours);

    if (aStatus.isOpen && !bStatus.isOpen) return -1;
    if (!aStatus.isOpen && bStatus.isOpen) return 1;

    return a.name.localeCompare(b.name);
  });

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4 border-b border-border" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <div>
          <h1 className="text-xl font-bold">{t('workout.where_to_train')}</h1>
          <p className="text-sm text-muted-foreground">{t('workout.select_gym_today')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Gym List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
        {/* Co tu dělat (feedback 13. 10.: „uživatelé ani neví, co mají dělat") */}
        <p className="text-sm text-foreground/80 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
          {t('nogym.explainer')}
        </p>
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        ) : sortedGyms.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('workout.no_gyms')}</p>
          </div>
        ) : (
          sortedGyms.map((gym) => {
            const status = getTodayOpeningStatus(gym.opening_hours as OpeningHours);
            const isSelected = selected === gym.id;
            const isDisabled = !status.isOpen;

            return (
              <motion.button
                key={gym.id}
                onClick={() => !isDisabled && setSelected(gym.id)}
                disabled={isDisabled}
                className={cn(
                  "w-full p-4 rounded-xl border-2 transition-all text-left relative",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : isDisabled
                      ? "border-border bg-muted/30 opacity-50"
                      : gym.is_featured
                        ? "border-amber-500/40 bg-amber-500/[0.04] hover:border-amber-500/70 shadow-[0_0_0_2px_rgba(245,158,11,0.08)]"
                        : "border-border bg-card hover:border-primary/50"
                )}
                whileTap={!isDisabled ? { scale: 0.98 } : undefined}
              >
                {gym.is_featured && !isDisabled && (
                  <div className="absolute -top-2 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold shadow-sm">
                    <Check className="w-2.5 h-2.5" />
                    {t('workout.verified')}
                  </div>
                )}
                <div className="flex items-start gap-3">
                  {/* Logo/Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white",
                    gym.is_featured ? "ring-2 ring-primary/40" : "ring-1 ring-border"
                  )}>
                    {gym.logo_url ? (
                      <GymLogo url={gym.logo_url} name={gym.name} />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{gym.name}</h3>
                    {gym.address && (
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {gym.address}
                      </p>
                    )}
                    <p className={cn(
                      "text-xs mt-1",
                      status.isOpen
                        ? status.closingSoon
                          ? "text-orange-500"
                          : "text-green-600"
                        : "text-destructive"
                    )}>
                      {t(status.i18n.key, status.i18n.params)}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  )}>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary-foreground" />
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
        {onSelectNoGym && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className={cn(
              "w-full p-4 rounded-xl border-2 border-dashed transition-all text-left flex items-center gap-3",
              hasCustomEquipment ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Home className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{hasCustomEquipment ? t('nogym.start_here') : t('nogym.not_in_list')}</h3>
              <p className="text-xs text-muted-foreground">{t('nogym.not_in_list_desc')}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>

      {showPicker && onSelectNoGym && (
        <CustomEquipmentPicker
          initial={customEquipment}
          isSaving={isSavingEquipment}
          onCancel={() => setShowPicker(false)}
          onSave={async (equipment) => {
            setIsSavingEquipment(true);
            try {
              await onSelectNoGym(equipment);
            } finally {
              setIsSavingEquipment(false);
            }
          }}
        />
      )}

      {/* Confirm Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={handleConfirm}
          disabled={!selected}
        >
          <MapPin className="w-5 h-5" />
          {t('workout.confirm_selection')}
        </Button>
      </div>
    </motion.div>
  );
};
