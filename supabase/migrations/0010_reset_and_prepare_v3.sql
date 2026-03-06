-- Fase 7 reset-first.
-- This migration intentionally clears product data to start from a clean state.

begin;

truncate table public.site_publications restart identity cascade;
truncate table public.site_versions restart identity cascade;
truncate table public.ai_jobs restart identity cascade;
truncate table public.events restart identity cascade;
truncate table public.platform_events restart identity cascade;
truncate table public.site_analytics_events restart identity cascade;
truncate table public.site_media_assets restart identity cascade;
truncate table public.usage_counters_monthly restart identity cascade;
truncate table public.pro_requests restart identity cascade;
truncate table public.sites restart identity cascade;

commit;
