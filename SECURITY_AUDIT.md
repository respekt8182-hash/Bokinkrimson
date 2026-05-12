# SECURITY_AUDIT

Date: 2026-04-15

## Confirmed Protections in Code

- auth/session cookies are server-issued
- CSRF protections are present for mutating app requests
- auth endpoints are rate-limited
- upload validation exists for file type/size/count
- placement payments are created as manager-confirmed requests

## Closed Findings

### SEC-001 Plaintext admin password in local env

- Severity: `medium`
- Reproduction:
  - `.env.local` contained `ADMIN_PASSWORD` in plaintext
- Impact:
  - unnecessary secret exposure in local runtime/config
- Fix:
  - removed plaintext `ADMIN_PASSWORD`
  - kept hash-only admin auth config
- Verification:
  - code search confirms runtime uses `ADMIN_PASSWORD_HASH`
- Residual risk:
  - rotate admin password before real production rollout

### SEC-002 Mock payment endpoint on release surface

- Severity: `high`
- Reproduction:
  - release build previously exposed `/api/payments/[id]/mock`
- Impact:
  - hidden fake-payment surface contradicted release payment model
- Fix:
  - route deleted
  - UI mock actions removed
  - real-provider filtering enforced in payment flows
- Verification:
  - build route list no longer contains the mock endpoint
  - full vitest suite passes
- Residual risk:
  - historical enum value `MOCK` remains in schema until full DB migration path is restored

### SEC-003 Legacy mock payment data could influence placement state

- Severity: `high`
- Reproduction:
  - succeeded/open mock payments could be included in placement coverage/open-payment conflict logic
- Impact:
  - potential false “already paid” or blocked real payment attempts
- Fix:
  - coverage ignores `MOCK`
  - payment history/open conflicts use only manager-confirmed payment requests
- Verification:
  - payment routes/build/tests pass after cleanup
- Residual risk:
  - none observed in current release path

## Open Security / Release Risks

### RISK-001 Database schema hardening is blocked by ownership mismatch

- Severity: `blocker`
- Reproduction:
  - `npm run db:deploy` fails with `P3009`
  - migration log indicates “must be owner of table”
- Impact:
  - compatibility-mode fallback remains active
  - latest hardening/publication fields are not physically migrated
- How to verify after access:
  1. connect as DB owner/superuser
  2. fix ownership of project tables + `_prisma_migrations`
  3. rerun `npm run db:deploy`
  4. rerun build/tests + smoke routes without compatibility warnings

## Additional Notes

- Public auth register/login/logout flows were manually verified.
- Forgot-password request creation was verified.
- Full reset-password delivery chain still needs either SMTP-backed delivery or a controlled admin-issued token workflow in target environment.
