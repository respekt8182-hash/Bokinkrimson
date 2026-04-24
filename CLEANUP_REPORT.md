# CLEANUP_REPORT

## Removed

- legacy mock payment endpoint:
  - `src/app/api/payments/[id]/mock/route.ts`
- obsolete mock payment test:
  - `tests/unit/mock-payment-route.test.ts`
- mock-specific owner payment UI branches and dead code
- unused plaintext `ADMIN_PASSWORD` from `.env.local`

## Simplified

- payment release surface now centers on:
  - `YOOKASSA`
  - `MANAGER`
- admin payment list `ALL` filter now excludes mock provider data
- Playwright local config now defaults to `localhost`, matching app behavior
- test imports/mocks now use stable fresh module loads where needed

## Kept Intentionally

- Prisma enum value `MOCK`
  - reason: schema/database cleanup is constrained by blocked migrations
  - mitigation: release logic no longer exposes or trusts mock flows

## Files Added

- `src/components/maps/catalog-map-preview-card.tsx`
- `RELEASE_AUDIT.md`
- `BUGFIX_LOG.md`
- `YOOKASSA_INTEGRATION.md`
- `SECURITY_AUDIT.md`
- `PERFORMANCE_AUDIT.md`
- `CLEANUP_REPORT.md`
- `RELEASE_CHECKLIST.md`

## Cleanup Outcome

- less dead payment code in release paths
- smaller payment attack surface
- less noisy/fragile test infrastructure
- lighter public search initial load
