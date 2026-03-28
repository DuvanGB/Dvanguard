create table if not exists public.site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  hostname text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verifying', 'active', 'failed', 'removed')),
  verification_json jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists idx_site_domains_site_id_created_at
  on public.site_domains(site_id, created_at desc);

create index if not exists idx_site_domains_status_created_at
  on public.site_domains(status, created_at desc);

create unique index if not exists idx_site_domains_primary_per_site
  on public.site_domains(site_id)
  where is_primary = true and status <> 'removed';

alter table public.site_domains enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_domains' and policyname='site_domains_select_owner'
  ) then
    create policy "site_domains_select_owner" on public.site_domains
      for select using (
        exists (
          select 1 from public.sites s
          where s.id = site_domains.site_id
            and s.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_domains' and policyname='site_domains_insert_owner'
  ) then
    create policy "site_domains_insert_owner" on public.site_domains
      for insert with check (
        exists (
          select 1 from public.sites s
          where s.id = site_domains.site_id
            and s.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_domains' and policyname='site_domains_update_owner'
  ) then
    create policy "site_domains_update_owner" on public.site_domains
      for update using (
        exists (
          select 1 from public.sites s
          where s.id = site_domains.site_id
            and s.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_domains' and policyname='site_domains_delete_owner'
  ) then
    create policy "site_domains_delete_owner" on public.site_domains
      for delete using (
        exists (
          select 1 from public.sites s
          where s.id = site_domains.site_id
            and s.owner_id = auth.uid()
        )
      );
  end if;
end $$;
