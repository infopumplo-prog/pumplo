import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Pencil, Trash2, Video, Users, Loader2, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { compressVideoFile } from '@/lib/videoCompress';
import { supabase } from '@/integrations/supabase/client';
import { getVideoThumbUrl } from '@/lib/videoUtils';

interface MyEx { id: string; name: string; name_en: string | null; category: string | null; video_path: string | null; primary_muscles: string[] | null; save_count: number }

// Všech 10 partií jako v appce (getMuscleGroups). store = česká hodnota, kterou
// výběr cviků (ExercisePicker) rozpozná; label se bere z i18n custom_plan.muscle_<key>.
const MUSCLE_GROUPS: { key: string; store: string; category: string }[] = [
  { key: 'chest', store: 'Prsa', category: 'chest' },
  { key: 'back', store: 'Záda', category: 'back' },
  { key: 'shoulders', store: 'Ramena', category: 'shoulders' },
  { key: 'biceps', store: 'Biceps', category: 'arms' },
  { key: 'triceps', store: 'Triceps', category: 'arms' },
  { key: 'arms', store: 'Paže', category: 'arms' },
  { key: 'legs', store: 'Nohy', category: 'legs' },
  { key: 'glutes', store: 'Hýždě', category: 'glutes' },
  { key: 'calves', store: 'Lýtka', category: 'legs' },
  { key: 'core', store: 'Břicho', category: 'core' },
];

const emptyForm = {
  id: '', name: '', name_en: '', muscles: [] as string[],
  units: 'weight_reps' as 'weight_reps' | 'reps' | 'time_min',
  description: '', description_en: '', video_path: '' as string | null,
};
const categoryForMuscles = (muscles: string[]) =>
  MUSCLE_GROUPS.find(g => g.store === muscles[0])?.category ?? 'full_body';

const MAX_VIDEO_SEC = 20;
const MAX_VIDEO_MB = 50;
// Délka videa z metadat (bez přehrání) — pro validaci před uploadem.
function videoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(v.src); resolve(Number.isFinite(d) ? d : 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}



// Složka souboru v bucketu exercise-videos z veřejné URL (pro thumb.jpg vedle videa).
function storageFolderOf(publicUrl: string): string | null {
  const marker = '/exercise-videos/';
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  const file = publicUrl.substring(i + marker.length).split('?')[0];
  const slash = file.lastIndexOf('/');
  return slash === -1 ? null : file.substring(0, slash);
}

// Zmenší obrázek na maxPx po delší straně a vrátí JPEG.
function resizeImage(file: File, maxPx: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d'); if (!ctx) throw new Error('canvas');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('toBlob')); }, 'image/jpeg', 0.88);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

// První snímek videa jako JPEG (max 480 px na delší straně). Vrací null, když
// prohlížeč snímek nedokáže vykreslit (např. nepodporovaný kodek).
function captureFirstFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    let finished = false;
    const done = (b: Blob | null) => { if (finished) return; finished = true; clearTimeout(timer); URL.revokeObjectURL(v.src); resolve(b); };
    // iOS občas loadeddata/seeked vůbec nevyvolá → bez limitu by upload visel navždy (21. 9.)
    const timer = setTimeout(() => done(null), 6000);
    v.onerror = () => done(null);
    v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); } catch { done(null); } };
    v.onseeked = () => {
      try {
        const scale = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext('2d'); if (!ctx) return done(null);
        ctx.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => done(b), 'image/jpeg', 0.85);
      } catch { done(null); }
    };
    v.src = URL.createObjectURL(file);
  });
}

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
  const cameraInput = useRef<HTMLInputElement>(null);
  // iOS nabízí „Take Video“ přímo v systémovém výběru souboru, tlačítko Natočit je jen pro Android (David 21. 9.)
  const showRecordButton = Capacitor.getPlatform() === 'android';
  const [uploadStage, setUploadStage] = useState<'compress' | 'upload'>('upload'); // capture → Android nabídne kameru, iOS otevře rovnou natáčení
  const thumbInput = useRef<HTMLInputElement>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  // Po nahrání vlastního náhledu má URL stejné jméno (thumb.jpg) → cache-buster, ať se ukáže nový
  const [thumbVersion, setThumbVersion] = useState(0);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('my_custom_exercises');
    setItems((data ?? []) as MyEx[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...emptyForm }); setEditorOpen(true); }

  // Příchod z výběru cviků do vlastního plánu („+ Vytvořit vlastní cvik“): rovnou otevřít editor,
  // případně s předvyplněným názvem z vyhledávání.
  const [searchParams, setSearchParams] = useSearchParams();
  // Zpět vede tam, odkud uživatel přišel (výběr cviků ve vlastním plánu), jinak na Profil.
  const location = useLocation();
  const [backTo] = useState<string>(() => (location.state as { back?: string } | null)?.back || '/profile');
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    const name = searchParams.get('name') ?? '';
    setForm({ ...emptyForm, name });
    setEditorOpen(true);
    searchParams.delete('new'); searchParams.delete('name');
    setSearchParams(searchParams, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function openEdit(it: MyEx) {
    const { data } = await supabase.from('exercises')
      .select('id, name, name_en, category, unit_type, exercise_with_weights, description, description_en, video_path, primary_muscles')
      .eq('id', it.id).single();
    const d = data as any;
    const matched = (d?.primary_muscles || []).filter((m: string) => MUSCLE_GROUPS.some(g => g.store === m));
    const fallback = MUSCLE_GROUPS.find(m => m.category === d?.category);
    setForm({
      id: d.id, name: d.name ?? '', name_en: d.name_en ?? '',
      muscles: matched.length ? matched : (fallback ? [fallback.store] : []),
      units: d.unit_type === 'time_min' ? 'time_min' : (d.exercise_with_weights === false ? 'reps' : 'weight_reps'),
      description: d.description ?? '', description_en: d.description_en ?? '', video_path: d.video_path ?? '',
    });
    setEditorOpen(true);
  }

  // Vlastní náhledový obrázek (trenéři chtějí svoje): zmenšit na ≤640 px a přepsat <folder>/thumb.jpg
  async function uploadThumb(file: File) {
    if (!form.video_path) { toast.error(t('my_exercises.thumb_need_video')); return; }
    const folder = storageFolderOf(form.video_path);
    if (!folder) { toast.error(t('my_exercises.thumb_failed')); return; }
    setThumbUploading(true);
    try {
      const blob = await resizeImage(file, 640);
      const { error } = await supabase.storage.from('exercise-videos').upload(`${folder}/thumb.jpg`, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      setThumbVersion(v => v + 1);
      toast.success(t('my_exercises.thumb_saved'));
    } catch (e) {
      toast.error(t('my_exercises.thumb_failed') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setThumbUploading(false);
    }
  }

  async function uploadVideo(original: File) {
    const dur = await videoDuration(original);
    if (dur > MAX_VIDEO_SEC + 0.5) { toast.error(t('my_exercises.video_too_long', { sec: MAX_VIDEO_SEC })); return; }

    // Nativní komprese před uploadem (720p, ~2 Mb/s, bez zvuku) — záznam z kamery
    // Motoroly má 15 MB za pár sekund, po kompresi ~2 MB. Na webu se nahrává originál.
    setUploading(true);
    setUploadStage('compress');
    const file = await compressVideoFile(original);
    setUploadStage('upload');
    // Storage limit je 50 MB → radši ověřit předem a dát jasnou hlášku, ne tiché selhání.
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { setUploading(false); toast.error(t('my_exercises.video_too_big', { mb: MAX_VIDEO_MB })); return; }

    const { data: { user } } = await supabase.auth.getUser();
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    // Každý cvik má vlastní složku, aby vedle videa mohl ležet thumb.jpg
    // (stejná konvence jako katalog: <folder>/thumb.jpg → getVideoThumbUrl).
    const folder = `custom/${user?.id}/${Date.now()}`;
    const path = `${folder}/video.${ext}`;
    const { error } = await supabase.storage.from('exercise-videos').upload(path, file, { upsert: false, contentType: file.type || 'video/mp4' });
    if (error) { setUploading(false); toast.error(t('my_exercises.video_failed') + ': ' + error.message); return; }
    // Náhledový obrázek z prvního snímku — best effort, bez něj se ve výběru cviků ukáže video
    try {
      const thumb = await captureFirstFrame(original); // originál, ne zkomprimovaný blob — ten iOS nemusí načíst
      if (thumb) await supabase.storage.from('exercise-videos').upload(`${folder}/thumb.jpg`, thumb, { upsert: false, contentType: 'image/jpeg' });
    } catch (e) { console.warn('[my_exercises] thumb failed', e); }
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
      category: categoryForMuscles(form.muscles), primary_muscles: form.muscles.length ? form.muscles : ['Celé tělo'],
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
      <div className="max-w-md mx-auto px-4 pb-32" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <button onClick={() => navigate(backTo)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
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

      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 bg-background/95 backdrop-blur border-t border-border" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
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
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.muscle')}</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {MUSCLE_GROUPS.map(m => {
                  const on = form.muscles.includes(m.store);
                  return (
                    <button key={m.key} type="button"
                      onClick={() => setForm({ ...form, muscles: on ? form.muscles.filter(x => x !== m.store) : [...form.muscles, m.store] })}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground'}`}>
                      {t(`custom_plan.muscle_${m.key}`)}
                    </button>
                  );
                })}
              </div>
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

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.video')}</label>
              {form.video_path ? (
                <div className="relative mt-1">
                  <video src={form.video_path} className="w-full rounded-lg border border-border bg-black" controls muted />
                  <button onClick={() => setForm({ ...form, video_path: '' })} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className={cn("mt-1 grid gap-2", showRecordButton ? "grid-cols-2" : "grid-cols-1")}>
                  <button onClick={() => videoInput.current?.click()} disabled={uploading}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed border-input text-sm text-muted-foreground disabled:opacity-50">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? (uploadStage === 'compress' ? t('my_exercises.compressing') : t('my_exercises.uploading')) : t('my_exercises.upload_video')}
                  </button>
                  {showRecordButton && <button onClick={() => cameraInput.current?.click()} disabled={uploading}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed border-input text-sm text-muted-foreground disabled:opacity-50">
                    <Video className="w-4 h-4" />
                    {t('my_exercises.record_video')}
                  </button>}
                </div>
              )}
              <input ref={videoInput} type="file" accept="video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ''; }} />
              <input ref={cameraInput} type="file" accept="video/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ''; }} />
              <p className="text-xs text-muted-foreground mt-1.5">{t('my_exercises.video_hint', { sec: MAX_VIDEO_SEC, mb: MAX_VIDEO_MB })}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('my_exercises.thumb')}</label>
              <div className="mt-1 flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                  {form.video_path
                    ? <img key={thumbVersion} src={`${getVideoThumbUrl(form.video_path)}?v=${thumbVersion}`} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                    : <Video className="w-5 h-5 text-muted-foreground/50" />}
                </div>
                <div className="flex-1">
                  <button onClick={() => thumbInput.current?.click()} disabled={thumbUploading || !form.video_path}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-input text-sm disabled:opacity-50">
                    {thumbUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t('my_exercises.thumb_upload')}
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-1">{t('my_exercises.thumb_hint')}</p>
                </div>
              </div>
              <input ref={thumbInput} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadThumb(f); e.target.value = ''; }} />
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
