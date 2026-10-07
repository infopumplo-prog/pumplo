-- Proč se e-mailový popup (app.pumplo.com/s/<code>, pumplo.com z letáku) neukázal
-- a odlišení skenů z nativní appky. Jen přidává — žádná existující data se nemění.
--   detail u 'lead_prompt_skipped' = důvod: native_app | logged_in | already_submitted | dismissed_recently
--   detail u 'scan'                = 'native' když sken přišel z Pumplo appky (Capacitor), jinak NULL
-- Nasadit PŘED novou verzí edge funkce log-qr (ta do sloupce detail zapisuje).
ALTER TABLE public.qr_events ADD COLUMN IF NOT EXISTS detail text;

ALTER TABLE public.qr_events DROP CONSTRAINT IF EXISTS qr_events_detail_check;
ALTER TABLE public.qr_events ADD CONSTRAINT qr_events_detail_check CHECK (
  detail IS NULL
  OR (event_type = 'lead_prompt_skipped' AND detail = ANY (ARRAY['native_app', 'logged_in', 'already_submitted', 'dismissed_recently']))
  OR (event_type = 'scan' AND detail = 'native')
);
-- Skip bez důvodu nedává smysl.
ALTER TABLE public.qr_events DROP CONSTRAINT IF EXISTS qr_events_skip_reason_check;
ALTER TABLE public.qr_events ADD CONSTRAINT qr_events_skip_reason_check
  CHECK (event_type <> 'lead_prompt_skipped' OR detail IS NOT NULL);

ALTER TABLE public.qr_events DROP CONSTRAINT IF EXISTS qr_events_event_type_check;
ALTER TABLE public.qr_events ADD CONSTRAINT qr_events_event_type_check
  CHECK (event_type = ANY (ARRAY['scan', 'store_click', 'first_open', 'signup',
                                 'lead_prompt_shown', 'lead_prompt_dismissed', 'lead_submitted',
                                 'lead_prompt_skipped']));

-- Jeden skip na sken (edge funkce to hlídá dotazem; index ho drží levný).
CREATE INDEX IF NOT EXISTS qr_events_scan_id_event_type_idx ON public.qr_events (scan_id, event_type) WHERE scan_id IS NOT NULL;
