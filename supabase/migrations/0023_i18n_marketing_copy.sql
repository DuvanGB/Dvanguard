-- ═══════════════════════════════════════════════════════════════
-- Migration 0023: i18n marketing / dashboard / nav / footer copy
-- + marketing.whatsapp_number platform setting
-- ═══════════════════════════════════════════════════════════════

-- ── Platform Setting: WhatsApp number ────────────────────────

INSERT INTO platform_settings (setting_key, country_code, locale_code, value_json, description)
VALUES ('marketing.whatsapp_number', 'CO', 'es-CO', '"573203460370"', 'WhatsApp number for marketing CTA (E.164 without +)')
ON CONFLICT DO NOTHING;

-- ── Nav / Footer copy ────────────────────────────────────────

-- es-CO
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('nav.home',           'CO', 'es-CO', 'Inicio',       'Nav link: Home'),
  ('nav.dashboard',      'CO', 'es-CO', 'Dashboard',    'Nav link: Dashboard'),
  ('nav.plans',          'CO', 'es-CO', 'Planes',       'Nav link: Plans'),
  ('nav.account',        'CO', 'es-CO', 'Cuenta',       'Mobile nav: Account'),
  ('nav.cta',            'CO', 'es-CO', 'Comenzar',     'Nav CTA button'),
  ('footer.rights',      'CO', 'es-CO', '© 2026 DVanguard Studio. Todos los derechos reservados.', 'Footer copyright'),
  ('footer.privacy',     'CO', 'es-CO', 'Política de privacidad', 'Footer privacy link'),
  ('footer.terms',       'CO', 'es-CO', 'Términos de servicio',   'Footer terms link')
ON CONFLICT DO NOTHING;

-- en (global fallback)
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('nav.home',           NULL, 'en', 'Home',        'Nav link: Home'),
  ('nav.dashboard',      NULL, 'en', 'Dashboard',   'Nav link: Dashboard'),
  ('nav.plans',          NULL, 'en', 'Plans',        'Nav link: Plans'),
  ('nav.account',        NULL, 'en', 'Account',      'Mobile nav: Account'),
  ('nav.cta',            NULL, 'en', 'Get Started',  'Nav CTA button'),
  ('footer.rights',      NULL, 'en', '© 2026 DVanguard Studio. All rights reserved.', 'Footer copyright'),
  ('footer.privacy',     NULL, 'en', 'Privacy Policy',   'Footer privacy link'),
  ('footer.terms',       NULL, 'en', 'Terms of Service', 'Footer terms link')
ON CONFLICT DO NOTHING;

-- ── Home / Marketing copy ────────────────────────────────────

-- es-CO
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('home.chip',              'CO', 'es-CO', 'IA de última generación para LATAM',                  'Hero chip text'),
  ('home.hero.title',        'CO', 'es-CO', 'Tu negocio en línea',                                 'Hero headline (line 1)'),
  ('home.hero.accent',       'CO', 'es-CO', 'en segundos',                                         'Hero headline accent'),
  ('home.hero.description',  'CO', 'es-CO', 'La plataforma de IA para el emprendedor LATAM. Habla, crea y vende por WhatsApp. Olvídate de la complejidad técnica y enfócate en crecer.', 'Hero description'),
  ('home.hero.cta_primary',  'CO', 'es-CO', 'Crear sitio gratis',                                  'Hero primary CTA'),
  ('home.hero.cta_secondary','CO', 'es-CO', 'Ver planes',                                          'Hero secondary CTA'),
  ('home.proof',             'CO', 'es-CO', '{count}+ sitios creados en Latinoamérica',             'Social proof (use {count} placeholder)'),
  ('home.preview_label',     'CO', 'es-CO', 'Vista previa',                                        'Hero preview card label'),
  ('home.wa_new_message',    'CO', 'es-CO', 'Nuevo mensaje',                                       'WA bubble: new message'),
  ('home.wa_sample',         'CO', 'es-CO', '"Hola, me interesa!"',                                'WA bubble: sample text'),
  ('home.bento.voice.title', 'CO', 'es-CO', 'Crea con tu voz',                                     'Bento card: voice title'),
  ('home.bento.voice.desc',  'CO', 'es-CO', 'No necesitas escribir código ni diseñar. Solo describe tu negocio por audio y nuestra IA se encarga de estructurar el contenido, elegir las imágenes y optimizar el sitio para vender.', 'Bento card: voice desc'),
  ('home.bento.design.title','CO', 'es-CO', 'Diseño a Medida',                                     'Bento card: design title'),
  ('home.bento.design.desc', 'CO', 'es-CO', 'Layouts curados específicamente para el mercado latinoamericano. Minimalismo que transmite confianza y profesionalismo.', 'Bento card: design desc'),
  ('home.bento.wa.title',    'CO', 'es-CO', 'Integración WhatsApp',                                'Bento card: WA title'),
  ('home.bento.wa.desc',     'CO', 'es-CO', 'Recibe todos tus pedidos y consultas directamente en tu chat. Convierte visitantes en clientes al instante.', 'Bento card: WA desc'),
  ('home.bento.analytics.title','CO','es-CO','Analítica de Datos',                                  'Bento card: analytics title'),
  ('home.bento.analytics.desc','CO','es-CO', 'Entiende quién visita tu sitio y qué productos les interesan más con nuestro panel simplificado.', 'Bento card: analytics desc'),
  ('home.trust.title',       'CO', 'es-CO', 'Impulsando el ecosistema LATAM',                      'Trust section heading'),
  ('home.testimonial.text',  'CO', 'es-CO', 'DVanguard cambió la forma en que mi estudio de arquitectura se presenta al mundo. Creamos el portafolio en una tarde usando solo notas de voz.', 'Testimonial quote'),
  ('home.testimonial.author','CO', 'es-CO', 'Alex Vanguard',                                       'Testimonial author'),
  ('home.testimonial.role',  'CO', 'es-CO', 'Lead Designer, Premium Tier',                         'Testimonial role'),
  ('home.value1.title',      'CO', 'es-CO', 'Hecho para WhatsApp commerce',                        'Value card 1 title'),
  ('home.value1.desc',       'CO', 'es-CO', 'CTA priorizado, mensajes claros y experiencia móvil para convertir tráfico social en conversaciones.', 'Value card 1 desc'),
  ('home.value2.title',      'CO', 'es-CO', 'Flujo simple sin curva técnica',                      'Value card 2 title'),
  ('home.value2.desc',       'CO', 'es-CO', 'Sin constructor tradicional abrumador. Decisiones guiadas, edición rápida y versionado estable.', 'Value card 2 desc'),
  ('home.value3.title',      'CO', 'es-CO', 'Control del negocio desde dashboard',                 'Value card 3 title'),
  ('home.value3.desc',       'CO', 'es-CO', 'Ves uso, analítica básica y estado de publicación de cada sitio desde un solo lugar.', 'Value card 3 desc'),
  ('home.cta.title',         'CO', 'es-CO', '¿Listo para liderar el mercado digital?',             'CTA banner title'),
  ('home.cta.desc',          'CO', 'es-CO', 'Únete a la vanguardia tecnológica y lanza tu sitio hoy mismo.', 'CTA banner desc'),
  ('home.cta.button',        'CO', 'es-CO', 'Empezar Ahora — Es Gratis',                          'CTA banner button')
ON CONFLICT DO NOTHING;

-- en (global fallback)
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('home.chip',              NULL, 'en', 'Next-gen AI for your business',                           'Hero chip text'),
  ('home.hero.title',        NULL, 'en', 'Your business online',                                    'Hero headline (line 1)'),
  ('home.hero.accent',       NULL, 'en', 'in seconds',                                              'Hero headline accent'),
  ('home.hero.description',  NULL, 'en', 'The AI platform for entrepreneurs. Speak, create and sell via WhatsApp. Forget technical complexity and focus on growing.', 'Hero description'),
  ('home.hero.cta_primary',  NULL, 'en', 'Create free site',                                        'Hero primary CTA'),
  ('home.hero.cta_secondary',NULL, 'en', 'View plans',                                              'Hero secondary CTA'),
  ('home.proof',             NULL, 'en', '{count}+ sites created in Latin America',                  'Social proof (use {count} placeholder)'),
  ('home.preview_label',     NULL, 'en', 'Preview Mode',                                            'Hero preview card label'),
  ('home.wa_new_message',    NULL, 'en', 'New message',                                              'WA bubble: new message'),
  ('home.wa_sample',         NULL, 'en', '"Hi, I''m interested!"',                                   'WA bubble: sample text'),
  ('home.bento.voice.title', NULL, 'en', 'Create with your voice',                                   'Bento card: voice title'),
  ('home.bento.voice.desc',  NULL, 'en', 'No coding or design needed. Just describe your business by voice and our AI structures the content, picks images and optimises the site to sell.', 'Bento card: voice desc'),
  ('home.bento.design.title',NULL, 'en', 'Custom Design',                                            'Bento card: design title'),
  ('home.bento.design.desc', NULL, 'en', 'Layouts curated specifically for the Latin American market. Minimalism that conveys trust and professionalism.', 'Bento card: design desc'),
  ('home.bento.wa.title',    NULL, 'en', 'WhatsApp Integration',                                     'Bento card: WA title'),
  ('home.bento.wa.desc',     NULL, 'en', 'Receive all your orders and enquiries directly in your chat. Convert visitors into customers instantly.', 'Bento card: WA desc'),
  ('home.bento.analytics.title',NULL,'en','Data Analytics',                                           'Bento card: analytics title'),
  ('home.bento.analytics.desc',NULL,'en', 'Understand who visits your site and which products interest them most with our simplified dashboard.', 'Bento card: analytics desc'),
  ('home.trust.title',       NULL, 'en', 'Powering the LATAM ecosystem',                             'Trust section heading'),
  ('home.testimonial.text',  NULL, 'en', 'DVanguard changed the way my architecture studio presents itself to the world. We created the portfolio in an afternoon using only voice notes.', 'Testimonial quote'),
  ('home.testimonial.author',NULL, 'en', 'Alex Vanguard',                                            'Testimonial author'),
  ('home.testimonial.role',  NULL, 'en', 'Lead Designer, Premium Tier',                              'Testimonial role'),
  ('home.value1.title',      NULL, 'en', 'Built for WhatsApp commerce',                              'Value card 1 title'),
  ('home.value1.desc',       NULL, 'en', 'Prioritised CTAs, clear messaging and mobile experience to convert social traffic into conversations.', 'Value card 1 desc'),
  ('home.value2.title',      NULL, 'en', 'Simple flow, no learning curve',                           'Value card 2 title'),
  ('home.value2.desc',       NULL, 'en', 'No overwhelming traditional builder. Guided decisions, fast editing and stable versioning.', 'Value card 2 desc'),
  ('home.value3.title',      NULL, 'en', 'Business control from your dashboard',                     'Value card 3 title'),
  ('home.value3.desc',       NULL, 'en', 'See usage, basic analytics and publication status for each site from one place.', 'Value card 3 desc'),
  ('home.cta.title',         NULL, 'en', 'Ready to lead the digital market?',                        'CTA banner title'),
  ('home.cta.desc',          NULL, 'en', 'Join the technological vanguard and launch your site today.', 'CTA banner desc'),
  ('home.cta.button',        NULL, 'en', 'Start Now — It''s Free',                                   'CTA banner button')
ON CONFLICT DO NOTHING;

-- ── Dashboard copy ───────────────────────────────────────────

-- es-CO
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('dash.chip',              'CO', 'es-CO', 'Workspace cliente',                                     'Dashboard hero chip'),
  ('dash.hero.title',        'CO', 'es-CO', 'Tu centro de sitios y activación',                      'Dashboard hero title'),
  ('dash.hero.desc',         'CO', 'es-CO', 'Gestiona contenido, publicación y rendimiento de tus sitios desde un panel profesional.', 'Dashboard hero desc'),
  ('dash.cta.regenerate',    'CO', 'es-CO', 'Regenerar con IA',                                      'Dashboard: regenerate CTA'),
  ('dash.cta.billing',       'CO', 'es-CO', 'Facturación',                                           'Dashboard: billing link'),
  ('dash.cta.trash',         'CO', 'es-CO', 'Papelera',                                              'Dashboard: trash link'),
  ('dash.kpi.plan',          'CO', 'es-CO', 'Plan actual',                                           'KPI: current plan'),
  ('dash.kpi.plan_free',     'CO', 'es-CO', 'Ideal para validar rápido',                             'KPI: free plan desc'),
  ('dash.kpi.plan_pro',      'CO', 'es-CO', 'Mayor capacidad de crecimiento',                        'KPI: pro plan desc'),
  ('dash.kpi.ai',            'CO', 'es-CO', 'Generaciones IA (mes)',                                 'KPI: AI generations'),
  ('dash.kpi.ai_remaining',  'CO', 'es-CO', 'Restantes',                                             'KPI: remaining'),
  ('dash.kpi.published',     'CO', 'es-CO', 'Sitios publicados',                                     'KPI: published sites'),
  ('dash.kpi.available',     'CO', 'es-CO', 'Disponibles',                                           'KPI: available'),
  ('dash.kpi.visits',        'CO', 'es-CO', 'Visitas (7d)',                                           'KPI: visits'),
  ('dash.kpi.visits_desc',   'CO', 'es-CO', 'Interacciones recientes',                               'KPI: visits desc'),
  ('dash.kpi.wa_clicks',     'CO', 'es-CO', 'Clic WhatsApp (7d)',                                    'KPI: WA clicks'),
  ('dash.kpi.wa_desc',       'CO', 'es-CO', 'Conversaciones iniciadas',                              'KPI: WA desc'),
  ('dash.kpi.ctr',           'CO', 'es-CO', 'CTR WhatsApp (7d)',                                     'KPI: CTR'),
  ('dash.kpi.ctr_desc',      'CO', 'es-CO', 'Conversión sobre visitas',                              'KPI: CTR desc'),
  ('dash.create.title',      'CO', 'es-CO', 'Crear nuevo sitio',                                     'Create panel title'),
  ('dash.create.desc',       'CO', 'es-CO', 'Inicia un proyecto nuevo y pasa directo al onboarding para generar tu primera versión con IA.', 'Create panel desc'),
  ('dash.sites.title',       'CO', 'es-CO', 'Tus sitios',                                            'Sites section title'),
  ('dash.sites.count',       'CO', 'es-CO', 'activos en tu workspace',                               'Sites count suffix'),
  ('dash.sites.edit',        'CO', 'es-CO', 'Editar',                                                'Site action: edit'),
  ('dash.sites.regenerate',  'CO', 'es-CO', 'Regenerar IA',                                          'Site action: regenerate'),
  ('dash.sites.open',        'CO', 'es-CO', 'Abrir sitio',                                           'Site action: open site'),
  ('dash.empty.title',       'CO', 'es-CO', 'Aún no tienes sitios creados',                          'Empty state title'),
  ('dash.empty.desc',        'CO', 'es-CO', 'Crea tu primer sitio y publícalo hoy para empezar a recibir tráfico desde redes.', 'Empty state desc'),
  ('dash.signout',           'CO', 'es-CO', 'Cerrar sesión',                                         'Sign-out button'),
  ('dash.signout_loading',   'CO', 'es-CO', 'Cerrando…',                                             'Sign-out loading'),
  ('dash.ia_promo.label',    'CO', 'es-CO', 'Herramienta Premium',                                   'IA promo label'),
  ('dash.ia_promo.title',    'CO', 'es-CO', 'Optimiza con IA',                                       'IA promo title'),
  ('dash.ia_promo.desc',     'CO', 'es-CO', 'Deja que nuestra inteligencia artificial reestructure tu contenido para máxima conversión y elegancia profesional.', 'IA promo desc'),
  ('dash.ia_promo.cta',      'CO', 'es-CO', 'Iniciar auditoría',                                     'IA promo CTA'),
  ('dash.hero.greeting',     'CO', 'es-CO', 'Bienvenido de vuelta',                                  'Dashboard greeting'),
  ('dash.hero.headline',     'CO', 'es-CO', 'Lanza tu próxima visión.',                               'Dashboard headline accent'),
  ('dash.kpi.section',       'CO', 'es-CO', 'Rendimiento',                                           'KPI section title'),
  ('dash.kpi.period',        'CO', 'es-CO', 'Últimos 7 días',                                        'KPI period label'),
  ('dash.kpi.activation',    'CO', 'es-CO', 'Activación',                                            'KPI: activation'),
  ('dash.sites.manage',      'CO', 'es-CO', 'Gestionar',                                             'Site action: manage'),
  ('dash.sites.continue',    'CO', 'es-CO', 'Continuar',                                             'Site action: continue'),
  ('dash.checklist.title',   'CO', 'es-CO', 'Lista de activación',                                   'Checklist section title')
ON CONFLICT DO NOTHING;

-- en (global fallback)
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('dash.chip',              NULL, 'en', 'Client workspace',                                          'Dashboard hero chip'),
  ('dash.hero.title',        NULL, 'en', 'Your site hub & activation centre',                         'Dashboard hero title'),
  ('dash.hero.desc',         NULL, 'en', 'Manage content, publishing and performance from a professional dashboard.', 'Dashboard hero desc'),
  ('dash.cta.regenerate',    NULL, 'en', 'Regenerate with AI',                                        'Dashboard: regenerate CTA'),
  ('dash.cta.billing',       NULL, 'en', 'Billing',                                                   'Dashboard: billing link'),
  ('dash.cta.trash',         NULL, 'en', 'Trash',                                                     'Dashboard: trash link'),
  ('dash.kpi.plan',          NULL, 'en', 'Current plan',                                               'KPI: current plan'),
  ('dash.kpi.plan_free',     NULL, 'en', 'Great for quick validation',                                 'KPI: free plan desc'),
  ('dash.kpi.plan_pro',      NULL, 'en', 'More room to grow',                                         'KPI: pro plan desc'),
  ('dash.kpi.ai',            NULL, 'en', 'AI generations (month)',                                     'KPI: AI generations'),
  ('dash.kpi.ai_remaining',  NULL, 'en', 'Remaining',                                                 'KPI: remaining'),
  ('dash.kpi.published',     NULL, 'en', 'Published sites',                                            'KPI: published sites'),
  ('dash.kpi.available',     NULL, 'en', 'Available',                                                  'KPI: available'),
  ('dash.kpi.visits',        NULL, 'en', 'Visits (7d)',                                                'KPI: visits'),
  ('dash.kpi.visits_desc',   NULL, 'en', 'Recent interactions',                                        'KPI: visits desc'),
  ('dash.kpi.wa_clicks',     NULL, 'en', 'WhatsApp clicks (7d)',                                       'KPI: WA clicks'),
  ('dash.kpi.wa_desc',       NULL, 'en', 'Conversations started',                                     'KPI: WA desc'),
  ('dash.kpi.ctr',           NULL, 'en', 'WhatsApp CTR (7d)',                                          'KPI: CTR'),
  ('dash.kpi.ctr_desc',      NULL, 'en', 'Conversion over visits',                                    'KPI: CTR desc'),
  ('dash.create.title',      NULL, 'en', 'Create new site',                                            'Create panel title'),
  ('dash.create.desc',       NULL, 'en', 'Start a new project and go straight to onboarding to generate your first version with AI.', 'Create panel desc'),
  ('dash.sites.title',       NULL, 'en', 'Your sites',                                                 'Sites section title'),
  ('dash.sites.count',       NULL, 'en', 'active in your workspace',                                   'Sites count suffix'),
  ('dash.sites.edit',        NULL, 'en', 'Edit',                                                       'Site action: edit'),
  ('dash.sites.regenerate',  NULL, 'en', 'Regenerate AI',                                              'Site action: regenerate'),
  ('dash.sites.open',        NULL, 'en', 'Open site',                                                  'Site action: open site'),
  ('dash.empty.title',       NULL, 'en', 'You don''t have any sites yet',                              'Empty state title'),
  ('dash.empty.desc',        NULL, 'en', 'Create your first site and publish it today to start getting traffic from social media.', 'Empty state desc'),
  ('dash.signout',           NULL, 'en', 'Sign out',                                                   'Sign-out button'),
  ('dash.signout_loading',   NULL, 'en', 'Signing out…',                                               'Sign-out loading'),
  ('dash.ia_promo.label',    NULL, 'en', 'Premium Tool',                                               'IA promo label'),
  ('dash.ia_promo.title',    NULL, 'en', 'Optimize with AI',                                           'IA promo title'),
  ('dash.ia_promo.desc',     NULL, 'en', 'Let our artificial intelligence restructure your content for maximum conversion and professional elegance.', 'IA promo desc'),
  ('dash.ia_promo.cta',      NULL, 'en', 'Start audit',                                                'IA promo CTA'),
  ('dash.hero.greeting',     NULL, 'en', 'Welcome back',                                               'Dashboard greeting'),
  ('dash.hero.headline',     NULL, 'en', 'Launch your next vision.',                                   'Dashboard headline accent'),
  ('dash.kpi.section',       NULL, 'en', 'Performance',                                                'KPI section title'),
  ('dash.kpi.period',        NULL, 'en', 'Last 7 days',                                                'KPI period label'),
  ('dash.kpi.activation',    NULL, 'en', 'Activation',                                                 'KPI: activation'),
  ('dash.sites.manage',      NULL, 'en', 'Manage',                                                     'Site action: manage'),
  ('dash.sites.continue',    NULL, 'en', 'Continue',                                                   'Site action: continue'),
  ('dash.checklist.title',   NULL, 'en', 'Launch Checklist',                                           'Checklist section title')
ON CONFLICT DO NOTHING;

-- ── Onboarding copy ──────────────────────────────────────────

-- es-CO
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('onboarding.title',       'CO', 'es-CO', 'Onboarding IA',                                         'Onboarding page title'),
  ('onboarding.site_label',  'CO', 'es-CO', 'Sitio',                                                 'Onboarding: site label'),
  ('onboarding.no_sites',    'CO', 'es-CO', 'No tienes sitios creados todavía. Crea uno para iniciar este flujo.', 'No sites message'),
  ('onboarding.not_found',   'CO', 'es-CO', 'No se encontró el sitio solicitado.',                    'Site not found'),
  ('onboarding.go_dashboard','CO', 'es-CO', 'Ir al dashboard',                                        'Go to dashboard link')
ON CONFLICT DO NOTHING;

-- en
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('onboarding.title',       NULL, 'en', 'AI Onboarding',                                             'Onboarding page title'),
  ('onboarding.site_label',  NULL, 'en', 'Site',                                                      'Onboarding: site label'),
  ('onboarding.no_sites',    NULL, 'en', 'You don''t have any sites yet. Create one to start this flow.', 'No sites message'),
  ('onboarding.not_found',   NULL, 'en', 'The requested site was not found.',                          'Site not found'),
  ('onboarding.go_dashboard',NULL, 'en', 'Go to dashboard',                                            'Go to dashboard link')
ON CONFLICT DO NOTHING;

-- ── Pricing extra copy ───────────────────────────────────────

-- es-CO
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('pricing.free_label',     'CO', 'es-CO', 'Sin costo',            'Free plan price label'),
  ('pricing.per_month',      'CO', 'es-CO', '/ mes',                'Price suffix: per month'),
  ('pricing.per_year',       'CO', 'es-CO', '/ año',                'Price suffix: per year'),
  ('pricing.cta_pro',        'CO', 'es-CO', 'Suscribirme',          'Pro plan CTA'),
  ('pricing.cta_free',       'CO', 'es-CO', 'Comenzar gratis',      'Free plan CTA')
ON CONFLICT DO NOTHING;

-- en
INSERT INTO platform_copy_entries (entry_key, country_code, locale_code, value_text, description) VALUES
  ('pricing.free_label',     NULL, 'en', 'Free',                    'Free plan price label'),
  ('pricing.per_month',      NULL, 'en', '/ month',                 'Price suffix: per month'),
  ('pricing.per_year',       NULL, 'en', '/ year',                  'Price suffix: per year'),
  ('pricing.cta_pro',        NULL, 'en', 'Subscribe',               'Pro plan CTA'),
  ('pricing.cta_free',       NULL, 'en', 'Start free',              'Free plan CTA')
ON CONFLICT DO NOTHING;
