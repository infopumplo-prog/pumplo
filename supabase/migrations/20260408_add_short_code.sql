-- Migration: Add short_code to gym_machines for QR station links
-- Date: 2026-04-08

-- 1. Add short_code column (nullable initially, will backfill then make NOT NULL)
ALTER TABLE gym_machines
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(8);

-- 2. Add UNIQUE constraint on short_code
ALTER TABLE gym_machines
  DROP CONSTRAINT IF EXISTS gym_machines_short_code_key;

ALTER TABLE gym_machines
  ADD CONSTRAINT gym_machines_short_code_key UNIQUE (short_code);

-- 3. Create trigger function to auto-generate short_code on INSERT
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  -- Generate unique 8-char short code
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;

    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM gym_machines WHERE short_code = result) THEN
      NEW.short_code := result;
      RETURN NEW;
    END IF;

    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique short_code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger that fires before INSERT if short_code is NULL
DROP TRIGGER IF EXISTS trigger_generate_short_code ON gym_machines;

CREATE TRIGGER trigger_generate_short_code
  BEFORE INSERT ON gym_machines
  FOR EACH ROW
  WHEN (NEW.short_code IS NULL)
  EXECUTE FUNCTION generate_short_code();

-- 5. Backfill existing records that have no short_code
DO $$
DECLARE
  rec RECORD;
  chars TEXT := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INTEGER;
  attempts INTEGER;
BEGIN
  FOR rec IN SELECT id FROM gym_machines WHERE short_code IS NULL LOOP
    attempts := 0;
    LOOP
      code := '';
      FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;

      IF NOT EXISTS (SELECT 1 FROM gym_machines WHERE short_code = code) THEN
        UPDATE gym_machines SET short_code = code WHERE id = rec.id;
        EXIT;
      END IF;

      attempts := attempts + 1;
      IF attempts > 100 THEN
        RAISE EXCEPTION 'Could not generate unique short_code for id % after 100 attempts', rec.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- 6. Make short_code NOT NULL after backfill
ALTER TABLE gym_machines
  ALTER COLUMN short_code SET NOT NULL;

-- 7. Add RLS policy for public read access to short_code lookup
-- Note: "Anyone can read gym machines" and "Anyone can view gym_machines" already exist.
-- No new policy needed — existing SELECT policies already cover public access.
-- Adding an index for fast short_code lookups instead:
CREATE INDEX IF NOT EXISTS idx_gym_machines_short_code ON gym_machines (short_code);
