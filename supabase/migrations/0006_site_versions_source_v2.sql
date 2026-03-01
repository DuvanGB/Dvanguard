-- Allow site versions created by v1->v2 lazy migration.
alter table public.site_versions
  drop constraint if exists site_versions_source_check;

alter table public.site_versions
  add constraint site_versions_source_check
  check (source in ('manual', 'llm', 'fallback', 'migration_v1_to_v2'));
