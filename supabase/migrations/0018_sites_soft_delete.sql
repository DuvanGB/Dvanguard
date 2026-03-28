alter table public.sites
  add column if not exists deleted_at timestamptz;

create index if not exists idx_sites_owner_deleted_at
  on public.sites(owner_id, deleted_at);
