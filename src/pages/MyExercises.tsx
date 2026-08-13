import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Pencil, Trash2, Video, Users, Loader2, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MyEx { id: string; name: string; name_en: string | null; category: string | null; video_path: string | null; primary_muscles: string[] | null; save_count: number }

const MUSCLE_GROUPS: { label: string; category: string }[] = [
  { label: 'Prsa', category: 'chest' }, { label: 'Záda', category: 'back' }, { label: 'Ramena', category: 'shoulders' },
  { label: 'Ruce', category: 'arms' }, { label: 'Nohy', category: 'legs' }, { label: 'Hýždě', category: 'legs' },
  { label: 'Břicho / core', category: 'core' }, { label: 'Kardio', category: 'cardio' }, { label: 'Celé tělo', category: 'full_body' },
];

const emptyForm = {
  id: '', name: '', name_en: '', muscle: 'Prsa', category: 'chest',
  units: 'weight_reps' as 'weight_reps' | 'reps' | 'time_min',
  description: '', description_en: '', video_path: '' as string | null,
};

export default function MyExercisesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<MyEx[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteItem, setDeleteItem] = useState<MyEx | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('my_custom_exercises');
    setItems((data ?? []) as MyEx[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...emptyForm }); setEditorOpen(true); }
  async function openEdit(it: MyEx) {
    const { data } = await supabase.from('exercises')
      .select('id, name, name_en, category, unit_type, description, description_en, video_path, primary_muscles')
      .eq('id', it.id).single();
    const d = data as any;
    const mg = MUSCLE_GROUPS.find(m => m.label === (d?.primary_muscles?.[0])) ?? MUSCLE_GROUPS.find(m => m.category === d?.category) ?? MUSCLE_GROUPS[0];
    setForm({
      id: d.id, name: d.name ?? '', name_en: d.name_en ?? '',
      muscle: mg.label, category: mg.category,
      units: d.unit_type === 'time_min' ? 'time_min' : (d.exercise_with_weights === false ? 'reps' : 'weight_reps'),
      description: d.description ?? '', description_en: d.description_en ?? '', video_path: d.video_path ?? '',
    });
    setEditorOpen(true);
  }

  async function uploadVideo(file: File) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split('.').pop() || 'mp4';
    const path = `custom/${user?.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('exercise-videos').upload(path, file, { upsert: false, contentType: file.type || 'video/mp4' });
    if (error) { setUploading(false); toast.error(t('my_exercises.video_failed')); return; }
    const { data: { publicUrl } } = supabase.storage.from('exercise-videos').getPublicUrl(path);
    setForm(f => ({ ...f, video_path: publicUrl }));
    setUploading(false);
  }

  async function save() {
    if (!form.name.trim()) { toast.error(t('my_exercises.name_required')); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      name: form.name.trim(), name_en: form.name_en.trim() || null,
      category: form.category, primary_muscles: [form.muscle],
      unit_type: form.units === 'time_min' ? 'time_min' : 'reps',
      exercise_with_weights: form.units === 'weight_reps',
      equipment_type: form.units === 'weight_reps' ? 'free_weight' : 'bodyweight',
      description: form.description.trim() || null, description_en: form.description_en.trim() || null,
      video_path: form.video_path || null,
      slot_type: 'main', is_compound: false, owner_id: user?.id,
    };
    const { error } = form.id
      ? await supabase.from('exercises').update(payload).eq('id', form.id)
      : await supabase.from('exercises').insert(payload);
    setSaving(false);
    if (error) { toast.error(t('my_exercises.save_failed') + ': ' + error.message); return; }
    toast.success(form.id ? t('my_exercises.saved') : t('my_exercises.created'));
    setEditorOpen(false);
    load();
  }

  async function doDelete() {
    if (!deleteItem) return;
    const { error } = await supabase.from('exercises').delete().eq('id', deleteItem.id);
    if (error) { toast.error(t('my_exercises.delete_failed')); return; }
    toast.success(t('my_exercises.deleted'));
    setDeleteItem(null);
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">
        <button onClick={() => navigate('/profile')} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> {t('my_exercises.title')}
        </button>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t('my_exercises.empty')}</p>
        ) : (
          <div className="space-y-2">
            {items.map(it => (
              <div key={it.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                {it.video_path
                  ? <video src={it.video_path} className="w-12 h-12 rounded-lg object-cover border border-border" muted />
                  : <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"><Video className="w-4 h-4" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{it.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> {t('my_exercises.saved_by', { count: it.save_count })}
                  </p>
                </div>
                <button onClick={() => openEdit(it)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeleteItem(it)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto">
          <button onClick={openNew} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> {t('my_exercises.new')}
          </button>
        </div>
      </div>

      {/* Editor */}
      {editorOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setEditorOpen(false)}>
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{form.id ? t('my_exercises.edit') : t('my_exercises.new')}</h2>
              <button onClick={() => setEditorOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.name')}</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="Kotrmelec…" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.name_en')}</label>
              <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="English name…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.muscle')}</label>
                <select value={form.muscle} onChange={e => { const m = MUSCLE_GROUPS.find(x => x.label === e.target.value)!; setForm({ ...form, muscle: m.label, category: m.category }); }}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  {MUSCLE_GROUPS.map(m => <option key={m.label} value={m.label}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.units')}</label>
                <select value={form.units} onChange={e => setForm({ ...form, units: e.target.value as typeof form.units })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="weight_reps">{t('exercise_picker.custom_units_weight')}</option>
                  <option value="reps">{t('exercise_picker.custom_units_reps')}</option>
                  <option value="time_min">{t('exercise_picker.custom_units_time')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.video')}</label>
              {form.video_path ? (
                <div className="relative mt-1">
                  <video src={form.video_path} className="w-full rounded-lg border border-border bg-black" controls muted />
                  <button onClick={() => setForm({ ...form, video_path: '' })} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => videoInput.current?.click()} disabled={uploading}
                  className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-input text-sm text-muted-foreground disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? t('my_exercises.uploading') : t('my_exercises.upload_video')}
                </button>
              )}
              <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,.mov" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ''; }} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.description')}</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y" placeholder={t('my_exercises.description_ph')} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.description_en')}</label>
              <textarea value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} rows={3}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y" placeholder="English description…" />
            </div>

            <button onClick={save} disabled={saving} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
              {saving ? t('my_exercises.saving') : t('my_exercises.save')}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteItem && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center px-6" onClick={() => setDeleteItem(null)}>
          <div className="bg-background rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-semibold">{t('my_exercises.delete_title')}</p>
            <p className="text-sm text-muted-foreground">{t('my_exercises.delete_warn', { count: deleteItem.save_count })}</p>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setDeleteItem(null)} className="px-4 py-2 rounded-lg border border-input text-sm">{t('my_exercises.cancel')}</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium">{t('my_exercises.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
