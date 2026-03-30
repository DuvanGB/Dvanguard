with upsert_docs as (
  insert into public.legal_documents (slug, title, description)
  values
    ('terms', 'Términos y condiciones', 'Documento legal principal de términos y condiciones.'),
    ('privacy', 'Privacidad', 'Documento legal principal de privacidad.')
  on conflict (slug) do update
  set
    title = excluded.title,
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
