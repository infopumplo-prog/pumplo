-- Zpětná vazba z týdenních check-inů → běžný feedback (user_feedback), ať má v adminu stav
-- a kategorii jako ostatní (David 15. 10. 2026). Appka od 1.3.3 zapisuje sama; tohle doplní
-- check-iny odeslané předtím. Opakovatelné (přeskočí týdny, které už v user_feedback jsou).
-- Návrat: DELETE z user_feedback, kde responses->>'source' = 'weekly_checkin' a current_route = '/weekly-checkin'.

INSERT INTO user_feedback (user_id, feedback_type, message, responses, current_route, created_at)
SELECT c.user_id, 'other', c.app_feedback,
       jsonb_build_object('source', 'weekly_checkin', 'week_start', c.week_start::text,
                          'mood', c.mood, 'training', c.training,
                          'hardest', c.hardest, 'weight_kg', c.weight_kg),
       '/weekly-checkin', c.created_at
FROM weekly_checkins c
WHERE c.app_feedback IS NOT NULL AND btrim(c.app_feedback) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM user_feedback f
    WHERE f.user_id = c.user_id
      AND f.responses->>'source' = 'weekly_checkin'
      AND f.responses->>'week_start' = c.week_start::text
  );
