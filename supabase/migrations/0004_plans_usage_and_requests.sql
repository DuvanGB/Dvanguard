create table if not exists public.plan_definitions (
  code text primary key check (code in ('free', 'pro')),
  name text not null,
  max_ai_generations_per_month integer not null check (max_ai_generations_per_month > 0),
  max_published_sites integer not null check (max_published_sites > 0),
  created_at timestamptz not null default now()
);

insert into public.plan_definitions (code, name, max_ai_generations_per_month, max_published_sites)
values
  ('free', 'Gratis', 10, 1),
  ('pro', 'Pro', 200, 20)
on conflict (code) do update
set
  name = excluded.name,
  max_ai_generations_per_month = excluded.max_ai_generations_per_month,
  max_published_sites = excluded.max_published_sites;

create table if not exists public.user_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_code text not null references public.plan_definitions(code),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_counters_monthly (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period date not null,
  ai_generations_count integer not null default 0 check (ai_generations_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create table if not exists public.pro_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_plans_plan_code on public.user_plans(plan_code);
create index if not exists idx_usage_counters_user_period on public.usage_counters_monthly(user_id, period desc);
create index if not exists idx_pro_requests_status_created_at on public.pro_requests(status, created_at desc);
create index if not exists idx_pro_requests_user_id_created_at on public.pro_requests(user_id, created_at desc);
create index if not exists idx_platform_events_type_created_at on public.platform_events(event_type, created_at desc);
create index if not exists idx_platform_events_user_created_at on public.platform_events(user_id, created_at desc);

insert into public.user_plans (user_id, plan_code)
select p.id, 'free'
from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.handle_profile_created_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_plans (user_id, plan_code)
  values (new.id, 'free')
  on conflict (user_id) do nothing;

  insert into public.platform_events (event_type, user_id, payload_json)
  values ('user.signed_up', new.id, jsonb_build_object('email', new.email));

  return new;
end;
$$;

drop trigger if exists trg_profiles_created_defaults on public.profiles;
create trigger trg_profiles_created_defaults
after insert on public.profiles
for each row execute procedure public.handle_profile_created_defaults();

insert into public.platform_events (event_type, user_id, payload_json, created_at)
select 'user.signed_up', p.id, jsonb_build_object('email', p.email), p.created_at
from public.profiles p
where not exists (
  select 1 from public.platform_events pe where pe.user_id = p.id and pe.event_type = 'user.signed_up'
);

drop trigger if exists trg_usage_counters_updated_at on public.usage_counters_monthly;
create trigger trg_usage_counters_updated_at
before update on public.usage_counters_monthly
for each row execute procedure public.set_updated_at();

alter table public.plan_definitions enable row level security;
alter table public.user_plans enable row level security;
alter table public.usage_counters_monthly enable row level security;
alter table public.pro_requests enable row level security;
alter table public.platform_events enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_definitions' AND policyname='plan_definitions_select_authenticated'
  ) THEN
    CREATE POLICY "plan_definitions_select_authenticated" ON public.plan_definitions
    FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_plans' AND policyname='user_plans_select_own'
  ) THEN
    CREATE POLICY "user_plans_select_own" ON public.user_plans
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_counters_monthly' AND policyname='usage_counters_select_own'
  ) THEN
    CREATE POLICY "usage_counters_select_own" ON public.usage_counters_monthly
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_counters_monthly' AND policyname='usage_counters_insert_own'
  ) THEN
    CREATE POLICY "usage_counters_insert_own" ON public.usage_counters_monthly
    FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_counters_monthly' AND policyname='usage_counters_update_own'
  ) THEN
    CREATE POLICY "usage_counters_update_own" ON public.usage_counters_monthly
    FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pro_requests' AND policyname='pro_requests_select_own'
  ) THEN
    CREATE POLICY "pro_requests_select_own" ON public.pro_requests
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pro_requests' AND policyname='pro_requests_insert_own'
  ) THEN
    CREATE POLICY "pro_requests_insert_own" ON public.pro_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_events' AND policyname='platform_events_select_own'
  ) THEN
    CREATE POLICY "platform_events_select_own" ON public.platform_events
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;
