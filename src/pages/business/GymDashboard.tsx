import { AlertTriangle, Loader2, Plus, Building2, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BusinessLayout from './BusinessLayout';
import CreateGymForm from '@/components/business/CreateGymForm';
import GymProfile from '@/components/business/GymProfile';
import { useGym } from '@/hooks/useGym';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const GymDashboard = () => {
  const { t } = useTranslation();
  const { gym, gyms, isLoading, refetch, licenseCount, canCreateMoreGyms, selectGym } = useGym();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGymList, setShowGymList] = useState(false);

  if (isLoading) {
    return (
      <BusinessLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  // No license at all
  if (licenseCount === 0) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              {t('business.no_license')}
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Pro vytvoření posilovny potřebujete aktivní licenci. Kontaktujte administrátora pro přidělení licence.
            </AlertDescription>
          </Alert>
        </div>
      </BusinessLayout>
    );
  }

  // Show gym list when user has multiple gyms
  if (showGymList && gyms.length > 0) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setShowGymList(false)}
              className="px-0"
            >
              {t('business.back')}
            </Button>
            <Badge variant="outline">
              {gyms.length} / {licenseCount} {licenseCount === 1 ? t('business.license_singular') : licenseCount < 5 ? t('business.license_2_4') : t('business.license_plural')}
            </Badge>
          </div>

          <h2 className="text-xl font-bold">{t('business.your_gyms')}</h2>

          <div className="space-y-3">
            {gyms.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  selectGym(g);
                  setShowGymList(false);
                }}
                className="w-full p-4 bg-card rounded-xl border flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {g.logo_url ? (
                    <img src={g.logo_url} alt={g.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <Building2 className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{g.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={g.is_published ? 'default' : 'secondary'} className="text-xs">
                      {g.is_published ? t('business.published') : t('business.private')}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>

          {canCreateMoreGyms() && (
            <Button
              onClick={() => {
                setShowGymList(false);
                setShowCreateForm(true);
              }}
              variant="outline"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('business.add_gym')}
            </Button>
          )}
        </div>
      </BusinessLayout>
    );
  }

  // Show create form
  if (showCreateForm) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setShowCreateForm(false)}
            className="mb-2"
          >
            {t('business.back')}
          </Button>
          <CreateGymForm onSuccess={() => {
            refetch();
            setShowCreateForm(false);
          }} />
        </div>
      </BusinessLayout>
    );
  }

  // No gym yet - prompt to create
  if (gyms.length === 0) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              {t('business.no_gym_profile')}
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Vytvořte si profil své posilovny, abyste mohli spravovat stroje a zveřejnit ji na mapě.
              <span className="block mt-1 font-medium">
                Vaše licence: {licenseCount} {licenseCount === 1 ? t('business.license_singular') : licenseCount < 5 ? t('business.license_2_4') : t('business.license_plural')}
              </span>
            </AlertDescription>
          </Alert>
          <Button onClick={() => setShowCreateForm(true)} className="w-full">
            {t('business.create_gym_profile')}
          </Button>
        </div>
      </BusinessLayout>
    );
  }

  // Show gym profile with option to switch if multiple gyms
  return (
    <BusinessLayout>
      {gyms.length > 1 && (
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGymList(true)}
          >
            <Building2 className="w-4 h-4 mr-2" />
            {t('business.switch_gym')}
          </Button>
          <Badge variant="outline">
            {gyms.length} / {licenseCount}
          </Badge>
        </div>
      )}

      {gyms.length === 1 && canCreateMoreGyms() && (
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('business.add_gym')}
          </Button>
          <Badge variant="outline">
            {gyms.length} / {licenseCount}
          </Badge>
        </div>
      )}

      <GymProfile gym={gym!} />
    </BusinessLayout>
  );
};

export default GymDashboard;
