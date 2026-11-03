-- Váha v týdenním check-inu (David 15. 10. 2026: „chybí mi tam změna ve váze“).
-- Opakovatelné. Návrat: ALTER TABLE weekly_checkins DROP COLUMN IF EXISTS weight_kg;

ALTER TABLE weekly_checkins ADD COLUMN IF NOT EXISTS weight_kg numeric(5,1);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weekly_checkins_weight_range') THEN
    ALTER TABLE weekly_checkins
      ADD CONSTRAINT weekly_checkins_weight_range CHECK (weight_kg IS NULL OR weight_kg BETWEEN 25 AND 400);
  END IF;
END $$;
