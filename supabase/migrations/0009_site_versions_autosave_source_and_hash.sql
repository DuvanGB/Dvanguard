alter table public.site_versions
  drop constraint if exists site_versions_source_check;

alter table public.site_versions
  add constraint site_versions_source_check
  check (
    source in (
      'manual',
      'llm',
      'fallback',
      'migration_v1_to_v2',
      'auto_save',
      'manual_checkpoint'
    )
  );

alter table public.site_versions
  add column if not exists content_hash text;

create index if not exists idx_site_versions_site_content_hash
  on public.site_versions(site_id, content_hash)
  where content_hash is not null;
