
-- S3: preset preview image path
ALTER TABLE public.presets ADD COLUMN IF NOT EXISTS preview_path TEXT;

-- S4: record which seed produced which result (for lock-one/vary-rest)
ALTER TABLE public.generation_results ADD COLUMN IF NOT EXISTS seed BIGINT;
