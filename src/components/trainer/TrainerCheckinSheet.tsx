import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, ChevronDown, ImagePlus, Loader2, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { TRAINER_QUERY_ROOT, useInvalidateTrainerData } from '@/hooks/useTrainerAssignments';
import { useCheckinForm, useTrainerCheckins } from '@/hooks/useTrainerCheckins';
import { removeCheckinWeight, upsertCheckinWeight } from '@/lib/bodyWeight';
import {
  CHECKIN_TEXT_MAX,
  answersToDraft,
  checkinDraftKey,
  extractWeightKg,
  maxPhotos,
  normalizeAnswers,
  parseDraft,
  scaleRange,
  validateAnswers,
  type CheckinField,
  type DraftAnswer,
  type DraftAnswers,
  type FieldError,
} from '@/lib/trainerCheckin';
import {
  deleteCheckinPhoto,
  fetchCheckinPhotos,
  saveCheckin,
  signedPhotoUrls,
  uploadCheckinPhoto,
  type CheckinPhotoRow,
  type TrainerCheckinRow,
} from '@/lib/trainerCheckinApi';
import type { MyTrainer } from '@/lib/trainerClient';
import { formatWeekRange, sanitizeWeightInput } from '@/lib/weeklyCheckin';
import { cn } from '@/lib/utils';
import FullscreenSheet from './FullscreenSheet';

interface NewPhoto {
  key: string;
  fieldId: string;
  file: File;
  preview: string;
  failed?: boolean;
}

const readDraft = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const writeDraft = (key: string, v: DraftAnswers) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* noop */ } };
const clearDraft = (key: string) => { try { localStorage.removeItem(key); } catch { /* noop */ } };

/** Fotky check-inů + podepsané URL (soukromý bucket). */
const useCheckinPhotos = (checkinIds: string[], enabled: boolean) => {
  const key = checkinIds.join(',');
  return useQuery({
    queryKey: [TRAINER_QUERY_ROOT, 'checkin-photos', key],
    enabled: enabled && checkinIds.length > 0,
    retry: 1,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      try {
        const rows = await fetchCheckinPhotos(checkinIds);
        const urls = await signedPhotoUrls(rows.map((r) => r.storage_path));
        return { rows, urls };
      } catch (e) {
        console.warn('[trainer] check-in photos not loaded', e);
        return { rows: [] as CheckinPhotoRow[], urls: new Map<string, string>() };
      }
    },
  });
};

const ChipRow = <T extends string | number>({ values, value, onChange, label, render }: {
  values: T[]; value: T | null | undefined; onChange: (v: T) => void; label: string; render?: (v: T) => string;
}) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
    {values.map((v) => (
      <button
        key={String(v)}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={cn(
          'min-h-[44px] min-w-[44px] px-3 rounded-xl border text-sm font-semibold transition-colors active:scale-95',
          value === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground',
        )}
      >
        {render ? render(v) : String(v)}
      </button>
    ))}
  </div>
);

const errorText = (t: (k: string) => string, field: CheckinField, err: FieldError): string => {
  if (err === 'required') return t('trainer_client.ci_err_required');
  if (err === 'too_many') return t('trainer_client.ci_err_too_many');
  if (err === 'range') return field.type === 'weight' ? t('trainer_client.ci_err_weight') : t('trainer_client.ci_err_range');
  return t('trainer_client.ci_err_invalid');
};

const formatAnswer = (field: CheckinField, v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (field.type === 'weight') return `${String(v).replace('.', ',')} kg`;
  if (field.type === 'number') return `${String(v).replace('.', ',')}${field.unit ? ` ${field.unit}` : ''}`;
  if (field.type === 'scale') return `${v} / ${scaleRange(field).max}`;
  return String(v);
};

// ───────────────────────── Formulář ─────────────────────────

const CheckinForm = ({ trainer, fields, existing, weekStart, onDone }: {
  trainer: MyTrainer;
  fields: CheckinField[];
  existing: TrainerCheckinRow | null;
  weekStart: string;
  onDone: () => void;
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const invalidate = useInvalidateTrainerData();
  const draftKey = checkinDraftKey(trainer.link_id, weekStart);
  const [answers, setAnswers] = useState<DraftAnswers>(() =>
    parseDraft(readDraft(draftKey), fields) ?? answersToDraft(fields, existing?.answers));
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const photosQuery = useCheckinPhotos(savedId ? [savedId] : [], !!savedId);
  const existingPhotos = (photosQuery.data?.rows ?? []).filter((p) => !removed.has(p.id));
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Koncept průběžně do telefonu — výpadek sítě / zavření appky odpovědi neztratí.
  useEffect(() => { if (touched) writeDraft(draftKey, answers); }, [answers, touched, draftKey]);
  // Náhledy nových fotek uvolnit při zavření.
  const previewsRef = useRef<NewPhoto[]>([]);
  previewsRef.current = newPhotos;
  useEffect(() => () => { for (const p of previewsRef.current) URL.revokeObjectURL(p.preview); }, []);

  const setAnswer = (id: string, v: DraftAnswer) => {
    setTouched(true);
    setAnswers((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => { if (!prev[id]) return prev; const next = { ...prev }; delete next[id]; return next; });
  };

  const photoCount = (fieldId: string) =>
    existingPhotos.filter((p) => p.field_id === fieldId).length + newPhotos.filter((p) => p.fieldId === fieldId).length;

  const addFiles = (field: CheckinField, files: FileList | null) => {
    if (!files?.length) return;
    const room = maxPhotos(field) - photoCount(field.id);
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === '').slice(0, Math.max(0, room));
    if (picked.length < files.length) toast.message(t('trainer_client.ci_photo_limit', { max: maxPhotos(field) }));
    setNewPhotos((prev) => [
      ...prev,
      ...picked.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, fieldId: field.id, file, preview: URL.createObjectURL(file) })),
    ]);
    setErrors((prev) => { if (!prev[field.id]) return prev; const next = { ...prev }; delete next[field.id]; return next; });
  };

  const removeNew = (key: string) => setNewPhotos((prev) => {
    const hit = prev.find((p) => p.key === key);
    if (hit) URL.revokeObjectURL(hit.preview);
    return prev.filter((p) => p.key !== key);
  });

  const submit = async () => {
    if (!user || saving) return;
    const counts: Record<string, number> = {};
    for (const f of fields) if (f.type === 'photos') counts[f.id] = photoCount(f.id);
    const errs = validateAnswers(fields, answers, counts);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(t('trainer_client.ci_err_fix'));
      document.getElementById(`ci-field-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    const normalized = normalizeAnswers(fields, answers);
    const weightKg = extractWeightKg(fields, normalized);
    const { id, error } = await saveCheckin({
      existingId: savedId,
      linkId: trainer.link_id,
      trainerUserId: trainer.trainer_user_id,
      userId: user.id,
      formId: existing?.form_id ?? trainer.checkin_form_id ?? null,
      fields,
      answers: normalized,
      weightKg,
      weekStart,
    });
    if (error || !id) {
      setSaving(false);
      console.warn('[trainer] check-in not saved', error);
      writeDraft(draftKey, answers);
      toast.error(t('trainer_client.ci_error_save'));
      return;
    }
    setSavedId(id);

    // Odebrané fotky, pak nové. Selhání fotky neruší uložený check-in.
    const removedRows = (photosQuery.data?.rows ?? []).filter((p) => removed.has(p.id));
    for (const row of removedRows) {
      const { error: delErr } = await deleteCheckinPhoto(row);
      if (delErr) console.warn('[trainer] photo not deleted', delErr);
    }
    const failed: NewPhoto[] = [];
    let index = existingPhotos.length;
    for (const photo of newPhotos) {
      const { error: upErr } = await uploadCheckinPhoto({ userId: user.id, checkinId: id, fieldId: photo.fieldId, index: index++, file: photo.file });
      if (upErr) { console.warn('[trainer] photo upload failed', upErr); failed.push({ ...photo, failed: true }); }
    }

    // Váha z check-inu do body_weight_entries (jedna položka na check-in).
    const weightRes = weightKg != null
      ? await upsertCheckinWeight(user.id, id, weightKg)
      : existing?.weight_kg != null ? await removeCheckinWeight(user.id, id) : { error: null };
    if (weightRes.error) console.warn('[trainer] check-in weight entry not saved', weightRes.error);

    // Nejdřív načíst nový stav fotek, pak teprve zahodit lokální — žádné probliknutí.
    await invalidate();
    const failedKeys = new Set(failed.map((p) => p.key));
    for (const p of newPhotos) if (!failedKeys.has(p.key)) URL.revokeObjectURL(p.preview);
    setRemoved(new Set());
    setNewPhotos(failed);
    setSaving(false);
    if (failed.length) {
      writeDraft(draftKey, answers);
      toast.error(t('trainer_client.ci_error_photos', { count: failed.length }));
      return;
    }
    clearDraft(draftKey);
    onDone();
  };

  return (
    <div className="space-y-5">
      {existing && <p className="text-xs text-muted-foreground rounded-xl bg-muted/60 px-3 py-2">{t('trainer_client.ci_editing_note')}</p>}
      {fields.map((field) => {
        const err = errors[field.id];
        const v = answers[field.id];
        return (
          <div key={field.id} id={`ci-field-${field.id}`} className="space-y-2">
            <label htmlFor={`ci-input-${field.id}`} className="text-sm font-semibold block">
              {field.label}
              {field.unit && field.type === 'number' ? <span className="font-normal text-muted-foreground"> ({field.unit})</span> : null}
              {!field.required && <span className="font-normal text-muted-foreground"> · {t('trainer_client.ci_optional')}</span>}
            </label>

            {(field.type === 'weight' || field.type === 'number') && (
              <div className="relative">
                <Input
                  id={`ci-input-${field.id}`}
                  inputMode="decimal"
                  value={typeof v === 'string' ? v : v == null ? '' : String(v)}
                  onChange={(e) => setAnswer(field.id, field.type === 'weight'
                    ? sanitizeWeightInput(e.target.value)
                    : e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 12))}
                  className={cn('h-12 pr-12 text-lg font-semibold', err && 'border-destructive')}
                  aria-invalid={!!err}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {field.type === 'weight' ? 'kg' : field.unit ?? ''}
                </span>
              </div>
            )}

            {field.type === 'scale' && (() => {
              const { min, max } = scaleRange(field);
              const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
              return (
                <>
                  <ChipRow values={values} value={typeof v === 'number' ? v : null} onChange={(n) => setAnswer(field.id, n)} label={field.label} />
                  {(field.min_label || field.max_label) && (
                    <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                      <span>{field.min_label ?? ''}</span><span>{field.max_label ?? ''}</span>
                    </div>
                  )}
                </>
              );
            })()}

            {field.type === 'text' && (
              <Textarea
                id={`ci-input-${field.id}`}
                value={typeof v === 'string' ? v : ''}
                maxLength={CHECKIN_TEXT_MAX}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                className={cn('min-h-[88px]', err && 'border-destructive')}
                aria-invalid={!!err}
              />
            )}

            {field.type === 'choice' && (
              <ChipRow values={field.options ?? []} value={typeof v === 'string' ? v : null} onChange={(o) => setAnswer(field.id, o)} label={field.label} />
            )}

            {field.type === 'photos' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {existingPhotos.filter((p) => p.field_id === field.id).map((p) => (
                    <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                      {photosQuery.data?.urls.get(p.storage_path) && (
                        <img src={photosQuery.data.urls.get(p.storage_path)} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        aria-label={t('trainer_client.ci_photo_remove')}
                        onClick={() => setRemoved((prev) => new Set(prev).add(p.id))}
                        className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {newPhotos.filter((p) => p.fieldId === field.id).map((p) => (
                    <div key={p.key} className={cn('relative aspect-square rounded-xl overflow-hidden bg-muted', p.failed && 'ring-2 ring-destructive')}>
                      <img src={p.preview} alt="" className="w-full h-full object-cover" />
                      {p.failed && (
                        <span className="absolute bottom-0 inset-x-0 bg-destructive/90 text-destructive-foreground text-[10px] text-center py-0.5">
                          {t('trainer_client.ci_photo_failed')}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={t('trainer_client.ci_photo_remove')}
                        onClick={() => removeNew(p.key)}
                        className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {photoCount(field.id) < maxPhotos(field) && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 rounded-xl gap-2 min-h-[44px]" onClick={() => cameraInputs.current[field.id]?.click()}>
                      <Camera className="w-4 h-4" />{t('trainer_client.ci_photo_take')}
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 rounded-xl gap-2 min-h-[44px]" onClick={() => fileInputs.current[field.id]?.click()}>
                      <ImagePlus className="w-4 h-4" />{t('trainer_client.ci_photo_pick')}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t('trainer_client.ci_photo_count', { count: photoCount(field.id), max: maxPhotos(field) })}</p>
                <input
                  ref={(el) => { cameraInputs.current[field.id] = el; }}
                  type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { addFiles(field, e.target.files); e.target.value = ''; }}
                />
                <input
                  ref={(el) => { fileInputs.current[field.id] = el; }}
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { addFiles(field, e.target.files); e.target.value = ''; }}
                />
              </div>
            )}

            {err && <p className="text-xs text-destructive">{errorText(t, field, err)}</p>}
          </div>
        );
      })}

      <Button onClick={() => void submit()} disabled={saving} size="lg" className="w-full rounded-xl gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? t('trainer_client.ci_saving') : existing ? t('trainer_client.ci_save_edit') : t('trainer_client.ci_submit')}
      </Button>
    </div>
  );
};

// ───────────────────────── Historie ─────────────────────────

const HistoryItem = ({ row, lang }: { row: TrainerCheckinRow; lang: string }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasPhotoField = row.form_snapshot.some((f) => f.type === 'photos');
  const photos = useCheckinPhotos([row.id], open && hasPhotoField);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">{formatWeekRange(row.week_start, lang)}</span>
          <span className="block text-xs text-muted-foreground">
            {row.weight_kg != null && `${String(row.weight_kg).replace('.', ',')} kg`}
            {row.weight_kg != null && row.trainer_seen_at && ' · '}
            {row.trainer_seen_at && <span className="text-primary font-medium">{t('trainer_client.ci_seen')}</span>}
          </span>
        </span>
        {row.trainer_note && <MessageSquare className="w-4 h-4 text-primary shrink-0" />}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {row.trainer_note && (
            <div className="rounded-xl bg-primary/10 px-3 py-2">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{t('trainer_client.ci_trainer_note')}</p>
              <p className="text-sm whitespace-pre-wrap">{row.trainer_note}</p>
            </div>
          )}
          {row.form_snapshot.filter((f) => f.type !== 'photos').map((f) => {
            const text = formatAnswer(f, row.answers[f.id]);
            if (!text) return null;
            return (
              <div key={f.id}>
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm whitespace-pre-wrap">{text}</p>
              </div>
            );
          })}
          {hasPhotoField && (photos.isLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
            <div className="grid grid-cols-3 gap-2">
              {(photos.data?.rows ?? []).map((p) => photos.data?.urls.get(p.storage_path) && (
                <img key={p.id} src={photos.data.urls.get(p.storage_path)} alt="" className="aspect-square w-full rounded-xl object-cover bg-muted" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ───────────────────────── Panel ─────────────────────────

/** Check-in pro trenéra: vyplnění/úprava tohoto týdne + historie. */
const TrainerCheckinSheet = ({ trainer, open, onClose, initialTab = 'form' }: {
  trainer: MyTrainer | null;
  open: boolean;
  onClose: () => void;
  initialTab?: 'form' | 'history';
}) => {
  const { t, i18n } = useTranslation();
  const { byLink, thisWeekFor, weekStart } = useTrainerCheckins();
  const [tab, setTab] = useState<'form' | 'history'>(initialTab);
  const [done, setDone] = useState(false);
  const existing = trainer ? thisWeekFor(trainer.link_id) : null;
  const formQuery = useCheckinForm(open && !existing ? trainer?.checkin_form_id : null);
  const fields = useMemo(() => (existing ? existing.form_snapshot : formQuery.data?.fields ?? []), [existing, formQuery.data]);
  const history = trainer ? byLink.get(trainer.link_id) ?? [] : [];

  useEffect(() => { if (open) { setTab(initialTab); setDone(false); } }, [open, initialTab]);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(onClose, 1400);
    return () => window.clearTimeout(id);
  }, [done, onClose]);

  if (!trainer) return null;

  return (
    <FullscreenSheet open={open} onClose={onClose} closeLabel={t('trainer_client.ci_close')} labelledBy="trainer-checkin-title">
      {done ? (
        <div className="text-center space-y-3 pt-24">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <h2 id="trainer-checkin-title" className="text-xl font-bold">{t('trainer_client.ci_thanks_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('trainer_client.ci_thanks_body', { name: trainer.trainer_name })}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h2 id="trainer-checkin-title" className="text-xl font-bold pr-10">{t('trainer_client.ci_title', { name: trainer.trainer_name })}</h2>
            <p className="text-xs font-semibold text-primary mt-2">{formatWeekRange(weekStart, i18n.language)}</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist">
            {(['form', 'history'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn('flex-1 min-h-[40px] rounded-lg text-sm font-semibold', tab === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}
              >
                {k === 'form' ? t('trainer_client.ci_tab_form') : t('trainer_client.ci_tab_history')}
              </button>
            ))}
          </div>

          {tab === 'form' && (
            !existing && formQuery.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
              : fields.length === 0 ? <p className="text-sm text-muted-foreground">{t('trainer_client.ci_form_missing')}</p>
              : (
                <CheckinForm
                  key={`${trainer.link_id}-${weekStart}`}
                  trainer={trainer}
                  fields={fields}
                  existing={existing}
                  weekStart={weekStart}
                  onDone={() => setDone(true)}
                />
              )
          )}

          {tab === 'history' && (
            history.length === 0
              ? <p className="text-sm text-muted-foreground">{t('trainer_client.ci_history_empty')}</p>
              : <div className="space-y-2">{history.map((row) => <HistoryItem key={row.id} row={row} lang={i18n.language} />)}</div>
          )}
        </div>
      )}
    </FullscreenSheet>
  );
};

export default TrainerCheckinSheet;
