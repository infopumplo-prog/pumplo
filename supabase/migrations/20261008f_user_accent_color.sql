-- Barva appky (Onboarding 2.0, fáze 2 — 8. 10. 2026): volba z dotazníku / Nastavení,
-- uložená v profilu, aby platila i na jiném zařízení. NULL = výchozí Pumplo modrá.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS accent_color text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_accent_color_check') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_accent_color_check
      CHECK (accent_color IS NULL OR accent_color IN ('blue', 'pink', 'purple', 'green', 'orange', 'red'));
  END IF;
END $$;
