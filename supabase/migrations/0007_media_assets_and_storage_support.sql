create table if not exists public.site_media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('uploaded', 'external')),
  storage_path text,
  public_url text not null,
  mime_type text,
  size_bytes bigint,
  alt_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_media_assets_site_created_at
  on public.site_media_assets(site_id, created_at desc);

create index if not exists idx_site_media_assets_owner_created_at
  on public.site_media_assets(owner_id, created_at desc);

alter table public.site_media_assets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_media_assets' and policyname='site_media_assets_select_owner'
  ) then
    create policy "site_media_assets_select_owner" on public.site_media_assets
      for select using (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_media_assets' and policyname='site_media_assets_insert_owner'
  ) then
    create policy "site_media_assets_insert_owner" on public.site_media_assets
      for insert with check (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_media_assets' and policyname='site_media_assets_update_owner'
  ) then
    create policy "site_media_assets_update_owner" on public.site_media_assets
      for update using (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_media_assets' and policyname='site_media_assets_delete_owner'
  ) then
    create policy "site_media_assets_delete_owner" on public.site_media_assets
      for delete using (owner_id = auth.uid());
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='site_assets_public_read'
  ) then
    create policy "site_assets_public_read" on storage.objects
      for select using (bucket_id = 'site-assets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='site_assets_owner_insert'
  ) then
    create policy "site_assets_owner_insert" on storage.objects
      for insert with check (
        bucket_id = 'site-assets'
        and split_part(name, '/', 1) = 'user'
        and split_part(name, '/', 2) = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='site_assets_owner_update'
  ) then
    create policy "site_assets_owner_update" on storage.objects
      for update using (
        bucket_id = 'site-assets'
        and split_part(name, '/', 1) = 'user'
        and split_part(name, '/', 2) = auth.uid()::text
      )
      with check (
        bucket_id = 'site-assets'
        and split_part(name, '/', 1) = 'user'
        and split_part(name, '/', 2) = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='site_assets_owner_delete'
  ) then
    create policy "site_assets_owner_delete" on storage.objects
      for delete using (
        bucket_id = 'site-assets'
        and split_part(name, '/', 1) = 'user'
        and split_part(name, '/', 2) = auth.uid()::text
      );
  end if;
end $$;
