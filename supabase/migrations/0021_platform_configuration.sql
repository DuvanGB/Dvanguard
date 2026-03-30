alter table public.plan_definitions
  add column if not exists description text,
  add column if not exists bullets_json jsonb not null default '[]'::jsonb,
  add column if not exists monthly_price_cents bigint,
  add column if not exists yearly_price_cents bigint,
  add column if not exists cta_label text;

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  country_code text,
  locale_code text,
  value_json jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_copy_entries (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null,
  country_code text,
  locale_code text,
  value_text text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  country_code text,
  locale_code text,
  version_label text not null,
  title text not null,
  body_markdown text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  effective_from timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_legal_document_versions_published_scope
  on public.legal_document_versions(document_id, coalesce(country_code, ''), coalesce(locale_code, ''))
  where status = 'published';

create unique index if not exists idx_platform_settings_scope
  on public.platform_settings(setting_key, coalesce(country_code, ''), coalesce(locale_code, ''));

create unique index if not exists idx_platform_copy_entries_scope
  on public.platform_copy_entries(entry_key, coalesce(country_code, ''), coalesce(locale_code, ''));

create unique index if not exists idx_platform_settings_raw_scope
  on public.platform_settings(setting_key, country_code, locale_code);

create unique index if not exists idx_platform_copy_entries_raw_scope
  on public.platform_copy_entries(entry_key, country_code, locale_code);

alter table public.platform_settings enable row level security;
alter table public.platform_copy_entries enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;

drop trigger if exists trg_platform_settings_updated_at on public.platform_settings;
create trigger trg_platform_settings_updated_at
before update on public.platform_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_platform_copy_entries_updated_at on public.platform_copy_entries;
create trigger trg_platform_copy_entries_updated_at
before update on public.platform_copy_entries
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_legal_documents_updated_at on public.legal_documents;
create trigger trg_legal_documents_updated_at
before update on public.legal_documents
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_legal_document_versions_updated_at on public.legal_document_versions;
create trigger trg_legal_document_versions_updated_at
before update on public.legal_document_versions
for each row execute procedure public.set_updated_at();

insert into public.plan_definitions (
  code,
  name,
  max_ai_generations_per_month,
  max_published_sites,
  description,
  bullets_json,
  monthly_price_cents,
  yearly_price_cents,
  cta_label
)
values
  ('free', 'Gratis', 10, 1, 'Ideal para validar tu negocio.', '["1 sitio publicado activo", "10 generaciones IA / mes", "Editor esencial"]'::jsonb, null, null, 'Comenzar gratis'),
  ('pro', 'Pro', 200, 20, 'Para crecer con más volumen.', '["Plan mensual o anual", "Más sitios publicados activos", "Más generaciones IA / mes", "Gestión de suscripción y facturas"]'::jsonb, 4900000, 44900000, 'Suscribirme')
on conflict (code) do update
set
  name = excluded.name,
  max_ai_generations_per_month = excluded.max_ai_generations_per_month,
  max_published_sites = excluded.max_published_sites,
  description = excluded.description,
  bullets_json = excluded.bullets_json,
  monthly_price_cents = excluded.monthly_price_cents,
  yearly_price_cents = excluded.yearly_price_cents,
  cta_label = excluded.cta_label;

insert into public.platform_settings (setting_key, country_code, locale_code, value_json, description)
values
  ('billing.grace_days', 'CO', 'es-CO', '3'::jsonb, 'Días de gracia antes de enforcement en billing.'),
  ('billing.enforcement_lookback_days', 'CO', 'es-CO', '30'::jsonb, 'Ventana de lookback para elegir el sitio a conservar al hacer enforcement.'),
  ('billing.manual_reminder_days', 'CO', 'es-CO', '7'::jsonb, 'Días antes del vencimiento manual para enviar recordatorio.'),
  ('trash.retention_days', 'CO', 'es-CO', '7'::jsonb, 'Días de retención antes de purgar sitios eliminados.'),
  ('plans.default_free_code', 'CO', 'es-CO', '"free"'::jsonb, 'Plan base asignado a nuevos usuarios.'),
  ('plans.default_pro_code', 'CO', 'es-CO', '"pro"'::jsonb, 'Plan Pro principal del producto.'),
  ('onboarding.voice_locale', 'CO', 'es-CO', '"es-CO"'::jsonb, 'Locale por defecto para dictado.'),
  ('onboarding.max_input_chars', 'CO', 'es-CO', '3000'::jsonb, 'Máximo de caracteres del input inicial de onboarding.')
on conflict (setting_key, country_code, locale_code) do update
set
  value_json = excluded.value_json,
  description = excluded.description;

insert into public.platform_copy_entries (entry_key, country_code, locale_code, value_text, description)
values
  ('admin.layout.eyebrow', 'CO', 'es-CO', 'Operación interna', 'Eyebrow del layout admin.'),
  ('admin.layout.title', 'CO', 'es-CO', 'Control Center', 'Título principal del layout admin.'),
  ('admin.layout.description', 'CO', 'es-CO', 'Visibilidad operativa de usuarios, sitios, generación IA y conversión.', 'Descripción principal del layout admin.'),
  ('billing.hero.eyebrow', 'CO', 'es-CO', 'Billing', 'Eyebrow principal de billing.'),
  ('billing.hero.title', 'CO', 'es-CO', 'Suscripción y facturación', 'Título principal de billing.'),
  ('billing.hero.description', 'CO', 'es-CO', 'Gestiona Pro con Wompi usando tarjeta, PSE, Nequi o transferencia bancaria sin salir de DVanguard.', 'Descripción principal de billing.'),
  ('billing.legal.title', 'CO', 'es-CO', 'Primer paso legal', 'Título del bloque legal de billing.'),
  ('billing.legal.description', 'CO', 'es-CO', 'Antes de pagar, necesitamos registrar tu aceptación de DVanguard y mostrarte los contratos de Wompi.', 'Descripción del bloque legal de billing.'),
  ('billing.card.title', 'CO', 'es-CO', 'Tarjeta: suscripción mensual o anual', 'Título del bloque de tarjeta.'),
  ('billing.card.description', 'CO', 'es-CO', 'La tarjeta sí queda lista para renovar automáticamente. Úsala si quieres continuidad sin repetir el pago cada mes.', 'Descripción del bloque de tarjeta.'),
  ('billing.manual.title', 'CO', 'es-CO', 'PSE, Nequi y banco: compra de tiempo', 'Título del bloque de medios manuales.'),
  ('billing.manual.description', 'CO', 'es-CO', 'Estos medios no suscriben. Compran un periodo mensual de Pro y luego decides si renovar manualmente o pasar a tarjeta.', 'Descripción del bloque de medios manuales.'),
  ('billing.switch.title', 'CO', 'es-CO', 'Pasar a tarjeta al vencimiento', 'Título del bloque de cambio a tarjeta.'),
  ('billing.switch.description', 'CO', 'es-CO', 'Si tienes tiempo Pro manual activo, puedes registrar la tarjeta ahora y dejarla programada para activarse al vencer ese periodo.', 'Descripción del bloque de cambio a tarjeta.'),
  ('billing.transactions.title', 'CO', 'es-CO', 'Historial de movimientos', 'Título del bloque de transacciones.'),
  ('billing.transactions.description', 'CO', 'es-CO', 'Aquí verás cargos recurrentes, compras manuales y estados de confirmación.', 'Descripción del bloque de transacciones.'),
  ('pricing.hero.title', 'CO', 'es-CO', 'Planes y precios', 'Título principal de pricing.'),
  ('pricing.hero.description', 'CO', 'es-CO', 'Empieza gratis y escala cuando necesites más publicaciones y más generación IA.', 'Descripción principal de pricing.'),
  ('pricing.faq.title', 'CO', 'es-CO', 'Preguntas frecuentes', 'Título FAQ de pricing.'),
  ('pricing.faq.description', 'CO', 'es-CO', 'El plan Pro se gestiona con Wompi: tarjeta para renovación automática y PSE, Nequi o banco para compras manuales de tiempo Pro.', 'Texto FAQ de pricing.')
on conflict (entry_key, country_code, locale_code) do update
set
  value_text = excluded.value_text,
  description = excluded.description;

with upsert_docs as (
  insert into public.legal_documents (slug, title, description)
  values
    ('terms', 'Términos y condiciones', 'Documento legal principal de términos y condiciones.'),
    ('privacy', 'Privacidad', 'Documento legal principal de privacidad.')
  on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description
  returning id, slug
)
insert into public.legal_document_versions (
  document_id,
  country_code,
  locale_code,
  version_label,
  title,
  body_markdown,
  status,
  published_at,
  effective_from
)
select
  docs.id,
  'CO',
  'es-CO',
  '2026-03',
  case when docs.slug = 'terms' then 'Términos y condiciones' else 'Privacidad' end,
  case
    when docs.slug = 'terms' then $$# Términos y condiciones

Al usar DVanguard aceptas que la plataforma te ayuda a generar, editar y publicar sitios, pero tú sigues siendo responsable del contenido, la legalidad de tu actividad comercial y la información de contacto o cobro que publiques.

Los pagos de Pro pueden procesarse a través de Wompi. Los medios manuales como PSE, Nequi o transferencia compran tiempo de acceso Pro y no generan renovación automática. Las tarjetas sí pueden renovar el plan según el ciclo mensual o anual que elijas.

Nos reservamos el derecho de suspender cuentas o sitios que incumplan normas legales, usen la plataforma de forma abusiva o intenten procesar pagos con información fraudulenta.$$ 
    else $$# Privacidad

DVanguard usa tu correo, datos básicos de perfil y la información que ingresas en onboarding, editor y billing para operar la plataforma, generar propuestas visuales, gestionar accesos Pro y darte soporte.

Cuando decides pagar, ciertos datos viajan a Wompi para tokenización, validación y procesamiento del medio de pago. Si activas recordatorios de vencimiento o compras manuales, podemos enviarte correos transaccionales para avisarte sobre renovaciones o expiración del acceso Pro.

No vendemos tus datos personales. Conservamos registros operativos mínimos de pagos, membresías y eventos para auditoría, soporte y prevención de fraude.$$ 
  end,
  'published',
  now(),
  now()
from public.legal_documents docs
where docs.slug in ('terms', 'privacy')
and not exists (
  select 1
  from public.legal_document_versions existing
  where existing.document_id = docs.id
    and coalesce(existing.country_code, '') = 'CO'
    and coalesce(existing.locale_code, '') = 'es-CO'
    and existing.status = 'published'
);
