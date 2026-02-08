-- Add bench_configs to gym_machines for storing which bench configurations a gym supports
ALTER TABLE gym_machines 
ADD COLUMN bench_configs text[] DEFAULT NULL;

-- Add required_bench_config to exercises for specifying which bench config an exercise needs
ALTER TABLE exercises 
ADD COLUMN required_bench_config text DEFAULT NULL;

-- Add requires_bench_config to machines for triggering UI configuration
ALTER TABLE machines 
ADD COLUMN requires_bench_config boolean DEFAULT false;

-- Mark bench press machines as requiring configuration
UPDATE machines SET requires_bench_config = true 
WHERE name ILIKE '%bench press%';

-- Set required_bench_config for existing exercises
-- Flat bench press exercises
UPDATE exercises SET required_bench_config = 'flat'
WHERE name ILIKE 'Barbell Bench Press' AND name NOT ILIKE '%incline%' AND name NOT ILIKE '%decline%';

-- Incline exercises
UPDATE exercises SET required_bench_config = 'incline'
WHERE name ILIKE '%incline%bench press%' OR name ILIKE '%incline%press%';

-- Decline exercises  
UPDATE exercises SET required_bench_config = 'decline'
WHERE name ILIKE '%decline%bench press%' OR name ILIKE '%decline%press%';

-- Add comment for documentation
COMMENT ON COLUMN gym_machines.bench_configs IS 'Array of supported bench configurations: flat, incline, decline. NULL means machine does not need configuration.';
COMMENT ON COLUMN exercises.required_bench_config IS 'Required bench configuration for exercise: flat, incline, decline. NULL means no specific bench config needed.';
COMMENT ON COLUMN machines.requires_bench_config IS 'Whether this machine requires bench configuration selection in B2B UI.';