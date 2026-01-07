import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import BusinessLayout from './BusinessLayout';
import CreateGymForm from '@/components/business/CreateGymForm';
import GymProfile from '@/components/business/GymProfile';
import { useGym } from '@/hooks/useGym';
import { useState } from 'react';

const GymDashboard = () => {
  const { gym, isLoading } = useGym();
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (isLoading) {
    return (
      <BusinessLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  // No gym yet
  if (!gym && !showCreateForm) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              Nemáte vytvorený profil posilňovne
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Vytvorte si profil svojej posilňovne, aby ste mohli spravovať stroje a zverejniť ju na mape.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setShowCreateForm(true)} className="w-full">
            Vytvoriť profil posilňovne
          </Button>
        </div>
      </BusinessLayout>
    );
  }

  // Show create form
  if (!gym && showCreateForm) {
    return (
      <BusinessLayout>
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            onClick={() => setShowCreateForm(false)}
            className="mb-2"
          >
            ← Späť
          </Button>
          <CreateGymForm />
        </div>
      </BusinessLayout>
    );
  }

  // Show gym profile
  return (
    <BusinessLayout>
      <GymProfile gym={gym!} />
    </BusinessLayout>
  );
};

export default GymDashboard;
