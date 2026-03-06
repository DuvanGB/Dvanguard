begin;

create index if not exists idx_site_versions_schema_version
  on public.site_versions ((site_spec_json ->> 'schema_version'));

create index if not exists idx_site_versions_site_version_desc
  on public.site_versions (site_id, version desc);

commit;
