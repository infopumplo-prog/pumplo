-- Feedback 13. 10.: „Nejsem v žádné z těchto posiloven" — vlastní vybavení na profilu.
-- custom_equipment = skupiny vybavení (src/lib/customEquipment.ts: bodyweight, dumbbells,
-- barbell, bench, pull_up_bar, kettlebell, bands, trx, cables, smith, leg_press, machines,
-- cardio, accessories) nebo ['all']. Platí jen když selected_gym_id IS NULL.
-- NULL / prázdné pole = beze změny chování (plán čeká na výběr posilovny).
-- Idempotentní. RLS: user_profiles už má politiky na vlastní řádek, nový sloupec je pokrývá.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS custom_equipment text[] DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.custom_equipment IS
  'Vlastní vybavení pro trénink bez posilovny (skupiny z customEquipment.ts nebo {all}); použije se jen při selected_gym_id IS NULL.';

-- Rollback:
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS custom_equipment;
