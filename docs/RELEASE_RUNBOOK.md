# Release Runbook (Stage 13)

## 1) Prerequisites

- Node.js LTS + npm
- PostgreSQL (prod/staging)
- S3-compatible storage
- Domain + SSL certificate
- For single-node VPS deploy with Docker/Caddy see `docs/VPS_DEPLOY.md`

## 2) Required env variables

Use `.env.example` as baseline and set production secrets:

- `DATABASE_URL`
- `JWT_SECRET` (strong random secret)
- `NEXT_PUBLIC_APP_URL` (public HTTPS domain)
- `S3_*` variables
- `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`
- `YANDEX_GEOCODER_API_KEY`

## 3) Release checklist

1. Install dependencies:
   `npm ci`
2. Generate Prisma client:
   `npx prisma generate --no-engine`
3. Apply migrations:
   `npm run db:deploy`
4. Validate code quality:
   `npm run lint`
   `npm run test`
   `npm run build`
5. Start service:
   `npm run start`

## 4) Update procedure

1. Pull release commit/tag.
2. Run `npm ci` or rebuild the Docker image.
3. Run `npm run db:deploy`.
4. Run `npm run build` or `docker compose -f compose.prod.yml up -d --build`.
5. Restart process manager (PM2/systemd/container rollout).
6. Verify smoke checks:
   `/`
   `/search?direction=housing`
   `/search?direction=excursions`
   `/robots.txt`
   `/sitemap.xml`
   `/api/health`

## 5) Rollback procedure

1. Switch application to previous stable release/tag.
2. Reinstall dependencies and restart app.
3. If rollback requires DB rollback, use pre-created SQL rollback scripts or point-in-time recovery.
4. Validate core routes and auth.

## 6) Backup policy (minimum)

- PostgreSQL:
  - Daily full backup
  - WAL/PITR enabled (recommended)
  - Retention: at least 14 days
- S3 media:
  - Bucket versioning ON
  - Lifecycle policy + periodic export/snapshot
  - Retention aligned with DB backup window

## 7) Monitoring and observability

- Application logs:
  - API errors logged with timestamp/context
  - Centralized log aggregation recommended (Loki/ELK/Cloud logs)
- Error monitoring:
  - Integrate Sentry (or equivalent) for frontend + backend exception tracking
- Performance:
  - Monitor latency for search/catalog and media endpoints
  - Monitor DB load and slow queries

## 8) Security baseline

- HTTP-only session cookie + `sameSite=lax`
- Security headers applied via `src/proxy.ts`
- Same-origin CSRF guard for mutating `/api/*` requests
- Rate-limit on auth endpoints (login/register/forgot-password)
- File validation on media uploads (type + size + count limits)

## 9) Known operational notes

- `npm run db:generate` on Windows may fail with `EPERM` on Prisma DLL while process is locked.
  Use `npx prisma generate --no-engine` or stop running Node processes and retry.
- Playwright browser download may be restricted by network geo/policy.
  In that case run only list mode: `npm run test:e2e -- --list`.
