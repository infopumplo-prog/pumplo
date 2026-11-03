-- Trenéři Pumplo (Adam Kakiš, David Beníšek) zveřejňují tréninky jako „Pumplo“ (David 14. 10. 2026).
-- Skrytá posilovna „Pumplo“ (is_published = false → není na mapě ani ve výběru posilovny),
-- katalog veřejných tréninků ale ukazuje plány jejích schválených trenérů všem uživatelům
-- (list_public_workouts vyřazuje jen demo posilovnu). Opakovatelné (pevná ID, ON CONFLICT).
-- Návrat: blok NÁVRAT na konci.

INSERT INTO gyms (id, name, description, description_en, owner_id, is_published, is_verified)
VALUES (
  'f0f0f0f0-0000-4000-8000-000000000001',
  'Pumplo',
  'Tréninky od trenérů Pumplo.',
  'Workouts by Pumplo coaches.',
  '2e70d26e-ff70-44b7-a4fe-a6902f409c7b', -- David Novotný
  false,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Každý jejich účet zvlášť: nevíme, kterým se v testovací verzi přihlásí.
INSERT INTO gym_trainers (id, gym_id, user_id, name, photo_url, bio, specializations, status, is_active, sort_order)
SELECT v.id::uuid, 'f0f0f0f0-0000-4000-8000-000000000001', v.user_id::uuid, v.name,
       (SELECT photo_url FROM gym_trainers WHERE id = v.photo_from::uuid),
       v.bio, v.specs, 'approved', true, v.sort_order
FROM (VALUES
  ('f0f0f0f0-0000-4000-8000-0000000000a1', '9ca7aeaf-32d1-4988-b0ca-c820e8242067', 'Adam Kakiš',
   '27e858d1-c2db-464a-9af3-3f4146037304', '11 let cvičení v posilovně', ARRAY['Hypertrofie','Hubnutí'], 1),
  ('f0f0f0f0-0000-4000-8000-0000000000a2', '2fefb47d-0aca-41e2-b791-e1e80480ba24', 'Adam Kakiš',
   '27e858d1-c2db-464a-9af3-3f4146037304', '11 let cvičení v posilovně', ARRAY['Hypertrofie','Hubnutí'], 1),
  ('f0f0f0f0-0000-4000-8000-0000000000b1', 'cf2aeaa8-6815-4948-b847-0060f4c593ee', 'David Beníšek',
   'deadbeef-0000-4000-8000-0000000001a1', 'Hlavní trenér a spoluzakladatel Pumplo. 12 let trénování klientů od nuly až po první závody.', ARRAY['Síla','Hypertrofie'], 0),
  ('f0f0f0f0-0000-4000-8000-0000000000b2', 'f4d1f5fb-0ac6-4db9-968e-7d997f3d9c46', 'David Beníšek',
   'deadbeef-0000-4000-8000-0000000001a1', 'Hlavní trenér a spoluzakladatel Pumplo. 12 let trénování klientů od nuly až po první závody.', ARRAY['Síla','Hypertrofie'], 0)
) AS v(id, user_id, name, photo_from, bio, specs, sort_order)
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.user_id::uuid)
ON CONFLICT (id) DO NOTHING;

-- Adam je zároveň trenér Eurogymu (starší záznam) — zveřejnění z appky má jít pod Pumplo.
CREATE OR REPLACE FUNCTION my_active_trainer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gt.id
  FROM gym_trainers gt
  JOIN gyms g ON g.id = gt.gym_id
  WHERE gt.user_id = auth.uid()
    AND gt.status = 'approved'
    AND coalesce(gt.is_active, true)
  ORDER BY (gt.gym_id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid) DESC, gt.created_at
  LIMIT 1;
$$;

-- NÁVRAT (ručně):
-- UPDATE custom_plans SET published_at = NULL WHERE trainer_id::text LIKE 'f0f0f0f0-0000-4000-8000-0000000000%';
-- DELETE FROM gym_trainers WHERE gym_id = 'f0f0f0f0-0000-4000-8000-000000000001';
-- DELETE FROM gyms WHERE id = 'f0f0f0f0-0000-4000-8000-000000000001';
-- (my_active_trainer_id: původní ORDER BY gt.created_at je v 20261008_public_workouts.sql)
