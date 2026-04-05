import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Phone, Mail, Instagram, DollarSign, Plus, X, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import PageTransition from '@/components/PageTransition';

interface TrainerRecord {
  id: string;
  gym_id: string;
  name: string;
  bio: string | null;
  specializations: string[] | null;
  pricing: { name: string; price: number }[] | null;
  contact: { phone?: string; email?: string; instagram?: string } | null;
  status: string | null;
  is_active: boolean;
  gym_name?: string;
}

interface PricingItem {
  name: string;
  price: number;
}

const getStatusLabel = (status: string | null): string => {
  switch (status) {
    case 'approved': return 'Schváleno';
    case 'pending': return 'Čeká na schválení';
    case 'rejected': return 'Zamítnuto';
    default: return 'Neznámý';
  }
};

const getStatusVariant = (status: string | null): 'default' | 'secondary' | 'destructive' => {
  switch (status) {
    case 'approved': return 'default';
    case 'pending': return 'secondary';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
};

const TrainerProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [trainerRecords, setTrainerRecords] = useState<TrainerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields (from the first record)
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactInstagram, setContactInstagram] = useState('');

  useEffect(() => {
    if (user) {
      fetchTrainerData();
    }
  }, [user]);

  const fetchTrainerData = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('gym_trainers' as any)
      .select('id, gym_id, name, bio, specializations, pricing, contact, status, is_active')
      .eq('user_id', user.id) as any;

    if (error) {
      console.error('Error fetching trainer data:', error);
      setIsLoading(false);
      return;
    }

    const records = (data || []) as TrainerRecord[];

    // Fetch gym names
    if (records.length > 0) {
      const gymIds = records.map(r => r.gym_id);
      const { data: gymsData } = await supabase
        .from('gyms')
        .select('id, name')
        .in('id', gymIds);

      if (gymsData) {
        const gymMap = new Map(gymsData.map(g => [g.id, g.name]));
        records.forEach(r => {
          r.gym_name = gymMap.get(r.gym_id) || 'Neznámá posilovna';
        });
      }
    }

    setTrainerRecords(records);

    // Populate form from first record
    if (records.length > 0) {
      const first = records[0];
      setBio(first.bio || '');
      setSpecializations((first.specializations || []).join(', '));
      setPricing((first.pricing as PricingItem[]) || []);
      const contact = (first.contact || {}) as { phone?: string; email?: string; instagram?: string };
      setContactPhone(contact.phone || '');
      setContactEmail(contact.email || '');
      setContactInstagram(contact.instagram || '');
    }

    setIsLoading(false);
  };

  const addPricingItem = () => {
    setPricing([...pricing, { name: '', price: 0 }]);
  };

  const removePricingItem = (index: number) => {
    setPricing(pricing.filter((_, i) => i !== index));
  };

  const updatePricingItem = (index: number, field: keyof PricingItem, value: string | number) => {
    const updated = [...pricing];
    if (field === 'price') {
      updated[index] = { ...updated[index], price: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPricing(updated);
  };

  const handleSave = async () => {
    if (!user || trainerRecords.length === 0) return;

    setIsSaving(true);
    try {
      const specsArray = specializations
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const contact: Record<string, string> = {};
      if (contactPhone.trim()) contact.phone = contactPhone.trim();
      if (contactEmail.trim()) contact.email = contactEmail.trim();
      if (contactInstagram.trim()) contact.instagram = contactInstagram.trim();

      // Update all trainer records for this user
      for (const record of trainerRecords) {
        const { error } = await supabase
          .from('gym_trainers' as any)
          .update({
            bio,
            specializations: specsArray,
            pricing: pricing.filter(p => p.name.trim()),
            contact: Object.keys(contact).length > 0 ? contact : null,
          } as any)
          .eq('id', record.id) as any;

        if (error) throw error;
      }

      toast({
        title: 'Uloženo',
        description: 'Trenérský profil byl úspěšně aktualizován.',
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se uložit změny.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

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

  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Trenérský profil</h1>
          </div>
        </div>

        <motion.div
          className="px-4 py-6 space-y-6 pb-32"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Associated Gyms */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Posilovny</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
              {trainerRecords.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Zatím nemáte přiřazené žádné posilovny
                </div>
              ) : (
                trainerRecords.map((record, index) => (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-4 ${
                      index !== trainerRecords.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="font-medium truncate">{record.gym_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(record.status)}>
                        {record.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {getStatusLabel(record.status)}
                      </Badge>
                      <button
                        onClick={async () => {
                          if (!confirm(`Opravdu chcete odejít z ${record.gym_name}?`)) return;
                          await supabase.from('gym_trainers' as any).delete().eq('id', record.id);
                          await supabase.from('trainer_gym_requests' as any).delete().eq('user_id', user!.id).eq('gym_id', record.gym_id);
                          setTrainerRecords(prev => prev.filter(r => r.id !== record.id));
                          toast({ title: 'Odešli jste z posilovny', description: record.gym_name });
                        }}
                        className="text-xs text-destructive hover:underline"
                      >
                        Odejít
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Bio */}
          <motion.div variants={itemVariants}>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Popište své zkušenosti a přístup..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specializations">Specializace</Label>
                <Input
                  id="specializations"
                  value={specializations}
                  onChange={(e) => setSpecializations(e.target.value)}
                  placeholder="např. Silový trénink, Hubnutí, Rehabilitace"
                />
                <p className="text-xs text-muted-foreground">Oddělte čárkou</p>
              </div>
            </div>
          </motion.div>

          {/* Pricing */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <h2 className="text-lg font-semibold">Ceník</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              {pricing.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updatePricingItem(index, 'name', e.target.value)}
                    placeholder="Název služby"
                    className="flex-1"
                  />
                  <div className="relative w-28">
                    <Input
                      type="number"
                      value={item.price || ''}
                      onChange={(e) => updatePricingItem(index, 'price', e.target.value)}
                      placeholder="Cena"
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Kč
                    </span>
                  </div>
                  <button
                    onClick={() => removePricingItem(index)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addPricingItem}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Přidat položku
              </Button>
            </div>
          </motion.div>

          {/* Contact */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold">Kontakt</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telefon
                </Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+420 123 456 789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  E-mail
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="trener@email.cz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactInstagram" className="flex items-center gap-2">
                  <Instagram className="w-4 h-4" />
                  Instagram
                </Label>
                <Input
                  id="contactInstagram"
                  value={contactInstagram}
                  onChange={(e) => setContactInstagram(e.target.value)}
                  placeholder="@username"
                />
              </div>
            </div>
          </motion.div>

          {/* Save */}
          <motion.div variants={itemVariants}>
            <Button
              onClick={handleSave}
              disabled={isSaving || trainerRecords.length === 0}
              className="w-full"
              size="lg"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Ukládám...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Uložit změny
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default TrainerProfile;
