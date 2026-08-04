ALTER TABLE public.video_generations
  ADD COLUMN IF NOT EXISTS api_model_version text,
  ADD COLUMN IF NOT EXISTS actual_resolution text,
  ADD COLUMN IF NOT EXISTS actual_duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.video_results
  ALTER COLUMN duration_seconds TYPE numeric USING duration_seconds::numeric,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.video_generations
  ADD CONSTRAINT video_generations_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'blocked', 'failed'));

ALTER TABLE public.video_results
  ADD CONSTRAINT video_results_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'blocked', 'failed'));

COMMENT ON COLUMN public.video_generations.api_model_version IS 'Pinned provider model version used for reproducibility';
COMMENT ON COLUMN public.video_generations.actual_resolution IS 'Resolution measured from the persisted output file';
COMMENT ON COLUMN public.video_generations.actual_duration_seconds IS 'Duration measured from the persisted output file';
COMMENT ON COLUMN public.video_generations.moderation_details IS 'Minimal non-sensitive moderation decision metadata';
COMMENT ON COLUMN public.video_results.metadata IS 'Measured media metadata and provider delivery details, excluding temporary source URLs';