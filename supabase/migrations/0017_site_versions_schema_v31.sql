begin;

alter table public.site_versions
  drop constraint if exists site_versions_schema_version_v3_check;

alter table public.site_versions
  add constraint site_versions_schema_version_v3_check
  check ((site_spec_json ->> 'schema_version') in ('3.0', '3.1'));

commit;
