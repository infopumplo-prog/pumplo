import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronLeft, Check, Building2, MessageSquare, User, Camera, Plus, X, Phone, Mail, Award } from 'lucide-react';
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

interface PricingItem {
  name: string;
  price: number | null;
}

interface Certification {
  name: string;
  description: string;
  date: string;
}

const BecomeTrainer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  // Step 1: Profile
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.avatar_url || null);
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [instagram, setInstagram] = useState('');
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [pricing, setPricing] = useState<PricingItem[]>([
    { name: 'Individuální trénink (60 min)', price: null },
  ]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Step 2: Gym
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [isLoadingGyms, setIsLoadingGyms] = useState(false);
  // Step 3: Message
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (step === 2) fetchGyms();
  }, [step]);

  const fetchGyms = async () => {
    setIsLoadingGyms(true);
    const { data } = await supabase
      .from('gyms')
      .select('id, name, address, logo_url')
      .eq('is_published', true)
      .order('name');
    setGyms(data || []);
    setIsLoadingGyms(false);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;
    setUploadingPhoto(true);
    const ext = file.name.split('.').pop();
    const path = `trainers/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('gym-assets').upload(path, file, { cacheControl: '3600' });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('gym-assets').getPublicUrl(path);
      setPhotoUrl(publicUrl);
    }
    setUploadingPhoto(false);
  };

  const handleSubmit = async () => {
    if (!user || !selectedGymId || !photoUrl) return;
    setIsSubmitting(true);
    try {
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Trenér';
      const specsArray = specializations.split(',').map(s => s.trim()).filter(Boolean);

      // 1. Insert trainer role
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'trainer' as any }).single();

      // 2. Insert into gym_trainers
      const { error: trainerError } = await supabase.from('gym_trainers' as any).insert({
        gym_id: selectedGymId,
        user_id: user.id,
        name: fullName,
        photo_url: photoUrl,
        bio,
        specializations: specsArray,
        certifications: certifications.filter(c => c.name),
        pricing: pricing.filter(p => p.name && p.price),
        contact: { phone: phone || undefined, email: email || undefined, instagram: instagram || undefined },
        status: 'pending',
        is_active: false,
      } as any);
      if (trainerError) throw trainerError;

      // 3. Insert request
      const { error: reqError } = await supabase.from('trainer_gym_requests' as any).insert({
        user_id: user.id, gym_id: selectedGymId, message: message || null, status: 'pending',
      } as any);
      if (reqError) throw reqError;

      toast({ title: 'Žádost odeslána', description: 'Vyčkejte na schválení majitelem posilovny.' });
      navigate('/profile');
    } catch (error: any) {
      console.error('Trainer registration error:', error);
      toast({ title: 'Chyba', description: error.message || 'Nepodařilo se odeslat žádost.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep1 = !!photoUrl && bio.trim().length > 0 && specializations.trim().length > 0;
  const canProceedStep2 = selectedGymId !== null;

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-4 px-4 py-4">
            <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/profile')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Stát se trenérem</h1>
              <p className="text-sm text-muted-foreground">Krok {step} ze 3</p>
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>
        </div>

        <motion.div className="px-4 py-6 space-y-5 pb-32" variants={containerVariants} initial="hidden" animate="visible" key={step}>
          {/* STEP 1: Profile */}
          {step === 1 && (
            <>
              {/* Photo */}
              <motion.div variants={itemVariants}>
                <Label className="mb-2 block">Profilová fotka *</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-primary" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
                    {photoUrl ? 'Změnit fotku' : 'Nahrát fotku'}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }} />
                </div>
                {!photoUrl && <p className="text-xs text-destructive mt-1">Profilová fotka je povinná</p>}
              </motion.div>

              {/* Bio */}
              <motion.div variants={itemVariants}>
                <Label htmlFor="bio">O vás *</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Popište své zkušenosti, přístup k trénování..." rows={4} className="mt-1" />
              </motion.div>

              {/* Specializations */}
              <motion.div variants={itemVariants}>
                <Label htmlFor="specs">Specializace *</Label>
                <Input id="specs" value={specializations} onChange={(e) => setSpecializations(e.target.value)} placeholder="Silový trénink, Hubnutí, Rehabilitace..." className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Oddělte čárkou</p>
              </motion.div>

              {/* Contact */}
              <motion.div variants={itemVariants} className="space-y-3">
                <Label>Kontakt</Label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" />
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm shrink-0 w-4 text-center">@</span>
                  <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" />
                </div>
              </motion.div>

              {/* Certifications */}
              <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-2">
                  <Label>Certifikace</Label>
                  <button onClick={() => setCertifications([...certifications, { name: '', description: '', date: '' }])} className="text-xs text-primary font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Přidat
                  </button>
                </div>
                {certifications.map((cert, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={cert.name} onChange={(e) => { const c = [...certifications]; c[i] = { ...c[i], name: e.target.value }; setCertifications(c); }} placeholder="Název certifikace" className="flex-1" />
                    <Input value={cert.date} onChange={(e) => { const c = [...certifications]; c[i] = { ...c[i], date: e.target.value }; setCertifications(c); }} placeholder="Rok" className="w-20" />
                    <button onClick={() => setCertifications(certifications.filter((_, j) => j !== i))} className="p-2 text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </motion.div>

              {/* Pricing */}
              <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-2">
                  <Label>Ceník</Label>
                  <button onClick={() => setPricing([...pricing, { name: '', price: null }])} className="text-xs text-primary font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Přidat
                  </button>
                </div>
                {pricing.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={item.name} onChange={(e) => { const p = [...pricing]; p[i] = { ...p[i], name: e.target.value }; setPricing(p); }} placeholder="Služba" className="flex-1" />
                    <Input type="number" value={item.price ?? ''} onChange={(e) => { const p = [...pricing]; p[i] = { ...p[i], price: e.target.value ? parseInt(e.target.value) : null }; setPricing(p); }} placeholder="Kč" className="w-24" />
                    <button onClick={() => setPricing(pricing.filter((_, j) => j !== i))} className="p-2 text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full" size="lg">
                  Pokračovat <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </>
          )}

          {/* STEP 2: Select Gym */}
          {step === 2 && (
            <>
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Vyberte posilovnu</h2>
                </div>
              </motion.div>

              {isLoadingGyms ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <motion.div variants={itemVariants}>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    {gyms.map((gym, index) => (
                      <button key={gym.id} onClick={() => setSelectedGymId(gym.id)} className={`w-full flex items-center gap-4 p-4 transition-colors ${index !== gyms.length - 1 ? 'border-b border-border' : ''} ${selectedGymId === gym.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
                        {gym.logo_url ? (
                          <img src={gym.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-white border border-border" />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-muted-foreground" /></div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">{gym.name}</p>
                          {gym.address && <p className="text-sm text-muted-foreground truncate">{gym.address}</p>}
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
                <Button onClick={() => setStep(1)} variant="outline" size="lg" className="flex-1"><ChevronLeft className="w-5 h-5 mr-1" /> Zpět</Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="flex-1" size="lg">Pokračovat <ChevronRight className="w-5 h-5 ml-1" /></Button>
              </motion.div>
            </>
          )}

          {/* STEP 3: Message + Summary */}
          {step === 3 && (
            <>
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Zpráva pro majitele</h2>
                </div>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Proč chcete trénovat v této posilovně?" rows={3} />
              </motion.div>

              {/* Summary */}
              <motion.div variants={itemVariants}>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Shrnutí</h3>
                  <div className="flex items-center gap-3">
                    {photoUrl && <img src={photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                    <div>
                      <p className="font-semibold">{[profile?.first_name, profile?.last_name].filter(Boolean).join(' ')}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">{specializations}</p>
                    </div>
                  </div>
                  {certifications.filter(c => c.name).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {certifications.filter(c => c.name).map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{c.name} ({c.date})</span>
                      ))}
                    </div>
                  )}
                  {pricing.filter(p => p.name && p.price).length > 0 && (
                    <div className="text-sm space-y-1">
                      {pricing.filter(p => p.name && p.price).map((p, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">{p.name}</span>
                          <span className="font-medium">{p.price} Kč</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Posilovna: <span className="text-foreground font-medium">{gyms.find(g => g.id === selectedGymId)?.name}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex gap-3">
                <Button onClick={() => setStep(2)} variant="outline" size="lg" className="flex-1"><ChevronLeft className="w-5 h-5 mr-1" /> Zpět</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1" size="lg">
                  {isSubmitting ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Odesílám...</> : <><Check className="w-5 h-5 mr-1" />Odeslat žádost</>}
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
