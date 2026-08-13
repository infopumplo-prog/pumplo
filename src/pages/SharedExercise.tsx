import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, Download, ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SharedExercise {
  id: string; name: string; name_en: string | null; category: string | null; unit_type: string | null;
  primary_muscles: string[] | null; primary_muscles_en: string[] | null;
  video_path: string | null; description: string | null; description_en: string | null;
  owner_id: string | null; author_name: string | null;
}

export default function SharedExercisePage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const navigate = useNavigate();
  const [ex, setEx] = useState<SharedExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthed(!!user);
      if (!id) { setLoading(false); return; }
      const { data } = await supabase.rpc('get_shared_exercise', { p_id: id });
      setEx((Array.isArray(data) ? data[0] : data) as SharedExercise ?? null);
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    if (!authed) { navigate('/auth'); return; }
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.rpc('save_shared_exercise', { p_id: id });
    setSaving(false);
    if (error) { toast.error(t('shared_exercise.save_failed')); return; }
    setSaved(true);
    toast.success(t('shared_exercise.saved'));
  }

  const name = ex ? ((isEn && ex.name_en) ? ex.name_en : ex.name) : '';
  const muscles = ex ? ((isEn && ex.primary_muscles_en?.length) ? ex.primary_muscles_en : ex.primary_muscles) ?? [] : [];
  const desc = ex ? ((isEn && ex.description_en) ? ex.description_en : ex.description) : null;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!ex) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-3">
      <p className="text-lg font-semibold">{t('shared_exercise.not_found')}</p>
      <button onClick={() => navigate('/')} className="text-sm text-primary underline">{t('shared_exercise.to_app')}</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pt-6 pb-24">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Pumplo
        </button>

        {ex.video_path && (
          <video src={ex.video_path} className="w-full rounded-2xl border border-border bg-black mb-4" controls loop muted playsInline />
        )}

        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600">{t('exercise_picker.custom_badge')}</span>
          {ex.author_name && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="w-3 h-3" /> {t('shared_exercise.from_author', { name: ex.author_name })}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{name}</h1>
        {muscles.length > 0 && <p className="text-sm text-muted-foreground mt-1">{muscles.join(', ')}</p>}
        {desc && <p className="text-sm mt-4 whitespace-pre-wrap">{desc}</p>}

        <p className="text-xs text-muted-foreground mt-6">{t('shared_exercise.explainer')}</p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto">
          <button onClick={save} disabled={saving || saved}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            {saved ? t('shared_exercise.saved') : !authed ? t('shared_exercise.login_to_save') : t('shared_exercise.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
