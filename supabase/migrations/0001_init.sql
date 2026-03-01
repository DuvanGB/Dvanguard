create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subdomain text not null unique check (subdomain ~ '^[a-z0-9-]{3,50}$'),
  site_type text not null check (site_type in ('informative', 'commerce_lite')),
  config_json jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  version integer not null,
  site_spec_json jsonb not null,
  source text not null default 'manual' check (source in ('manual', 'llm', 'fallback')),
  created_at timestamptz not null default now(),
  unique(site_id, version)
);

create table if not exists public.site_publications (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  version_id uuid not null references public.site_versions(id) on delete cascade,
  is_active boolean not null default true,
  published_at timestamptz not null default now()
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  job_type text not null,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sites_owner_id on public.sites(owner_id);
create index if not exists idx_site_versions_site_id_version on public.site_versions(site_id, version desc);
create index if not exists idx_publications_site_id_active on public.site_publications(site_id, is_active);
create index if not exists idx_ai_jobs_site_id_created_at on public.ai_jobs(site_id, created_at desc);
create index if not exists idx_events_site_id_created_at on public.events(site_id, created_at desc);

alter table public.sites
  add constraint sites_current_version_id_fk
  foreign key (current_version_id) references public.site_versions(id)
  on delete set null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at
before update on public.sites
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_versions enable row level security;
alter table public.site_publications enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.events enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "sites_select_own" on public.sites
for select using (owner_id = auth.uid());

create policy "sites_insert_own" on public.sites
for insert with check (owner_id = auth.uid());

create policy "sites_update_own" on public.sites
for update using (owner_id = auth.uid());

create policy "sites_delete_own" on public.sites
for delete using (owner_id = auth.uid());

create policy "site_versions_select_owner" on public.site_versions
for select using (
  exists (
    select 1 from public.sites s
    where s.id = site_versions.site_id and s.owner_id = auth.uid()
  )
);

create policy "site_versions_insert_owner" on public.site_versions
for insert with check (
  exists (
    select 1 from public.sites s
    where s.id = site_versions.site_id and s.owner_id = auth.uid()
  )
);

create policy "site_publications_select_owner" on public.site_publications
for select using (
  exists (
    select 1 from public.sites s
    where s.id = site_publications.site_id and s.owner_id = auth.uid()
  )
);

create policy "site_publications_insert_owner" on public.site_publications
for insert with check (
  exists (
    select 1 from public.sites s
    where s.id = site_publications.site_id and s.owner_id = auth.uid()
  )
);

create policy "site_publications_update_owner" on public.site_publications
for update using (
  exists (
    select 1 from public.sites s
    where s.id = site_publications.site_id and s.owner_id = auth.uid()
  )
);

create policy "ai_jobs_select_owner" on public.ai_jobs
for select using (created_by = auth.uid());

create policy "ai_jobs_insert_owner" on public.ai_jobs
for insert with check (created_by = auth.uid());

create policy "ai_jobs_update_owner" on public.ai_jobs
for update using (created_by = auth.uid());

create policy "events_select_owner" on public.events
for select using (
  exists (
    select 1 from public.sites s
    where s.id = events.site_id and s.owner_id = auth.uid()
  )
);

create policy "events_insert_owner" on public.events
for insert with check (
  exists (
    select 1 from public.sites s
    where s.id = events.site_id and s.owner_id = auth.uid()
  )
);
