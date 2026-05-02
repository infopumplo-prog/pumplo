import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface Gym {
  id: string;
  name: string;
  address: string;
  logo_url: string | null;
}

interface OnboardingGymStepProps {
  selectedGymId: string | null;
  onSelect: (gymId: string) => void;
}

const OnboardingGymStep = ({ selectedGymId, onSelect }: OnboardingGymStepProps) => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('gyms')
      .select('id, name, address, logo_url')
      .eq('is_published', true)
      .order('name')
      .then(({ data }) => setGyms(data ?? []));
  }, []);

  const filtered = gyms.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Ve které posilovně trénuješ?</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Odemkneme ti obsah a vybavení té správné posilovny
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Hledat posilovnu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map(gym => {
          const isSelected = selectedGymId === gym.id;
          return (
            <button
              key={gym.id}
              onClick={() => onSelect(gym.id)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/8 shadow-sm'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              {gym.logo_url ? (
                <img src={gym.logo_url} alt={gym.name} className="w-10 h-10 rounded-lg object-contain bg-white shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{gym.name}</p>
                <p className="text-xs text-muted-foreground truncate">{gym.address}</p>
              </div>
              {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Žádná posilovna nenalezena
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default OnboardingGymStep;
