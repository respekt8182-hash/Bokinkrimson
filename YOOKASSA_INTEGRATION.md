# YOOKASSA_INTEGRATION

## Current Integration State

This project uses a server-side YooKassa payment flow in Next.js route handlers.

Key files:

- `src/lib/yookassa.ts`
- `src/app/api/properties/[id]/payments/route.ts`
- `src/app/api/excursions/[id]/payments/route.ts`
- `src/app/api/payments/yookassa/webhook/route.ts`
- `src/lib/payments.ts`

## What Is Implemented

- Payment creation happens on the server only.
- Authentication to YooKassa uses backend secrets.
- `Idempotence-Key` is generated for payment creation.
- Payment metadata binds the remote payment to local `paymentId` and entity id (`propertyId` / `excursionId`).
- Client is redirected using YooKassa confirmation URL returned by the backend.
- After webhook arrival, local payment status is synchronized only after provider-side verification.
- Duplicate webhook handling is implemented via `WebhookReceipt`.
- Property placement can be auto-submitted after confirmed successful payment.

## Release Cleanup Done

- Mock payment endpoint removed from release surface.
- Mock payment UI branches removed from owner payment panels.
- Legacy `MOCK` history is ignored by placement coverage and conflict checks.

## Official YooKassa References Used

- Integration onboarding:
  - https://yookassa.ru/docs/support/payments/onboarding/integration
- Quick start:
  - https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start
- API interaction format:
  - https://yookassa.ru/developers/using-api/interaction-format
- Webhooks:
  - https://yookassa.ru/developers/using-api/webhooks
- Widget integration:
  - https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/integration

## Notes Against Official Rules

- API interaction format doc states YooKassa API requests must be authenticated with `Authorization` and `HTTP Basic Auth` using shop id + secret key.
- The same official API docs require `Idempotence-Key` for idempotent POST/DELETE operations. Current server-side payment creation follows this rule.
- Official widget docs say `confirmation_token` is obtained after creating a payment and that a changed order requires a new token/new payment. This project currently uses redirect confirmation URLs, not the embedded widget, so widget token rules are only relevant if the frontend is migrated to widget mode later.
- Official widget docs also state that after redirect/return you must independently determine final payment status, for example via YooKassa notifications or payment status polling. Current implementation follows the server-verification model via webhook + provider-side fetch.

## Required Env Variables

- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_RETURN_URL`
- `YOOKASSA_WEBHOOK_IP_ALLOWLIST`

Derived runtime webhook URL:

- `https://<public-domain>/api/payments/yookassa/webhook`

## Local Verification Completed

- Code path review confirmed:
  - server-only create/check logic
  - idempotence key usage
  - provider-side verification before success handling
  - duplicate webhook dedupe
- Unit verification:
  - webhook hardening test passes
  - full vitest suite passes

## What Could Not Be Verified End-to-End Yet

- successful live payment
- user cancellation on YooKassa side
- return to public production URL
- real webhook delivery from YooKassa to public HTTPS endpoint
- repeated webhook delivery from YooKassa infrastructure

## Remaining Go-Live Checklist

1. Provide real `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY`.
2. Set public HTTPS `YOOKASSA_RETURN_URL`.
3. Publish app on reachable HTTPS domain.
4. Set `YOOKASSA_WEBHOOK_IP_ALLOWLIST` to approved source IPs/ranges for your environment.
5. Register webhook URL in YooKassa cabinet.
6. Run full matrix:
   - success
   - cancel
   - provider error
   - duplicate click
   - duplicate webhook
   - client/server status mismatch

## Release Conclusion

Implementation is **ready for launch setup**, but **not yet fully launch-verified** until real YooKassa credentials and public webhook reachability are available.
