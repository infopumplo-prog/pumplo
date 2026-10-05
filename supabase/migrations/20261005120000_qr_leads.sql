-- Sběr e-mailu na stránce stroje (app.pumplo.com/s/<code>), fáze 1: jen ukládání.
-- Souhlas = odeslání formuláře s viditelným textem souhlasu (consent_text).
-- Zapisuje jen edge funkce log-qr (service role); anon/člen tabulku nečte.
CREATE TABLE IF NOT EXISTS public.qr_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) BETWEEN 6 AND 254),
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  scan_id uuid REFERENCES public.qr_events(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'station' CHECK (source_type IN ('station', 'flyer')),
  code text,
  gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL,
  machine_id uuid,
  platform text NOT NULL DEFAULT 'other' CHECK (platform IN ('ios', 'android', 'other')),
  lang text NOT NULL DEFAULT 'cs' CHECK (lang IN ('cs', 'en')),
  ip_hash text,
  consent_text text NOT NULL,
  consent_text_version text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qr_leads_email_normalized_key ON public.qr_leads (email_normalized);
CREATE INDEX IF NOT EXISTS qr_leads_gym_id_idx ON public.qr_leads (gym_id);
CREATE INDEX IF NOT EXISTS qr_leads_ip_hash_created_idx ON public.qr_leads (ip_hash, created_at);

ALTER TABLE public.qr_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admins_read_qr_leads ON public.qr_leads;
CREATE POLICY admins_read_qr_leads ON public.qr_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.qr_leads FROM anon;

ALTER TABLE public.qr_events DROP CONSTRAINT IF EXISTS qr_events_event_type_check;
ALTER TABLE public.qr_events ADD CONSTRAINT qr_events_event_type_check
  CHECK (event_type = ANY (ARRAY['scan', 'store_click', 'first_open', 'signup',
                                 'lead_prompt_shown', 'lead_prompt_dismissed', 'lead_submitted']));
