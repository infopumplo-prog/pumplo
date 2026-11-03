-- DEMO veřejné tréninky pro prezentaci (8. 10. 2026). NENÍ migrace — spouští se ručně.
--
-- Vše žije v ukázkové posilovně „Pumplo Demo Gym“ (deadbeef-…-000000000001, nepublikovaná).
-- Katalog ji ukazuje jen adminům a jejím členům, běžní uživatelé demo nevidí.
-- Plány vlastní účet demo posilovny (d34a63b4-…), trenéři jsou demo záznamy v gym_trainers.
-- Skript je opakovatelný: nejdřív smaže svoje demo řádky (pevná ID), pak je založí znovu.
--
-- Úklid: spustit jen blok „ÚKLID“ níže.

BEGIN;

-- ÚKLID (pevná ID, nic jiného nemaže)
DELETE FROM custom_plans WHERE id IN (
  'deadbeef-0000-4000-8000-0000000002a1', 'deadbeef-0000-4000-8000-0000000002a2',
  'deadbeef-0000-4000-8000-0000000002b1', 'deadbeef-0000-4000-8000-0000000002b2',
  'deadbeef-0000-4000-8000-0000000002c1', 'deadbeef-0000-4000-8000-0000000002c2'
);
DELETE FROM gym_trainers WHERE id IN (
  'deadbeef-0000-4000-8000-0000000001a1', 'deadbeef-0000-4000-8000-0000000001b1', 'deadbeef-0000-4000-8000-0000000001c1'
);

-- Trenéři (demo záznamy v ukázkové posilovně)
INSERT INTO gym_trainers (id, gym_id, name, bio, specializations, status, is_active, sort_order, photo_url) VALUES
  ('deadbeef-0000-4000-8000-0000000001a1', 'deadbeef-0000-4000-8000-000000000001', 'David Beníšek',
   'Silový trenér. Základní cviky, progresivní zátěž a technika, která vydrží i těžké váhy.',
   ARRAY['Silový trénink', 'Powerlifting', 'Technika základních cviků'], 'approved', true, 1, NULL),
  ('deadbeef-0000-4000-8000-0000000001b1', 'deadbeef-0000-4000-8000-000000000001', 'Adam Kakiš',
   'Trenér zaměřený na hypertrofii. Objem, kontrola pohybu a chytré dělení tréninku.',
   ARRAY['Hypertrofie', 'Nabírání svalové hmoty', 'Kulturistika'], 'approved', true, 2, NULL),
  ('deadbeef-0000-4000-8000-0000000001c1', 'deadbeef-0000-4000-8000-000000000001', 'Jarmila Valentová',
   'Hubnutí a kondice. Kruhové tréninky, které spálí a zároveň posílí celé tělo.',
   ARRAY['Redukce tuku', 'Zlepšení fyzické kondice', 'Funkční trénink'], 'approved', true, 3,
   'https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/gym-assets/39684b2f-9e5a-484b-bf84-d30eae18691c/trainers/jarmila-valentova.jpg');

-- Pomocná funkce jen pro tento skript: jeden den plánu + cviky podle názvu.
-- p_items: pole JSON objektů {n: název cviku, s: série, r: opakování/min/s, rest: pauza v s}
CREATE OR REPLACE FUNCTION pg_temp.demo_day(p_plan uuid, p_day int, p_name text, p_items jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_day uuid;
  v_item jsonb;
  v_ex uuid;
  v_idx int := 0;
BEGIN
  INSERT INTO custom_plan_days (plan_id, day_number, name) VALUES (p_plan, p_day, p_name) RETURNING id INTO v_day;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT e.id INTO v_ex FROM exercises e
      WHERE e.owner_id IS NULL AND e.name = v_item->>'n'
      ORDER BY e.created_at LIMIT 1;
    IF v_ex IS NULL THEN
      RAISE EXCEPTION 'demo seed: cvik "%" neexistuje', v_item->>'n';
    END IF;
    INSERT INTO custom_plan_exercises (day_id, exercise_id, sets, reps, rest_seconds, order_index)
      VALUES (v_day, v_ex, (v_item->>'s')::int, (v_item->>'r')::int, (v_item->>'rest')::int, v_idx);
    v_idx := v_idx + 1;
  END LOOP;
END $$;

-- Plány (vlastník = účet demo posilovny; auth.uid() je v SQL NULL, strážce zveřejnění propustí)
INSERT INTO custom_plans (id, user_id, name, description, goal, level, focus, trainer_id, is_public, published_at, rest_duration_seconds) VALUES
  ('deadbeef-0000-4000-8000-0000000002a1', 'd34a63b4-f63e-4d57-8070-a343ac91e7d5', 'Silový základ 5×5',
   'Klasika pro sílu: tři základní cviky na trénink, pět sérií po pěti. Každý týden přidej 2,5 kg. Ideální 3× týdně, střídej dny A a B.',
   'strength', 'intermediate', 'full_body', 'deadbeef-0000-4000-8000-0000000001a1', true, now() - interval '6 days', 180),
  ('deadbeef-0000-4000-8000-0000000002a2', 'd34a63b4-f63e-4d57-8070-a343ac91e7d5', 'Silová dvojka: horní / spodní',
   'Pro pokročilé: těžké trojky na hlavních cvicích a doplňky na slabá místa. 4× týdně, horní a spodní polovina těla.',
   'strength', 'advanced', 'full_body', 'deadbeef-0000-4000-8000-0000000001a1', true, now() - interval '2 days', 180),
  ('deadbeef-0000-4000-8000-0000000002b1', 'd34a63b4-f63e-4d57-8070-a343ac91e7d5', 'Push / Pull / Legs — objem',
   'Tři dny, každý sval s dostatečným objemem. 8–12 opakování, poslední série blízko selhání. Opakuj 2× za týden.',
   'muscle', 'intermediate', 'full_body', 'deadbeef-0000-4000-8000-0000000001b1', true, now() - interval '5 days', 90),
  ('deadbeef-0000-4000-8000-0000000002b2', 'd34a63b4-f63e-4d57-8070-a343ac91e7d5', 'Chest & Arms day',
   'Hrudník, biceps a triceps v jednom tréninku. Kontrolovaný spouštěcí pohyb a plný rozsah — pump zaručen.',
   'muscle', 'intermediate', 'chest', 'deadbeef-0000-4000-8000-0000000001b1', true, now() - interval '1 day', 75),
  ('deadbeef-0000-4000-8000-0000000002c1', 'd34a63b4-f63e-4d57-8070-a343ac91e7d5', 'Spaluj & posiluj — celé tělo',
   'Kruhový trénink pro hubnutí: zahřátí na kardiu, pak cviky na celé tělo s krátkou pauzou. Vhodné i pro začátečníky, 2–3× týdně.',
   'weight_loss', 'beginner', 'full_body', 'deadbeef-0000-4000-8000-0000000001c1', true, now() - interval '4 days', 45),
  ('deadbeef-0000-4000-8000-0000000002c2', 'd34a63b4-f63e-4d57-8070-a343ac91e7d5', 'Super booty',
   'Hýždě a zadní strana stehen. Hip thrusty, výpady a kladky — zpevní, vytvaruje a pořádně rozproudí krev.',
   'weight_loss', 'beginner', 'glutes', 'deadbeef-0000-4000-8000-0000000001c1', true, now() - interval '3 hours', 60);

-- David Beníšek — síla
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002a1', 1, 'Den A', '[
  {"n":"Dřep ve stojanu","s":5,"r":5,"rest":180},
  {"n":"Bench press","s":5,"r":5,"rest":180},
  {"n":"Přítah v předklonu s osou","s":5,"r":5,"rest":150}]');
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002a1', 2, 'Den B', '[
  {"n":"Dřep ve stojanu","s":5,"r":5,"rest":180},
  {"n":"Tlak nad hlavu v silové kleci","s":5,"r":5,"rest":150},
  {"n":"Mrtvý tah na platformě","s":1,"r":5,"rest":240}]');

SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002a2', 1, 'Horní polovina', '[
  {"n":"Bench press","s":5,"r":3,"rest":210},
  {"n":"Shyby nadhmatem","s":4,"r":6,"rest":150},
  {"n":"Tlak nad hlavu","s":4,"r":5,"rest":150},
  {"n":"Pendlay row","s":4,"r":5,"rest":150},
  {"n":"Kliky na bradlech","s":3,"r":8,"rest":120}]');
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002a2', 2, 'Spodní polovina', '[
  {"n":"Dřep","s":5,"r":3,"rest":210},
  {"n":"Rumunský mrtvý tah v silové kleci","s":4,"r":6,"rest":150},
  {"n":"Bulharský dřep s jednoručkami","s":3,"r":8,"rest":120},
  {"n":"Hyperextenze zad","s":3,"r":10,"rest":90},
  {"n":"Zdvih nohou ve visu","s":3,"r":10,"rest":90}]');

-- Adam Kakiš — hypertrofie
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002b1', 1, 'Push', '[
  {"n":"Šikmý tlak s jednoručkami","s":4,"r":10,"rest":90},
  {"n":"Tlaky na pektorálním stroji","s":3,"r":12,"rest":90},
  {"n":"Peck deck","s":3,"r":12,"rest":60},
  {"n":"Tlak nad hlavu s jednoručkami","s":3,"r":10,"rest":90},
  {"n":"Upažování na stroji","s":3,"r":15,"rest":60},
  {"n":"Tricepsové extenze nad hlavou na kladce","s":3,"r":12,"rest":60}]');
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002b1', 2, 'Pull', '[
  {"n":"Stahování širokým úchopem","s":4,"r":10,"rest":90},
  {"n":"Přítahy na stroji vsedě","s":3,"r":12,"rest":90},
  {"n":"Přitah jednoručky jednou rukou s oporou o lavici","s":3,"r":10,"rest":75},
  {"n":"Obrácené rozpažování na stroji","s":3,"r":15,"rest":60},
  {"n":"Bicepsový zdvih s jednoručkami","s":3,"r":12,"rest":60},
  {"n":"Kladivový zdvih s jednoručkami","s":3,"r":12,"rest":60}]');
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002b1', 3, 'Legs', '[
  {"n":"Leg press 45°","s":4,"r":12,"rest":120},
  {"n":"Předkopávání v sedě","s":3,"r":15,"rest":60},
  {"n":"Zakopávání vleže","s":3,"r":12,"rest":60},
  {"n":"Rumunský mrtvý tah s jednoručkami","s":3,"r":10,"rest":90},
  {"n":"Výpony na lýtka ve stoje","s":4,"r":15,"rest":45}]');

SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002b2', 1, 'Chest & Arms', '[
  {"n":"Bench press","s":4,"r":8,"rest":120},
  {"n":"Šikmý tlak na prsa","s":3,"r":10,"rest":90},
  {"n":"Rozpažení na kladce","s":3,"r":12,"rest":60},
  {"n":"Skull crusher s jednoručkami","s":3,"r":10,"rest":60},
  {"n":"Bicepsový zdvih na spodní kladce","s":3,"r":12,"rest":60},
  {"n":"Kladivový zdvih s jednoručkami","s":3,"r":12,"rest":60}]');

-- Jarmila Valentová — hubnutí a kondice (kardio: r = minuty u time_min, sekundy u seconds)
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002c1', 1, 'Okruh 1', '[
  {"n":"Veslování","s":1,"r":10,"rest":60},
  {"n":"Goblet dřep s kettlebellem","s":3,"r":15,"rest":45},
  {"n":"TRX přitah","s":3,"r":12,"rest":45},
  {"n":"Výpady s jednoručkami","s":3,"r":12,"rest":45},
  {"n":"TRX klik","s":3,"r":10,"rest":45},
  {"n":"Air bike","s":1,"r":8,"rest":0}]');
SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002c1', 2, 'Okruh 2', '[
  {"n":"Orbitrek","s":1,"r":10,"rest":60},
  {"n":"Hip thrust s jednoručkou","s":3,"r":15,"rest":45},
  {"n":"Přitahy k pasu","s":3,"r":12,"rest":45},
  {"n":"Výstup na box","s":3,"r":12,"rest":45},
  {"n":"Mrtvý brouk","s":3,"r":12,"rest":30},
  {"n":"Skákání přes švihadlo","s":3,"r":45,"rest":30}]');

SELECT pg_temp.demo_day('deadbeef-0000-4000-8000-0000000002c2', 1, 'Super booty', '[
  {"n":"Hip thrust s osou","s":4,"r":12,"rest":75},
  {"n":"Bulharský dřep s jednoručkami","s":3,"r":10,"rest":60},
  {"n":"Rumunský mrtvý tah s jednoručkami","s":3,"r":12,"rest":60},
  {"n":"Kickback na kladce","s":3,"r":15,"rest":45},
  {"n":"Roznožování v sedě","s":3,"r":20,"rest":45},
  {"n":"Hyperextenze (zaměření na hýždě)","s":3,"r":15,"rest":45}]');

-- Lajky od demo členů (member01–35 v ukázkové posilovně)
INSERT INTO workout_likes (plan_id, user_id)
SELECT t.plan_id, m.user_id
FROM (VALUES
  ('deadbeef-0000-4000-8000-0000000002a1'::uuid, 14),
  ('deadbeef-0000-4000-8000-0000000002a2'::uuid, 9),
  ('deadbeef-0000-4000-8000-0000000002b1'::uuid, 21),
  ('deadbeef-0000-4000-8000-0000000002b2'::uuid, 12),
  ('deadbeef-0000-4000-8000-0000000002c1'::uuid, 17),
  ('deadbeef-0000-4000-8000-0000000002c2'::uuid, 26)
) AS t(plan_id, n)
CROSS JOIN LATERAL (
  SELECT up.user_id FROM user_profiles up
  WHERE up.selected_gym_id = 'deadbeef-0000-4000-8000-000000000001'
  ORDER BY md5(up.user_id::text || t.plan_id::text)
  LIMIT t.n
) m
ON CONFLICT DO NOTHING;

-- Obálky (sloupec z migrace 20261008b_public_workouts_covers.sql)
UPDATE custom_plans SET cover_url = '/img/workouts/cover-silovy-zaklad.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002a1';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-silova-dvojka.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002a2';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-ppl.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002b1';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-chest-arms.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002b2';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-spaluj.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET cover_url = '/img/workouts/cover-super-booty.jpg' WHERE id = 'deadbeef-0000-4000-8000-0000000002c2';

-- Anglické texty + partie (sloupce z migrace 20261008c_public_workouts_en_liked.sql)
-- Demo: partie podle skutečných partií + anglické texty.
UPDATE custom_plans SET focus = 'cardio' WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET name_en = 'Strength Base 5×5',
  description_en = 'The strength classic: three compound lifts per session, five sets of five. Add 2.5 kg every week. Best 3× a week, alternate days A and B.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002a1';
UPDATE custom_plans SET name_en = 'Strength Split: Upper / Lower',
  description_en = 'For advanced lifters: heavy triples on the main lifts plus accessories for weak points. 4× a week, upper and lower body.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002a2';
UPDATE custom_plans SET name_en = 'Push / Pull / Legs — Volume',
  description_en = 'Three days with enough volume for every muscle. 8–12 reps, last set close to failure. Repeat twice a week.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002b1';
UPDATE custom_plans SET name_en = 'Chest & Arms Day',
  description_en = 'Chest, biceps and triceps in one session. Controlled lowering and full range of motion — pump guaranteed.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002b2';
UPDATE custom_plans SET name_en = 'Burn & Build — Full Body',
  description_en = 'Fat-loss circuit: cardio warm-up, then full-body exercises with short rests. Beginner friendly, 2–3× a week.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET name_en = 'Super Booty',
  description_en = 'Glutes and hamstrings. Hip thrusts, lunges and cables — firms, shapes and gets the blood pumping.'
  WHERE id = 'deadbeef-0000-4000-8000-0000000002c2';

UPDATE custom_plan_days d SET name_en = v.en
FROM (VALUES ('Den A', 'Day A'), ('Den B', 'Day B'), ('Horní polovina', 'Upper body'), ('Spodní polovina', 'Lower body'),
             ('Push', 'Push'), ('Pull', 'Pull'), ('Legs', 'Legs'), ('Chest & Arms', 'Chest & Arms'),
             ('Okruh 1', 'Circuit 1'), ('Okruh 2', 'Circuit 2'), ('Super booty', 'Super booty')) AS v(cs, en)
WHERE d.name = v.cs AND d.plan_id::text LIKE 'deadbeef-0000-4000-8000-0000000002%';

-- Další partie (sloupec z migrace 20261008d_public_workouts_secondary_focus.sql)
-- Demo: další partie.
UPDATE custom_plans SET secondary_focuses = ARRAY['legs', 'back'] WHERE id = 'deadbeef-0000-4000-8000-0000000002a1';
UPDATE custom_plans SET secondary_focuses = ARRAY['chest', 'back', 'legs'] WHERE id = 'deadbeef-0000-4000-8000-0000000002a2';
UPDATE custom_plans SET secondary_focuses = ARRAY['chest', 'back', 'legs', 'shoulders'] WHERE id = 'deadbeef-0000-4000-8000-0000000002b1';
UPDATE custom_plans SET secondary_focuses = ARRAY['arms'] WHERE id = 'deadbeef-0000-4000-8000-0000000002b2';
UPDATE custom_plans SET secondary_focuses = ARRAY['full_body', 'legs'] WHERE id = 'deadbeef-0000-4000-8000-0000000002c1';
UPDATE custom_plans SET secondary_focuses = ARRAY['legs'] WHERE id = 'deadbeef-0000-4000-8000-0000000002c2';

COMMIT;
