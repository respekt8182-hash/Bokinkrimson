# RELEASE_CHECKLIST

## Current Status

- [x] Local app starts with `npm run dev`
- [x] Production build succeeds with `npm run build`
- [x] Full unit/integration test suite passes with `npx vitest run`
- [x] Playwright smoke passes with `npm run test:e2e`
- [x] Public search for housing verified
- [x] Public search for excursions verified
- [x] Property card opens from public search
- [x] Excursion card opens from public search
- [x] Owner dashboard smoke verified
- [x] Admin login/dashboard smoke verified
- [x] Public register flow verified
- [x] Public login/logout flow verified
- [x] Forgot-password request creation verified
- [x] Legacy mock payment route removed from release surface
- [x] Payment coverage/conflict logic filtered to real providers
- [x] YooKassa code reviewed against official documentation

## Blocked / Requires External Access

- [ ] Apply latest Prisma migrations on target DB
  - blocked by table ownership mismatch (`postgres` owns tables, app uses `boking`)
- [ ] Run live YooKassa payment matrix
  - blocked by missing `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL`, `YOOKASSA_WEBHOOK_IP_ALLOWLIST`, public HTTPS domain
- [ ] Verify full public reset-password completion
  - token delivery chain needs real admin-issued token capture and/or target email delivery setup

## Recommended Release Gate

Do not mark production release complete until all unchecked items above are closed.
