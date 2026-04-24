# BUGFIX_LOG

## PERF-001 Lazy map loading for public search

- Severity: `high`
- Area / route / role: public `/search?direction=housing`, `/search?direction=excursions`, guest
- Reproduce:
  1. Open search results.
  2. Inspect network immediately after first render.
- Expected:
  - map resources load only after explicit user action
- Actual before fix:
  - search page loaded Yandex map preview resources on first render
- Root cause:
  - preview `iframe` was embedded directly into result layouts
- Files changed:
  - `src/components/maps/catalog-map-preview-card.tsx`
  - `src/components/public/public-housing-results-with-map.tsx`
  - `src/components/public/excursion-search-results.tsx`
- Verified after fix:
  - housing search initial load dropped to local app/image assets only
  - Yandex map requests appear only after clicking “Открыть карту”
- Residual risk:
  - opening the map still triggers normal Yandex asset load, which is expected

## PAY-001 Legacy mock payments removed from release path

- Severity: `high`
- Area / route / role: owner payments, admin payments, release surface
- Reproduce:
  1. Inspect payment code paths for `MOCK`.
  2. Check placement coverage/open-payment conflict logic.
- Expected:
  - release logic should use only real providers
- Actual before fix:
  - mock endpoint existed
  - mock UI branches still existed
  - legacy mock payments could affect coverage/conflicts
- Root cause:
  - old test flow had not been fully isolated from production paths
- Files changed:
  - `src/app/api/properties/[id]/payments/route.ts`
  - `src/app/api/excursions/[id]/payments/route.ts`
  - `src/app/api/admin/payments/route.ts`
  - `src/lib/payments.ts`
  - `src/components/payments/property-payment-panel.tsx`
  - `src/components/payments/excursion-payment-panel.tsx`
  - `src/app/api/payments/[id]/mock/route.ts` (deleted)
  - `src/lib/payment-security.ts`
- Verified after fix:
  - full vitest green
  - build route list no longer exposes `/api/payments/[id]/mock`
  - coverage logic ignores `MOCK`
- Residual risk:
  - `MOCK` still exists in Prisma enum/history for backward compatibility until DB migrations are fully resolved

## TEST-001 Vitest/runtime drift fixed

- Severity: `medium`
- Area / route / role: test suite / CI confidence
- Reproduce:
  1. Run `npx vitest run`.
- Expected:
  - unit tests should use mocks deterministically
- Actual before fix:
  - multiple suites imported real runtime before mocks were stable
- Root cause:
  - static imports + module cache interactions
- Files changed:
  - `vitest.config.ts`
  - `tsconfig.json`
  - `tests/lib/media.test.ts`
  - `tests/unit/auth-route-db.test.ts`
  - `tests/unit/dashboard-page-db.test.ts`
  - `tests/unit/popular-properties.test.ts`
  - `tests/unit/property-documents-route.test.ts`
  - `tests/unit/restore-route.test.ts`
  - `tests/unit/review-route-security.test.ts`
  - `tests/unit/yookassa-webhook-route.test.ts`
- Verified after fix:
  - `npx vitest run` -> `127 passed`
- Residual risk:
  - none observed in current suite

## TEST-002 Playwright local origin mismatch fixed

- Severity: `medium`
- Area / route / role: e2e smoke
- Reproduce:
  1. Run `npm run test:e2e`.
- Expected:
  - smoke tests pass on local dev host
- Actual before fix:
  - property card navigation intermittently aborted
  - old H1 text expectations no longer matched UI
- Root cause:
  - outdated assertions + default `127.0.0.1` base URL drifted from app’s normal `localhost` behavior
- Files changed:
  - `playwright.config.ts`
  - `e2e/critical-flows.spec.ts`
- Verified after fix:
  - `npm run test:e2e` -> `2 passed`, `1 skipped`
- Residual risk:
  - owner->payment->moderation full E2E still requires a fuller seeded scenario

## SEC-001 Plaintext admin password removed from local env

- Severity: `medium`
- Area / route / role: local configuration / admin auth hygiene
- Reproduce:
  1. Inspect `.env.local`.
- Expected:
  - only hashed admin secret should be stored when plaintext value is not runtime-required
- Actual before fix:
  - `.env.local` contained an unused plaintext `ADMIN_PASSWORD`
- Root cause:
  - leftover convenience secret not used by runtime code
- Files changed:
  - `.env.local`
- Verified after fix:
  - code search shows runtime uses `ADMIN_PASSWORD_HASH`, not `ADMIN_PASSWORD`
- Residual risk:
  - password still exists as human knowledge outside code; rotate before real production use
