-- Cílení zpráv na verzi appky.
--
-- Push jde přes FCM bez ohledu na to, jakou verzi má uživatel nainstalovanou.
-- Zpráva o novinkách se ale zobrazuje kódem, který přišel až s updatem — kdo
-- neaktualizoval, by po klepnutí na notifikaci nenašel v appce nic. Proto si
-- u zařízení držíme verzi a zprávy umíme omezit na tu novou a vyšší.

alter table public.device_tokens
  add column if not exists app_version text;

alter table public.app_messages
  add column if not exists min_app_version text;

comment on column public.device_tokens.app_version is
  'Verze appky hlášená při registraci tokenu (App.getInfo().version). NULL = starší build, který ji ještě neposílal.';

comment on column public.app_messages.min_app_version is
  'Nejnižší verze appky, která zprávu umí zobrazit. NULL = pošli všem.';
