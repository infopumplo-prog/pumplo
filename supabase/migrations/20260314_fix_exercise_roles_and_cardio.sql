-- Fix exercises with wrong primary_role assignments
-- shoulder press: was vertical_pull, should be vertical_push
UPDATE public.exercises SET primary_role = 'vertical_push' WHERE name = 'shoulder press' AND primary_role = 'vertical_pull';

-- vertical push: was horizontal_push, should be vertical_push
UPDATE public.exercises SET primary_role = 'vertical_push' WHERE name = 'vertical push' AND primary_role = 'horizontal_push';

-- vertical tlak: was vertical_pull, should be vertical_push
UPDATE public.exercises SET primary_role = 'vertical_push' WHERE name = 'vertical tlak' AND primary_role = 'vertical_pull';
