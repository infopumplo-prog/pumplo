-- Vlastní trénink s více dny v kruhu (feedback 13. 10.)
-- Session si pamatuje, který den kterého vlastního plánu se odcvičil,
-- aby appka uměla ukázat „Další: Den B“ a po posledním dni skočit zpět na A.
-- Idempotentní. Appka funguje i bez této migrace (fallback na localStorage).

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS custom_plan_id uuid,
  ADD COLUMN IF NOT EXISTS custom_plan_day_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_custom_plan_id_fkey') THEN
    ALTER TABLE public.workout_sessions
      ADD CONSTRAINT workout_sessions_custom_plan_id_fkey
      FOREIGN KEY (custom_plan_id) REFERENCES public.custom_plans(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_custom_plan_day_id_fkey') THEN
    ALTER TABLE public.workout_sessions
      ADD CONSTRAINT workout_sessions_custom_plan_day_id_fkey
      FOREIGN KEY (custom_plan_day_id) REFERENCES public.custom_plan_days(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Dotaz „poslední odcvičený den plánu“: user_id + custom_plan_id, nejnovější první.
CREATE INDEX IF NOT EXISTS workout_sessions_custom_plan_idx
  ON public.workout_sessions (user_id, custom_plan_id, completed_at DESC)
  WHERE custom_plan_id IS NOT NULL;

-- RLS: stávající politika „Users manage own sessions“ (ALL, auth.uid() = user_id)
-- pokrývá čtení i update nových sloupců — žádná nová politika není potřeba.

-- ROLLBACK:
-- DROP INDEX IF EXISTS public.workout_sessions_custom_plan_idx;
-- ALTER TABLE public.workout_sessions DROP CONSTRAINT IF EXISTS workout_sessions_custom_plan_day_id_fkey;
-- ALTER TABLE public.workout_sessions DROP CONSTRAINT IF EXISTS workout_sessions_custom_plan_id_fkey;
-- ALTER TABLE public.workout_sessions DROP COLUMN IF EXISTS custom_plan_day_id;
-- ALTER TABLE public.workout_sessions DROP COLUMN IF EXISTS custom_plan_id;
