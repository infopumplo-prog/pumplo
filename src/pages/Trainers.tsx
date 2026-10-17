/* eslint-disable @typescript-eslint/no-explicit-any */
// Stránka se všemi trenéry (feedback 13. 10.): schválení a aktivní trenéři ze všech posiloven
// včetně Pumplo týmu; demo posilovna se nezobrazuje (17. 10.). Moje posilovna → Pumplo → ostatní.
// Po registraci se zraněním sem appka přesměruje s úvodním bannerem (?intro=injury).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, HeartPulse, Instagram, Mail, Phone, X } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import davidPhoto from '@/assets/david-benisek.png';
import TrainerDetailDrawer from '@/components/business/TrainerDetailDrawer';
import type { Trainer } from '@/components/business/GymTrainersTab';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  PUMPLO_GYM_ID,
  filterVisibleTrainers,
  instagramUrl,
  sortTrainers,
  dedupeTrainers,
} from '@/lib/trainersDirectory';

interface DirectoryTrainer extends Trainer {
  gym_id: string;
  status: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2);

const Trainers = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useUserProfile();
  const [rows, setRows] = useState<DirectoryTrainer[]>([]);
  const [gymNames, setGymNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Trainer | null>(null);
  const showInjuryIntro = searchParams.get('intro') === 'injury';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setFailed(false);
      // RLS „Anyone can read trainers" — čtení trenérů všech posiloven je povolené, RPC není potřeba.
      const { data, error } = await supabase
        .from('gym_trainers')
        .select('*')
        .eq('status', 'approved')
        .eq('is_active', true);
      if (cancelled) return;
      if (error || !data) {
        setFailed(true);
        setIsLoading(false);
        return;
      }
      const mapped: DirectoryTrainer[] = data.map((r: any) => ({
        id: r.id,
        gym_id: r.gym_id,
        status: r.status,
        is_active: r.is_active,
        sort_order: r.sort_order,
        name: r.name,
        photo: r.photo_url || (r.gym_id === PUMPLO_GYM_ID && /beníšek/i.test(r.name) ? davidPhoto : ''),
        bio: r.bio || '',
        bio_en: r.bio_en || null,
        specializations: r.specializations || [],
        specializations_en: r.specializations_en || null,
        certifications: r.certifications || [],
        pricing: r.pricing || [],
        contact: r.contact || {},
      }));
      const gymIds = [...new Set(mapped.map((m) => m.gym_id))];
      const names: Record<string, string> = {};
      if (gymIds.length > 0) {
        const { data: gyms } = await supabase.from('gyms').select('id, name').in('id', gymIds);
        for (const g of gyms ?? []) names[g.id] = g.name;
      }
      // Skrytá posilovna Pumplo týmu se uživatelům ukazuje prostě jako „Pumplo".
      names[PUMPLO_GYM_ID] = 'Pumplo';
      if (cancelled) return;
      setRows(mapped);
      setGymNames(names);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const trainers = useMemo(
    () => sortTrainers(dedupeTrainers(filterVisibleTrainers(rows)), profile?.selected_gym_id, gymNames),
    [rows, profile?.selected_gym_id, gymNames],
  );

  const dismissIntro = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('intro');
    setSearchParams(next, { replace: true });
  };

  const contactBtn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/60 text-xs font-medium hover:bg-muted transition-colors';

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-nav">
        <div className="gradient-hero px-6 safe-top-hero pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              className="p-2 -ml-2 rounded-full hover:bg-muted/50"
              aria-label={t('trainers.back')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">{t('trainers.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('trainers.subtitle')}</p>
        </div>

        <div className="px-4 pt-4 space-y-3">
          {showInjuryIntro && (
            <div className="relative rounded-2xl border border-primary/30 bg-primary/10 p-4 pr-10">
              <button
                onClick={dismissIntro}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-primary/15"
                aria-label={t('trainers.intro_dismiss')}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-3">
                <HeartPulse className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{t('trainers.injury_intro_title')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('trainers.injury_intro_body')}</p>
                  <button
                    onClick={() => navigate('/', { replace: true })}
                    className="mt-3 text-sm font-semibold text-primary"
                  >
                    {t('trainers.injury_intro_skip')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && failed && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('trainers.load_failed')}</p>
          )}

          {!isLoading && !failed && trainers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('trainers.empty')}</p>
          )}

          {!isLoading && trainers.map((trainer) => {
            const specs = isEn && trainer.specializations_en?.length ? trainer.specializations_en : trainer.specializations;
            const bio = (isEn && trainer.bio_en) ? trainer.bio_en : trainer.bio;
            const isMyGym = !!profile?.selected_gym_id && trainer.gym_id === profile.selected_gym_id;
            const { phone, email, instagram } = trainer.contact;
            return (
              <div key={trainer.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <button onClick={() => setSelected(trainer)} className="w-full flex items-center gap-3 text-left">
                  {trainer.photo ? (
                    <img src={trainer.photo} alt={trainer.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                      {initials(trainer.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{trainer.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {gymNames[trainer.gym_id] ?? ''}
                      {isMyGym && <span className="ml-1.5 text-primary font-medium">· {t('trainers.my_gym')}</span>}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary shrink-0" />
                </button>

                {specs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {specs.slice(0, 4).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">{s}</span>
                    ))}
                  </div>
                )}

                {bio && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{bio}</p>}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {phone && (
                    <a href={`tel:${phone.replace(/\s+/g, '')}`} className={contactBtn}>
                      <Phone className="w-4 h-4 text-primary" /> {t('trainers.call')}
                    </a>
                  )}
                  {email && (
                    <a href={`mailto:${email}`} className={contactBtn}>
                      <Mail className="w-4 h-4 text-primary" /> {t('trainers.email')}
                    </a>
                  )}
                  {instagram && (
                    <a href={instagramUrl(instagram)} target="_blank" rel="noopener noreferrer" className={contactBtn}>
                      <Instagram className="w-4 h-4 text-primary" /> Instagram
                    </a>
                  )}
                  <button onClick={() => setSelected(trainer)} className={`${contactBtn} ml-auto text-primary`}>
                    {t('trainers.profile')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TrainerDetailDrawer
        trainer={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </PageTransition>
  );
};

export default Trainers;
