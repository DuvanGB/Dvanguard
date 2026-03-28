# DVanguard MVP (Etapa 1)

MVP SaaS multi-tenant para generar sitios web desde una descripción de negocio, guardarlos por versiones y publicarlos por subdominio.

## Stack

- Next.js (App Router + TypeScript)
- Supabase (Auth + Postgres + RLS)
- Zod (contrato `SiteSpec`)
- Vercel-ready middleware para subdominios

## Funcionalidades implementadas

- Auth por magic link (Supabase)
- Multi-tenant con `owner_id` + RLS
- Motor IA por job (`ai_jobs`) con timeout y fallback
- Contrato estricto `SiteSpec v1.0`
- Render dinámico por componentes (`hero`, `catalog`, `testimonials`, `contact`)
- Dashboard mínimo con creación de sitio
- Onboarding de texto para generación IA
- Editor MVP (paleta, título hero, toggles de sección)
- Versionado (`site_versions`) y publicación (`site_publications`)
- Resolución de sitio por subdominio en `middleware.ts`
- API pública para resolver tenant por host
- Módulo admin interno (`/admin`) con:
  - métricas operativas (7d)
  - listados de usuarios/sitios/jobs IA
  - reintento de jobs IA fallidos
- Fase 3 de conversión SaaS:
  - landing comercial + `/pricing`
  - planes `free/pro` con límites
  - solicitud manual de upgrade Pro
  - métricas de activación (`% publicación <24h`)
- Fase 4 de onboarding con voz + refinamiento:
  - wizard de 3 pasos en `/onboarding`
  - captura por texto/voz (Web Speech API) con fallback a texto
  - refinamiento de brief antes de generar
  - métricas de calidad percibida del primer resultado
- Fase 5 motor visual v2:
  - `SiteSpec v2.0` tipado + parser unificado con compat v1
  - catálogo de 6 plantillas + recomendación IA
  - selección de plantilla en onboarding antes de generar
  - editor visual v2 (contenido, variantes, tema, reorder/toggle)
  - migración lazy v1 -> v2 al abrir onboarding/editor
- Fase 6 dashboard pro + canvas realtime:
  - editor canva-lite con DnD por secciones
  - autosave debounce + dedupe de versiones
  - media manager (upload Supabase Storage + URL externa)
  - tracking público de visitas y clics de conversión
  - dashboard cliente/admin con métricas de tráfico
- Fase 7 reset-first:
  - contrato único `SiteSpec v3.0` (sin compat v1/v2)
  - onboarding con generación híbrida bloqueada (seed determinista + enriquecimiento IA opcional)
  - editor canvas interactivo por bloques (selección directa, drag, resize, inspector)
  - endpoints de canvas para operaciones por bloque
  - reset global de datos de producto + limpieza de assets

## Variables de entorno

Copia `.env.example` a `.env.local` y define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ROOT_DOMAIN` (ejemplo: `localhost` en local)
- `NEXT_PUBLIC_APP_URL` (ejemplo: `http://localhost:3000`)
- `AI_PROVIDER` (`mock` para fallback local)
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (si usarás proveedor real)
- `ONBOARDING_REFINE_PROVIDER` (`llm` o `heuristic`)
- `VOICE_LOCALE` (default `es-CO`)
- `ONBOARDING_MAX_INPUT_CHARS` (default `3000`)
- `ADMIN_ALLOWLIST_EMAILS` (CSV de emails autorizados para `/admin`)
- `DEFAULT_FREE_PLAN` (default: `free`)
- `DEFAULT_PRO_PLAN` (default: `pro`)

## Workflow de DB con migraciones automáticas

### One-time bootstrap local

1. Instala Supabase CLI (macOS):

```bash
brew install supabase/tap/supabase
```

2. Inicia sesión con token personal (Dashboard -> Account -> Access Tokens):

```bash
supabase login
```

3. Copia `.env.example` -> `.env.local` y completa:

- `SUPABASE_PROJECT_REF` (por defecto: `gitpunhpgdymgyatyxdq`)
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_ACCESS_TOKEN` (solo para CLI/CI)

4. Enlaza el repo al proyecto remoto:

```bash
npm run db:link
```

### Comandos operativos

- `npm run db:list`: lista migraciones local/remoto.
- `npm run db:dry`: valida migraciones pendientes sin aplicar.
- `npm run db:push`: aplica migraciones pendientes al proyecto enlazado.
- `npm run dev`: ejecuta `db:push` automáticamente antes de levantar Next.js.
- `SKIP_DB_PUSH_ON_DEV=1 npm run dev`: levanta Next.js sin aplicar migraciones (escape hatch).
- `npm run dev:no-db`: alternativa directa para levantar Next.js sin migraciones.

Ejemplo recomendado:

```bash
npm run db:link
npm run db:dry
npm run db:push
```

### Migraciones actuales

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_profiles_insert_and_backfill.sql`
- `supabase/migrations/0003_admin_retry_and_metrics.sql`
- `supabase/migrations/0004_plans_usage_and_requests.sql`
- `supabase/migrations/0005_onboarding_quality_metrics.sql`
- `supabase/migrations/0006_site_versions_source_v2.sql`
- `supabase/migrations/0007_media_assets_and_storage_support.sql`
- `supabase/migrations/0008_public_site_analytics.sql`
- `supabase/migrations/0009_site_versions_autosave_source_and_hash.sql`
- `supabase/migrations/0010_reset_and_prepare_v3.sql`
- `supabase/migrations/0011_site_versions_v3_constraints.sql`
- `supabase/migrations/0012_canvas_block_ops.sql`
- `supabase/migrations/0013_recreate_site_assets_bucket.sql`

Incluye tablas:

- `profiles`
- `sites`
- `site_versions`
- `site_publications`
- `ai_jobs`
- `events`

Y políticas RLS para aislamiento multi-tenant.

### Verificación rápida en Supabase SQL Editor

```sql
select to_regclass('public.sites');
```

Debe devolver `public.sites`.

## CI/CD de migraciones (GitHub Actions)

Workflow: `.github/workflows/supabase-migrations.yml`

- `pull_request` con cambios en `supabase/migrations/**`: ejecuta `db push --dry-run`.
- `push` a `main` con cambios en `supabase/migrations/**`: ejecuta `db push --yes`.

Configura estos secrets en GitHub:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF` (valor: `gitpunhpgdymgyatyxdq`)

## Endpoints iniciales

- `POST /api/sites`
- `POST /api/ai/generate`
- `GET /api/ai/jobs/:id`
- `POST /api/sites/:id/versions`
- `POST /api/sites/:id/publish`
- `GET /api/public/site-by-host`
- `GET /api/admin/metrics?range=7d`
- `GET /api/admin/users?search=&page=&pageSize=`
- `GET /api/admin/sites?status=&type=&owner=&page=&pageSize=`
- `GET /api/admin/ai-jobs?status=&siteId=&userId=&from=&to=&page=&pageSize=`
- `POST /api/admin/ai-jobs/:id/retry`
- `GET /api/account/usage`
- `POST /api/account/pro-request`
- `GET /api/admin/pro-requests?status=&page=&pageSize=`
- `POST /api/admin/pro-requests/:id/review`
- `POST /api/admin/users/:id/plan`
- `POST /api/onboarding/refine`
- `POST /api/onboarding/generate`
- `POST /api/onboarding/generate-v3`
- `GET /api/templates?siteType=informative|commerce_lite`
- `GET /api/sites/:id/assets`
- `POST /api/sites/:id/assets/upload`
- `POST /api/sites/:id/assets/external`
- `DELETE /api/sites/:id/assets/:assetId`
- `GET /api/sites/:id/canvas`
- `POST /api/sites/:id/canvas/block`
- `PATCH /api/sites/:id/canvas/block/:blockId`
- `DELETE /api/sites/:id/canvas/block/:blockId`
- `POST /api/sites/:id/canvas/reorder`
- `POST /api/sites/:id/canvas/viewport-override`
- `POST /api/public/track`
- `GET /api/dashboard/analytics?siteId=&range=7d|30d`
- `GET /api/admin/traffic-metrics?range=7d|30d`
- `GET /api/sites/:id/domains`
- `POST /api/sites/:id/domains`
- `POST /api/sites/:id/domains/:domainId/verify`
- `PATCH /api/sites/:id/domains/:domainId/primary`
- `DELETE /api/sites/:id/domains/:domainId`

## Desarrollo local

```bash
npm install
npm run dev
```

Nota: desde esta fase, `npm run dev` intenta sincronizar migraciones automáticamente con Supabase remoto antes de iniciar la app.

Flujo recomendado:

1. Inicia sesión en `/signin`.
2. Crea un sitio en `/dashboard`.
3. Ve a `/onboarding?siteId=<id>` y genera una versión con IA.
4. Edita y publica en `/sites/<id>`.

## Publicación pública

- El modo canónico actual es `path mode`: `/public-sites/<slug>`.
- Ejemplo local: `http://localhost:3000/public-sites/mi-sitio`
- Ejemplo Vercel: `https://dvanguard.vercel.app/public-sites/mi-sitio`
- Si un cliente conecta dominio propio y queda activo, la URL pública efectiva pasa a ser ese dominio, manteniendo path mode como fallback.

## Conversión SaaS (fase 3)

### Planes actuales

- `free`: 1 sitio publicado activo + 10 generaciones IA por mes.
- `pro`: cupos ampliados (asignación manual por admin).

### Flujo de upgrade Pro

1. Usuario llega al límite en dashboard.
2. Solicita Pro desde botón `Solicitar Pro`.
3. Admin revisa en `/admin/pro-requests`.
4. Admin aprueba/rechaza o cambia plan desde `/admin/users`.

### Métricas de activación (admin)

- `% publicación en 24h`.
- límites de plan alcanzados (IA/publicación).
- estado de solicitudes Pro (pending/approved/rejected).

## Voz y onboarding IA (fase 4)

### Flujo nuevo

1. Usuario describe su negocio por texto o voz.
2. Backend devuelve `briefDraft` refinado.
3. Usuario ajusta campos clave (tipo, oferta, tono, secciones, preset).
4. Se dispara generación IA usando prompt construido desde brief.

### Eventos operativos nuevos

- `onboarding.refine.started`
- `onboarding.refine.completed`
- `onboarding.voice.unsupported`
- `onboarding.voice.permission_denied`
- `site.generation.first_attempt_done`
- `site.generation.regenerated`
- `site.first_result.accepted`

### Métricas admin nuevas

- `First result acceptance (7d)`
- `Voice usage rate (7d)`
- `Refine fallback rate (7d)`
- `Regeneraciones p50/p95`

## Motor visual v3 (fase 7)

### Flujo visual nuevo

1. Usuario refina brief en onboarding.
2. Sistema sugiere plantillas y el usuario selecciona una.
3. Generación usa seed determinista + enriquecimiento IA opcional (`hybrid_locked`).
4. Editor canvas permite:
   - selección directa de bloques sobre preview
   - drag/resize
   - edición de contenido/estilo por inspector
   - overrides mobile/desktop
   - integración con librería de media

### Compatibilidad

- Fase 7 elimina compatibilidad legacy: solo se acepta `SiteSpec v3.0`.
- El reset de datos deja el proyecto en ciclo nuevo.

### Eventos y métricas v3

- Eventos:
  - `template.recommended`
  - `template.selected`
  - `onboarding.brief.locked_compiled`
  - `generation.patch.applied`
  - `editor.canvas.element.updated`
  - `editor.content.saved`
  - `site.v3.first_result.accepted`
- KPIs admin añadidos:
  - `% plantilla recomendada elegida`
  - `% aceptación primer resultado v2`
  - `regeneración promedio por template`
  - `top templates por publicación`

## Operación admin (fase 2)

1. Define admins en `.env.local`:

```env
ADMIN_ALLOWLIST_EMAILS=tu-correo@dominio.com,otro-admin@dominio.com
```

2. Reinicia `npm run dev`.
3. Accede a `/admin` con un correo de la allowlist.
4. Usa:
   - `/admin/users` para soporte de cuentas
   - `/admin/sites` para estado de sitios
   - `/admin/ai-jobs` para diagnóstico y retry de fallos IA

## Seguridad

- No uses `SUPABASE_SERVICE_ROLE_KEY` en frontend ni en GitHub Actions de migraciones.
- `SUPABASE_SERVICE_ROLE_KEY` debe ser `service_role`/`sb_secret`, no `sb_publishable`.
- Si cualquier clave fue expuesta (chat/captura), rótala en Supabase Dashboard.
- Mantén `.env.local` fuera de git (ya está ignorado).
- Si alguna vez quedó trackeado, ejecútalo una vez: `git rm --cached .env.local`.

## Notas importantes

- `AI_PROVIDER=mock` genera `SiteSpec` fallback sin depender de LLM externo.
- Para subdominios en local puedes usar hosts tipo `mi-sitio.localhost:3000`.
- El editor DnD libre no está implementado en esta etapa (editor visual v2 sin drag & drop libre).

## Reset-First (fase 7)

Se ejecutó reset global de datos de producto en Supabase remoto con migraciones `0010-0013`.

- Backup operativo guardado en `ops/backups/<timestamp>/`.
- Si no hay Docker disponible, se usa snapshot por tablas vía `supabase-js` + snapshot de esquema desde `supabase/migrations`.
- El bucket `site-assets` se limpia por Storage API (`supabase --experimental storage rm -r`) y luego se recrea por migración.

## Canvas Realtime + Media + Traffic (fase 6)

### Editor canva-lite

- DnD por secciones (`hero`, `catalog`, `testimonials`, `contact`).
- Autosave cada ~2.5s con estado visual de guardado.
- Checkpoint manual y publicación sobre versión exacta persistida.

### Media manager

- Subida de imágenes a bucket `site-assets`.
- Registro de URL externa.
- Librería de assets por sitio para reutilizar imágenes en hero/catálogo.

### Tracking público

- Eventos:
  - `visit`
  - `whatsapp_click`
  - `cta_click`
- Dashboard cliente/admin con agregados 7d/30d y CTR de WhatsApp.
