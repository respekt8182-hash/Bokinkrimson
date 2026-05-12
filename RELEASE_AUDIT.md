# RELEASE_AUDIT

Date: 2026-04-15

## Runtime Context

- `PROJECT_NAME`: `boking`
- `PROJECT_ROOT`: `d:\Bokinkrimson-master`
- `FRONTEND_URL`: `http://localhost:3000`
- `BACKEND_URL`: same Next.js app (`app` routes + API handlers), no separate backend service
- `START_FRONTEND_COMMAND`: `npm run dev`
- `START_BACKEND_COMMAND`: not applicable
- `START_WORKERS_COMMAND`: not applicable
- `DB_TYPE`: PostgreSQL
- `DB_CONNECTION_HINT`: `localhost:5432`, DB `boking`, user `boking`
- `TEST_USER_ACCOUNT`: no dedicated plaintext fixture found; public auth was verified by registering a fresh local user and logging in/out
- `TEST_MANAGER_ACCOUNT`: no separate manager role found in schema/routes; manager payment flow is admin-confirmed
- `TEST_ADMIN_ACCOUNT`: `ADMIN_LOGIN=admin`, password is local-only and no longer stored in plaintext in `.env.local`
- `EXTERNAL_SERVICES`: PostgreSQL, Yandex Maps, optional Upstash Redis, optional SMTP, optional S3-compatible storage

## Architecture Snapshot

- Monolith on `Next.js 16.1.6` + `React 19.2.3`
- Server/API inside App Router route handlers
- ORM: `Prisma 6.16.2`
- Tests: `Vitest` + `Playwright`
- Domains confirmed in code and DB:
  - users/auth
  - properties / rooms / media / moderation
  - excursions / tours / sessions
  - applications / reviews / favorites
  - payments / admin payment confirmations

## What Was Verified

- Local app boot:
  - `npm run dev`
  - `npm run build`
- Code/test health:
  - `npx vitest run` -> `127 passed`
  - `npm run test:e2e` -> `2 passed`, `1 skipped`
- Public routes:
  - `/`
  - `/search?direction=housing`
  - `/search?direction=excursions`
  - property card open from search
  - excursion card open from search
- Owner/admin:
  - `/dashboard`
  - `/dashboard/objects`
  - property payment page
  - `/admin/login`
  - `/admin`
- Public auth:
  - register -> `201`
  - login -> `200`
  - logout -> `200`
  - `/api/auth/me` before logout -> authenticated
  - `/api/auth/me` after logout -> `{"user":null}`
  - forgot-password request -> `200`, `PasswordResetRequest` row created
- DB snapshot during audit:
  - users: `23`
  - properties: `21`
  - excursions: `25`
  - payments: `1`
  - applications: `0`

## Fixed During Audit

### 1. Search pages were eagerly loading heavy Yandex map previews

- Severity: `high`
- Area: public housing/excursion search
- Root cause: preview `iframe` widgets loaded before explicit user intent
- Fix:
  - replaced eager map `iframe` previews with lightweight local preview CTA
  - real map now loads only after explicit open
- Verification:
  - housing search initial load: `21` requests, no Yandex map requests
  - after opening the map: `71` total requests with Yandex JS/tiles appearing only then

### 2. Legacy mock payments were still present on release paths

- Severity: `high`
- Area: property/excursion payment flows, admin payment list
- Root cause:
  - old `MOCK` provider remnants in UI/API surface
  - historical mock payments could still affect placement coverage/open-payment conflicts
- Fix:
  - removed `/api/payments/[id]/mock`
  - removed mock-specific UI branches from payment panels
  - filtered payment history/conflict checks to manager-confirmed release payments
  - placement coverage now ignores legacy `MOCK` successes
  - admin payment list no longer includes mock entries in `ALL`
- Verification:
  - full vitest green after cleanup
  - production build no longer exposes mock payment route

### 3. Test infrastructure had stale expectations and module import leakage

- Severity: `medium`
- Area: unit + e2e regression suite
- Root cause:
  - stale H1 expectations in Playwright
  - Playwright defaulted to `127.0.0.1` while app behavior aligned with `localhost`
  - several unit tests imported modules before mocks were stable
- Fix:
  - updated Playwright expectations to current UI copy
  - default Playwright base URL changed to `http://localhost:3000`
  - route/lib tests switched to fresh dynamic imports after mock setup
  - Vitest alias resolution hardened
- Verification:
  - `npx vitest run` -> `127 passed`
  - `npm run test:e2e` -> `2 passed`, `1 skipped`

### 4. Plaintext admin password was unnecessarily present in local env

- Severity: `medium`
- Area: local secret hygiene
- Root cause: unused `ADMIN_PASSWORD` remained in `.env.local`
- Fix: removed plaintext password, kept only `ADMIN_PASSWORD_HASH`
- Verification:
  - repo search found no runtime code using `ADMIN_PASSWORD`
  - admin auth code reads only hash-based config

## Remaining Blockers

### BLOCKER-1: Prisma migrations cannot be applied on local DB

- Symptom:
  - `npm run db:deploy` fails with `P3009`
  - failed migration requires ownership of tables such as `Excursion`
- Root cause:
  - application connects as `boking`
  - core tables and `_prisma_migrations` are owned by `postgres`
  - current app user lacks ownership/ALTER rights
- Impact:
  - app runs in compatibility mode
  - latest schema/security/publication columns are not physically present
  - release validation is partially constrained by fallback code paths
- Needed to close:
  - credentials for DB owner/superuser
  - or ownership transfer of project tables/migration table to deployment user

## Residual Non-Blockers

- No dedicated manager role found in schema; “manager payment flow” is currently an admin-confirmed payment path.
- `eslint` still reports existing warnings in unrelated files; there are no lint errors.
- Full user password reset was only partially verified:
  - forgot-password request creation confirmed
  - token consumption route logic exists
  - full email/token delivery chain needs real admin issuance and/or SMTP-backed delivery in target env

## Release Verdict

The codebase is materially cleaner and more release-ready than at audit start:

- app boots locally
- public search/cards work
- owner/admin core paths smoke-tested
- auth register/login/logout verified
- full `vitest` and `playwright` smoke are green
- legacy mock payment path removed from release surface

Final production release should be considered **blocked** until:

1. DB ownership/migration issue is resolved.
2. Full public reset-password completion is verified against target email delivery.
