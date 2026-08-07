import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildImportPlan, HevyImportPlan } from '@/lib/hevyImport';

// Import of workout history from Hevy (Settings → Export Data → CSV).
// The whole flow runs client-side: parse → preview → confirm. Unmatched
// exercises become the user's private custom exercises, so no history is
// dropped. Re-importing the same file is a no-op (client_session_id).
export const HevyImportSection = () => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<HevyImportPlan | null>(null);
  const [phase, setPhase] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle');
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  const onFile = async (file: File) => {
    setError('');
    try {
      const text = await file.text();
      const { data: catalog } = await supabase
        .from('exercises')
        .select('id, name, name_en');
      const p = buildImportPlan(text, catalog ?? []);
      if (p.workouts.length === 0) { setError(t('hevy.empty')); return; }
      setPlan(p);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error && e.message === 'not_hevy_csv' ? t('hevy.not_hevy') : t('hevy.parse_failed'));
    }
  };

  const runImport = async () => {
    if (!plan) return;
    setPhase('importing');
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not signed in');

      // 1. Skip workouts that are already imported (same export re-uploaded).
      const ids = plan.workouts.map(w => w.clientSessionId);
      const { data: existing } = await supabase
        .from('workout_sessions')
        .select('client_session_id')
        .eq('user_id', user.id)
        .in('client_session_id', ids);
      const done = new Set((existing ?? []).map(r => r.client_session_id));
      const todo = plan.workouts.filter(w => !done.has(w.clientSessionId));

      // 2. Create private custom exercises for anything the catalog doesn't know.
      const exerciseMap = new Map(plan.exerciseMap);
      for (const name of plan.unmatchedNames) {
        const hasWeight = plan.workouts.some(w => w.sets.some(s => s.exerciseTitle === name && s.weightKg != null));
        const { data: created, error: cErr } = await supabase.from('exercises').insert({
          name,
          owner_id: user.id,
          category: 'full_body',
          unit_type: 'reps',
          exercise_with_weights: hasWeight,
          equipment_type: hasWeight ? 'free_weight' : 'bodyweight',
          slot_type: 'main',
          is_compound: false,
        }).select('id').single();
        if (cErr) {
          // Duplicate from a previous import — find the existing row instead.
          const { data: found } = await supabase
            .from('exercises').select('id').eq('owner_id', user.id).eq('name', name).maybeSingle();
          if (!found) throw cErr;
          exerciseMap.set(name, found.id);
        } else {
          exerciseMap.set(name, created.id);
        }
      }

      // 3. Insert sessions + their sets.
      let count = 0;
      for (const w of todo) {
        const totalSets = w.sets.length;
        const totalReps = w.sets.reduce((a, s) => a + (s.reps ?? 0), 0);
        const totalWeight = w.sets.reduce((a, s) => a + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
        const duration = w.endTime ? Math.max(0, Math.round((w.endTime.getTime() - w.startTime.getTime()) / 1000)) : null;
        const { data: session, error: sErr } = await supabase.from('workout_sessions').insert({
          user_id: user.id,
          goal_id: 'general_fitness',
          day_letter: 'H', // H = Hevy import; nikdy nekoliduje s plánovými A/B/C
          week_number: 0,
          started_at: w.startTime.toISOString(),
          completed_at: (w.endTime ?? w.startTime).toISOString(),
          duration_seconds: duration,
          total_sets: totalSets,
          total_reps: totalReps,
          total_weight_kg: totalWeight,
          client_session_id: w.clientSessionId,
        }).select('id').single();
        if (sErr) throw sErr;
        const sets = w.sets.map((s, i) => ({
          session_id: session.id,
          exercise_id: exerciseMap.get(s.exerciseTitle) ?? null,
          exercise_name: s.exerciseTitle,
          set_number: s.setIndex ?? i,
          reps: s.reps,
          weight_kg: s.weightKg,
          completed: true,
          set_type: s.setType || 'normal',
        }));
        const { error: setsErr } = await supabase.from('workout_session_sets').insert(sets);
        if (setsErr) throw setsErr;
        count++;
      }
      setImportedCount(count);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('preview');
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
          <Download className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{t('hevy.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('hevy.subtitle')}</p>
        </div>
      </div>

      {phase === 'idle' && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-2.5 rounded-xl bg-muted text-sm font-medium"
          >
            {t('hevy.pick_file')}
          </button>
        </>
      )}

      {phase === 'preview' && plan && (
        <div className="space-y-2">
          <p className="text-sm">
            {t('hevy.preview', { workouts: plan.workouts.length, matched: plan.matchedNames.length, unmatched: plan.unmatchedNames.length })}
          </p>
          {plan.unmatchedNames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('hevy.unmatched_note')}: {plan.unmatchedNames.slice(0, 6).join(', ')}{plan.unmatchedNames.length > 6 ? '…' : ''}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setPlan(null); setPhase('idle'); }} className="flex-1 py-2 rounded-lg text-sm bg-muted text-muted-foreground">
              {t('workout.cancel')}
            </button>
            <button onClick={runImport} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-primary">
              {t('hevy.run')}
            </button>
          </div>
        </div>
      )}

      {phase === 'importing' && (
        <p className="text-sm text-muted-foreground text-center py-2">{t('hevy.importing')}</p>
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {t('hevy.done', { n: importedCount })}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
