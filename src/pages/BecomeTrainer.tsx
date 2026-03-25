import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronLeft, Check, Building2, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import PageTransition from '@/components/PageTransition';

interface Gym {
  id: string;
  name: string;
  address: string | null;
  logo_url: string | null;
}

const BecomeTrainer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingGyms, setIsLoadingGyms] = useState(false);

  useEffect(() => {
    if (step === 2) {
      fetchGyms();
    }
  }, [step]);

  const fetchGyms = async () => {
    setIsLoadingGyms(true);
    const { data, error } = await supabase
      .from('gyms')
      .select('id, name, address, logo_url')
      .eq('is_published', true)
      .order('name');

    if (error) {
      console.error('Error fetching gyms:', error);
    } else {
      setGyms(data || []);
    }
    setIsLoadingGyms(false);
  };

  const handleSubmit = async () => {
    if (!user || !selectedGymId) return;

    setIsSubmitting(true);
    try {
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Trenér';
      const specsArray = specializations
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      // 1. Insert trainer role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'trainer' as any });

      if (roleError) {
        // If role already exists, ignore
        if (!roleError.message.includes('duplicate')) {
          throw roleError;
        }
      }

      // 2. Insert into gym_trainers
      const { error: trainerError } = await supabase
        .from('gym_trainers' as any)
        .insert({
          gym_id: selectedGymId,
          user_id: user.id,
          name: fullName,
          bio,
          specializations: specsArray,
          status: 'pending',
          is_active: false,
        } as any);

      if (trainerError) throw trainerError;

      // 3. Insert into trainer_gym_requests
      const { error: requestError } = await supabase
        .from('trainer_gym_requests' as any)
        .insert({
          user_id: user.id,
          gym_id: selectedGymId,
          message: message || null,
          status: 'pending',
        } as any);

      if (requestError) throw requestError;

      toast({
        title: 'Žádost odeslána',
        description: 'Vaše žádost byla úspěšně odeslána. Vyčkejte na schválení majitelem posilovny.',
      });

      navigate('/profile');
    } catch (error: any) {
      console.error('Trainer registration error:', error);
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se odeslat žádost.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep1 = bio.trim().length > 0 && specializations.trim().length > 0;
  const canProceedStep2 = selectedGymId !== null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/profile')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Stát se trenérem</h1>
              <p className="text-sm text-muted-foreground">Krok {step} ze 3</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="px-4 pb-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <motion.div
          className="px-4 py-6 space-y-6 pb-32"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          key={step}
        >
          {/* Step 1: Bio + Specializations */}
          {step === 1 && (
            <>
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">O vás</h2>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Popište své zkušenosti, přístup k trénování, certifikace..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Toto uvidí uživatelé na vašem trenérském profilu
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specializations">Specializace</Label>
                    <Input
                      id="specializations"
                      value={specializations}
                      onChange={(e) => setSpecializations(e.target.value)}
                      placeholder="např. Silový trénink, Hubnutí, Rehabilitace"
                    />
                    <p className="text-xs text-muted-foreground">
                      Oddělte čárkou
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="w-full"
                  size="lg"
                >
                  Pokračovat
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </>
          )}

          {/* Step 2: Select Gym */}
          {step === 2 && (
            <>
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Vyberte posilovnu</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Vyberte posilovnu, ve které chcete trénovat jako trenér.
                </p>
              </motion.div>

              {isLoadingGyms ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : gyms.length === 0 ? (
                <motion.div variants={itemVariants}>
                  <div className="text-center py-8 text-muted-foreground">
                    Žádné posilovny nejsou k dispozici
                  </div>
                </motion.div>
              ) : (
                <motion.div variants={itemVariants}>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
                    {gyms.map((gym, index) => (
                      <button
                        key={gym.id}
                        onClick={() => setSelectedGymId(gym.id)}
                        className={`w-full flex items-center gap-4 p-4 transition-colors ${
                          index !== gyms.length - 1 ? 'border-b border-border' : ''
                        } ${selectedGymId === gym.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                      >
                        {gym.logo_url ? (
                          <img
                            src={gym.logo_url}
                            alt={gym.name}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">{gym.name}</p>
                          {gym.address && (
                            <p className="text-sm text-muted-foreground truncate">{gym.address}</p>
                          )}
                        </div>
                        {selectedGymId === gym.id && (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.div variants={itemVariants} className="flex gap-3">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Zpět
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="flex-1"
                  size="lg"
                >
                  Pokračovat
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </>
          )}

          {/* Step 3: Message to gym owner */}
          {step === 3 && (
            <>
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Zpráva pro majitele</h2>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="message">Zpráva (volitelné)</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Proč chcete trénovat v této posilovně? Máte s nimi už nějakou zkušenost?"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tuto zprávu uvidí majitel posilovny při schvalování vaší žádosti
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Summary */}
              <motion.div variants={itemVariants}>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Shrnutí
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bio</span>
                      <span className="text-right max-w-[60%] truncate">{bio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Specializace</span>
                      <span className="text-right max-w-[60%] truncate">{specializations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Posilovna</span>
                      <span className="text-right max-w-[60%] truncate">
                        {gyms.find(g => g.id === selectedGymId)?.name || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex gap-3">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Zpět
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Odesílám...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-1" />
                      Odeslat žádost
                    </>
                  )}
                </Button>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default BecomeTrainer;
