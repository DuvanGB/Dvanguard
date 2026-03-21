create table if not exists public.user_module_tours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('dashboard', 'onboarding', 'editor')),
  completed boolean not null default false,
  dismissed boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, module)
);

create index if not exists idx_user_module_tours_user_module
  on public.user_module_tours(user_id, module);

drop trigger if exists trg_user_module_tours_updated_at on public.user_module_tours;
create trigger trg_user_module_tours_updated_at
before update on public.user_module_tours
for each row execute procedure public.set_updated_at();

alter table public.user_module_tours enable row level security;

drop policy if exists "user_module_tours_select_own" on public.user_module_tours;
create policy "user_module_tours_select_own" on public.user_module_tours
for select using (user_id = auth.uid());

drop policy if exists "user_module_tours_insert_own" on public.user_module_tours;
create policy "user_module_tours_insert_own" on public.user_module_tours
for insert with check (user_id = auth.uid());

drop policy if exists "user_module_tours_update_own" on public.user_module_tours;
create policy "user_module_tours_update_own" on public.user_module_tours
for update using (user_id = auth.uid());
