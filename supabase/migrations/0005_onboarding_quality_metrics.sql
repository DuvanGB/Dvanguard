-- Indexes for onboarding quality funnel queries.
create index if not exists idx_platform_events_user_event_created_at
  on public.platform_events(user_id, event_type, created_at desc);

create index if not exists idx_platform_events_site_event_created_at
  on public.platform_events(site_id, event_type, created_at desc);
