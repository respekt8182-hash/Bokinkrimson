# Boking Crimea (Stage 13 Release Prep)

Stage 13 implementation for the booking service focused on Crimea:

- Next.js + TypeScript + Tailwind (mobile-first landing and dashboard)
- Registration / login / logout / protected dashboard
- Prisma + PostgreSQL models for users, property drafts and amenities
- Owner flow for creating/editing properties (wizard steps 1-10)
- Room fund module (step 9): room CRUD, equipment, room media
- Pricing module (step 10): room prices by periods, overlap protection, stay cost preview
- Public housing catalog and property cards without authorization
- Guest applications from property card to owner dashboard (stage 8)
- Owner request management with statuses (new / in progress / closed)
- Placement payments with tariff calculation and YooKassa/mock flow (stage 9)
- Admin panel with moderation queue, object review, users/objects lists (stage 10)
- RBAC for `/admin` routes and admin moderation action log
- Separate admin workspace: isolated from owner dashboard + unread moderation badges
- Admin requests board + excursion moderation queue with approve/reject/comments
- Reviews and rating module with anti-spam limit 2 reviews per 48 hours (stage 11)
- Catalog ranking by rating with lightweight daily rotation
- Property list in dashboard with draft progress and statuses
- Yandex Maps integration for address geocoding and marker coordinates
- Media upload for properties with S3-compatible storage and limits
- Excursions module (stage 12): organizer dashboard, public catalog/cards, requests and reviews
- Stage 13 finalization: security headers + CSRF origin checks, auth rate-limit, SEO (OpenGraph, sitemap, robots), legal pages, test infrastructure and runbooks

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod + React Hook Form
- JWT session in HTTP-only cookie

## For Developers

Project map and onboarding notes: `docs/DEVELOPER_GUIDE.md`
Release/operations runbook: `docs/RELEASE_RUNBOOK.md`
Self-hosted Ubuntu VPS deploy for `krymvokrug.ru`: `docs/VPS_DEPLOY.md`

## Environment

Copy `.env.example` to `.env` and set values:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boking?schema=public"
JWT_SECRET="your-long-random-secret"
ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH="\$2b\$10\$your-bcrypt-hash"
ADMIN_JWT_SECRET="your-long-random-admin-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CSRF_TRUSTED_ORIGINS="http://192.168.1.50:3000 http://boking.local:3000"
RATE_LIMIT_MODE="auto"
SECURITY_EMAIL_DELIVERY_MODE="log"
NEXT_PUBLIC_YANDEX_MAPS_API_KEY="your-yandex-maps-key"
YANDEX_GEOCODER_API_KEY="your-yandex-geocoder-key"
S3_ENDPOINT="https://your-s3-endpoint"
S3_REGION="us-east-1"
S3_BUCKET="your-bucket"
S3_ACCESS_KEY_ID="your-key"
S3_SECRET_ACCESS_KEY="your-secret"
S3_FORCE_PATH_STYLE="true"
S3_PUBLIC_BASE_URL="https://cdn.example.com"
YOOKASSA_SHOP_ID="your-shop-id"
YOOKASSA_SECRET_KEY="your-secret-key"
YOOKASSA_RETURN_URL="http://localhost:3000/dashboard/objects"
```

`NEXT_PUBLIC_YANDEX_MAPS_API_KEY` is used by the client map widget.  
`YANDEX_GEOCODER_API_KEY` is used by backend geocoding API routes.
`CSRF_TRUSTED_ORIGINS` is optional and lets you explicitly allow extra origins for mutating `/api/*` requests, for example when testing from a phone over local network or behind a reverse proxy.
`RATE_LIMIT_MODE="memory"` is a good default for a single VPS node. Use `upstash` when you need a shared external rate-limit backend.
When you store a bcrypt hash in `.env` / `.env.local`, escape each `$` as `\$`, otherwise Next.js treats parts of the hash as variable expansion and `ADMIN_PASSWORD_HASH` may become empty at runtime.
If YooKassa variables are empty, the project still starts normally; online payments stay disabled until you configure them, while the manager payment flow remains available.
If you run multiple local projects against one PostgreSQL server, give each project its own database name (and ideally its own DB user) in `.env` to avoid mixing credentials and data.

## Run locally

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

App: `http://localhost:3000`

## Admin access

Admin login for `/admin/login` is configured through environment variables:

```bash
ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH="\$2b\$10\$your-bcrypt-hash"
ADMIN_JWT_SECRET="your-long-random-admin-secret"
```

Important: in `.env` files, escape each `$` inside the bcrypt hash as `\$`.

Owner/user accounts are created with role `USER` by default.
If you also need database-backed admin rights for legacy flows, set role `ADMIN` in PostgreSQL:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin@example.com';
```

Recommended: keep admin access as a dedicated account and do not reuse an owner account.

## Database

Apply migration when PostgreSQL is available:

```bash
npm run db:migrate
```

For staging/production deploy migrations:

```bash
npm run db:deploy
```

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run format
```

E2E smoke tests:

```bash
npm run test:e2e -- --list
npm run test:e2e
```

If Playwright browsers are not installed, run `npx playwright install`.

## Implemented routes

- `/` landing page
- `/search` public catalog
- `/auth/login`
- `/auth/register`
- `/auth/forgot-password`
- `/dashboard` (protected)
- `/dashboard/objects`
- `/dashboard/objects/[id]`
- `/dashboard/objects/[id]/payment`
- `/dashboard/requests`
- `/dashboard/excursions`
- `/dashboard/excursions/[id]`
- `/dashboard/profile`
- `/admin` (admin only)
- `/admin/moderation` (admin only)
- `/admin/moderation/[id]` (admin only)
- `/admin/moderation/excursions` (admin only)
- `/admin/moderation/excursions/[id]` (admin only)
- `/admin/objects` (admin only)
- `/admin/users` (admin only)
- `/admin/applications` (admin only)
- `/crimea/[location]/[slug]` public property card
- `/crimea/excursions/[location]/[slug]` public excursion card

## API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `GET /api/reference/locations?query=`
- `GET /api/reference/property-types`
- `GET /api/reference/amenities`
- `GET /api/reference/room-features`
- `GET /api/public/locations?query=`
- `GET /api/public/properties`
- `GET /api/public/properties/[identifier]`
- `POST /api/public/properties/[identifier]/applications`
- `GET /api/public/properties/[identifier]/reviews`
- `POST /api/public/properties/[identifier]/reviews`
- `GET /api/public/excursions`
- `GET /api/public/excursions/[identifier]`
- `POST /api/public/excursions/[identifier]/applications`
- `GET /api/public/excursions/[identifier]/reviews`
- `POST /api/public/excursions/[identifier]/reviews`
- `GET /api/properties`
- `POST /api/properties`
- `GET /api/excursions`
- `POST /api/excursions`
- `GET /api/excursions/[id]`
- `PATCH /api/excursions/[id]`
- `DELETE /api/excursions/[id]`
- `GET /api/properties/[id]`
- `PATCH /api/properties/[id]`
- `GET /api/properties/[id]/media`
- `POST /api/properties/[id]/media`
- `PATCH /api/properties/[id]/media/reorder`
- `GET /api/properties/[id]/rooms`
- `POST /api/properties/[id]/rooms`
- `GET /api/properties/[id]/rooms/[roomId]`
- `PATCH /api/properties/[id]/rooms/[roomId]`
- `DELETE /api/properties/[id]/rooms/[roomId]`
- `GET /api/properties/[id]/rooms/[roomId]/media`
- `POST /api/properties/[id]/rooms/[roomId]/media`
- `PATCH /api/properties/[id]/rooms/[roomId]/media/reorder`
- `GET /api/properties/[id]/rooms/[roomId]/prices`
- `POST /api/properties/[id]/rooms/[roomId]/prices`
- `PATCH /api/properties/[id]/rooms/[roomId]/prices/[priceId]`
- `DELETE /api/properties/[id]/rooms/[roomId]/prices/[priceId]`
- `GET /api/properties/[id]/payments/quote`
- `GET /api/properties/[id]/payments`
- `POST /api/properties/[id]/payments`
- `GET /api/applications`
- `PATCH /api/applications/[id]`
- `GET /api/payments/[id]`
- `POST /api/payments/[id]/mock`
- `POST /api/payments/yookassa/webhook`
- `GET /api/admin/moderation`
- `GET /api/admin/properties/[id]`
- `PATCH /api/admin/properties/[id]/moderation`
- `PATCH /api/admin/excursions/[id]/moderation`
- `GET /api/admin/objects`
- `GET /api/admin/users`
- `DELETE /api/admin/reviews/[id]`
- `DELETE /api/media/[mediaId]`
- `GET /api/geocode?address=...`
- `GET /api/reverse-geocode?lat=...&lng=...`
