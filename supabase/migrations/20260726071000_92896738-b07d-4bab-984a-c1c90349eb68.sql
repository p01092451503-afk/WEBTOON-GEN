ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS prompt_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_prompt text;