ALTER TABLE public.character_images
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS character_images_character_id_idx ON public.character_images(character_id);