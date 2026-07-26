-- ── 1. 테넌트 / 프로필 ───────────────────────────────
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tenants to authenticated;
grant all on public.tenants to service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'member',
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ── 2. 캐릭터 / 레퍼런스 이미지 ───────────────────────
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  display_name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.characters to authenticated;
grant all on public.characters to service_role;

create table public.character_images (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  storage_path text not null,
  seq int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.character_images to authenticated;
grant all on public.character_images to service_role;

-- ── 3. 프리셋 ───────────────────────
create table public.presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  sheet text not null,
  item_id text not null,
  label_ko text not null,
  label_en text,
  prompt_text text,
  level int not null default 0,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, sheet, item_id)
);
grant select, insert, update, delete on public.presets to authenticated;
grant all on public.presets to service_role;

-- ── 4. 생성 작업 ──────────────
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id),
  work_label text not null default 'W1',
  status text not null default 'queued',
  mode text not null default 'new',
  aspect_ratio text,
  api_size text,
  api_model text,
  seed bigint,
  compiled_prompt text,
  final_prompt text,
  options jsonb not null default '{}',
  figure_map jsonb not null default '{}',
  warnings jsonb not null default '[]',
  batch_count int not null default 1,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.generations (tenant_id, created_at desc);
grant select, insert, update, delete on public.generations to authenticated;
grant all on public.generations to service_role;

-- ── 5. 생성 결과 이미지 ──────────────────────────────
create table public.generation_results (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  seq int not null default 0,
  storage_path text,
  thumb_path text,
  source_url text,
  source_url_expires_at timestamptz,
  width int,
  height int,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.generation_results to authenticated;
grant all on public.generation_results to service_role;

-- ── 6. 사용량/원가 로그 ──
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id),
  generation_id uuid references public.generations(id),
  image_count int not null default 0,
  est_api_cost numeric(12,6) default 0,
  est_storage_bytes bigint default 0,
  created_at timestamptz not null default now()
);
grant select on public.usage_events to authenticated;
grant all on public.usage_events to service_role;

-- ── 헬퍼: 현재 사용자 tenant_id ──────────────────────
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- ── RLS 활성화 + 정책 ────────────────────────────────
alter table public.tenants            enable row level security;
alter table public.profiles           enable row level security;
alter table public.characters         enable row level security;
alter table public.character_images   enable row level security;
alter table public.presets            enable row level security;
alter table public.generations        enable row level security;
alter table public.generation_results enable row level security;
alter table public.usage_events        enable row level security;

create policy "own profile" on public.profiles
  for select using (id = auth.uid());

create policy "tenant characters" on public.characters
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant character images" on public.character_images
  for all
  using (exists (select 1 from public.characters c
                 where c.id = character_id and c.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from public.characters c
                 where c.id = character_id and c.tenant_id = public.current_tenant_id()));

create policy "read presets" on public.presets
  for select using (tenant_id is null or tenant_id = public.current_tenant_id());

create policy "tenant generations" on public.generations
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant results" on public.generation_results
  for all
  using (exists (select 1 from public.generations g
                 where g.id = generation_id and g.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from public.generations g
                 where g.id = generation_id and g.tenant_id = public.current_tenant_id()));

create policy "tenant usage" on public.usage_events
  for select using (tenant_id = public.current_tenant_id());