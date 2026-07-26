
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant projects" ON public.projects FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE public.project_cast (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  role_label text,
  PRIMARY KEY (project_id, character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cast TO authenticated;
GRANT ALL ON public.project_cast TO service_role;
ALTER TABLE public.project_cast ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant project_cast" ON public.project_cast FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.tenant_id = public.current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.tenant_id = public.current_tenant_id()));

CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant episodes" ON public.episodes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.tenant_id = public.current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.tenant_id = public.current_tenant_id()));

CREATE TABLE public.panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  generation_id uuid REFERENCES public.generations(id) ON DELETE SET NULL,
  chosen_result_id uuid REFERENCES public.generation_results(id) ON DELETE SET NULL,
  caption text,
  status text NOT NULL DEFAULT 'empty',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.panels TO authenticated;
GRANT ALL ON public.panels TO service_role;
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant panels" ON public.panels FOR ALL
  USING (EXISTS (SELECT 1 FROM public.episodes e JOIN public.projects p ON p.id = e.project_id WHERE e.id = episode_id AND p.tenant_id = public.current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.episodes e JOIN public.projects p ON p.id = e.project_id WHERE e.id = episode_id AND p.tenant_id = public.current_tenant_id()));

ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS panel_id uuid REFERENCES public.panels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_episodes_project ON public.episodes(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_panels_episode ON public.panels(episode_id, order_index);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON public.projects(tenant_id);
