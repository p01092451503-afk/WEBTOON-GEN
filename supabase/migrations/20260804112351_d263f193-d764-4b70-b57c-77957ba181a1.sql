ALTER TABLE public.video_generations
ADD COLUMN negative_prompt text;

COMMENT ON COLUMN public.video_generations.negative_prompt IS
'Negative prompt stored separately from the positive generation prompt.';