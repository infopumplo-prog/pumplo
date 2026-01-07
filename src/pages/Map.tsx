import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUserProfile } from '@/hooks/useUserProfile';
import OnboardingWarning from '@/components/OnboardingWarning';
import OnboardingDrawer from '@/components/OnboardingDrawer';

const Map = () => {
  const { profile } = useUserProfile();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  if (!isOnboardingComplete) {
    return (
      <div className="min-h-screen bg-background safe-top">
        {/* Onboarding Warning */}
        <div className="pt-4">
          <OnboardingWarning onClick={() => setOnboardingOpen(true)} />
        </div>

        {/* Locked State */}
        <div className="flex flex-col items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Mapa je uzamčená</h2>
            <p className="text-muted-foreground mb-6">
              Pro přístup k mapě posiloven nejdříve vyplň dotazník
            </p>
            <button
              onClick={() => setOnboardingOpen(true)}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Vyplnit dotazník
            </button>
          </motion.div>
        </div>

        <OnboardingDrawer open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-4">Mapa</h1>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Hledat posilovny..."
              className="pl-12"
            />
          </div>
        </motion.div>
      </div>

      {/* Map Placeholder */}
      <motion.div
        className="mx-6 rounded-2xl bg-muted/50 h-80 flex flex-col items-center justify-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <p className="text-muted-foreground font-medium">Mapa posiloven</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Brzy k dispozici</p>
      </motion.div>

      {/* Nearby Gyms */}
      <motion.div
        className="px-6 py-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Posilovny poblíž</h3>
        
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-card"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Map;
