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

## Variables de entorno

Copia `.env.example` a `.env.local` y define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ROOT_DOMAIN` (ejemplo: `localhost` en local)
- `NEXT_PUBLIC_APP_URL` (ejemplo: `http://localhost:3000`)
- `AI_PROVIDER` (`mock` para fallback local)
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (si usarás proveedor real)
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
- El editor DnD libre no está implementado en esta etapa (solo editor rápido MVP).
