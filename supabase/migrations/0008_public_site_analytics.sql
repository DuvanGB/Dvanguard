create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  subdomain text not null,
  event_type text not null check (event_type in ('visit', 'whatsapp_click', 'cta_click')),
  page_slug text not null default '/',
  section_id text,
  occurred_at timestamptz not null default now(),
  client_id uuid,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_analytics_events_site_occurred_at
  on public.site_analytics_events(site_id, occurred_at desc);

create index if not exists idx_site_analytics_events_event_type_occurred_at
  on public.site_analytics_events(event_type, occurred_at desc);

create index if not exists idx_site_analytics_events_subdomain_occurred_at
  on public.site_analytics_events(subdomain, occurred_at desc);

alter table public.site_analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_analytics_events' and policyname='site_analytics_events_select_owner'
  ) then
    create policy "site_analytics_events_select_owner" on public.site_analytics_events
      for select using (
        exists (
          select 1 from public.sites s
          where s.id = site_analytics_events.site_id
            and s.owner_id = auth.uid()
        )
      );
  end if;
end $$;
