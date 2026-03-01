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

## Variables de entorno

Copia `.env.example` a `.env.local` y define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ROOT_DOMAIN` (ejemplo: `localhost` en local)
- `NEXT_PUBLIC_APP_URL` (ejemplo: `http://localhost:3000`)
- `AI_PROVIDER` (`mock` para fallback local)
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (si usarás proveedor real)

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

Ejemplo recomendado:

```bash
npm run db:link
npm run db:dry
npm run db:push
```

### Migraciones actuales

- `supabase/migrations/0001_init.sql`

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

## Desarrollo local

```bash
npm install
npm run dev
```

Flujo recomendado:

1. Inicia sesión en `/signin`.
2. Crea un sitio en `/dashboard`.
3. Ve a `/onboarding?siteId=<id>` y genera una versión con IA.
4. Edita y publica en `/sites/<id>`.

## Seguridad

- No uses `SUPABASE_SERVICE_ROLE_KEY` en frontend ni en GitHub Actions de migraciones.
- Si cualquier clave fue expuesta (chat/captura), rótala en Supabase Dashboard.
- Mantén `.env.local` fuera de git (ya está ignorado).

## Notas importantes

- `AI_PROVIDER=mock` genera `SiteSpec` fallback sin depender de LLM externo.
- Para subdominios en local puedes usar hosts tipo `mi-sitio.localhost:3000`.
- El editor DnD libre no está implementado en esta etapa (solo editor rápido MVP).
