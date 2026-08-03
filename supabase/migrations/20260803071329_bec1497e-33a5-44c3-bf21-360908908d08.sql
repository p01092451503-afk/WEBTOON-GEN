CREATE TABLE public.video_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  work_label text NOT NULL DEFAULT 'V1',
  status text NOT NULL DEFAULT 'queued',
  mode text NOT NULL DEFAULT 't2v',
  final_prompt text NOT NULL,
  raw_prompt text,
  prompt_edited boolean NOT NULL DEFAULT false,
  aspect_ratio text,
  resolution text,
  duration_seconds integer NOT NULL DEFAULT 5,
  camera_fixed boolean NOT NULL DEFAULT false,
  seed bigint,
  api_model text,
  task_id text,
  image_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.video_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_generation_id uuid NOT NULL REFERENCES public.video_generations(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  poster_path text,
  source_url text,
  duration_seconds integer,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_generations_tenant ON public.video_generations(tenant_id, created_at DESC);
CREATE INDEX idx_video_results_gen ON public.video_results(video_generation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_generations TO authenticated;
GRANT ALL ON public.video_generations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_results TO authenticated;
GRANT ALL ON public.video_results TO service_role;

ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_video_generations" ON public.video_generations
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_isolation_video_results" ON public.video_results
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.video_generations g WHERE g.id = video_generation_id AND g.tenant_id = public.current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.video_generations g WHERE g.id = video_generation_id AND g.tenant_id = public.current_tenant_id()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.video_generations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_results;