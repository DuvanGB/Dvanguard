begin;

alter table public.site_versions
  drop constraint if exists site_versions_source_check;

alter table public.site_versions
  add constraint site_versions_source_check
  check (
    source in (
      'manual',
      'hybrid_generate',
      'canvas_auto_save',
      'canvas_manual_checkpoint'
    )
  );

alter table public.site_versions
  drop constraint if exists site_versions_schema_version_v3_check;

alter table public.site_versions
  add constraint site_versions_schema_version_v3_check
  check ((site_spec_json ->> 'schema_version') = '3.0');

commit;
