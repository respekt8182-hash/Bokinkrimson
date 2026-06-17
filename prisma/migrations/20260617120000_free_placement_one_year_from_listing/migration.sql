-- Move free/demo listing placement from a fixed campaign date to one year from listing creation.
-- Expired listings stay visible; only the owner-side payment marker changes.

WITH demo_property_payments AS (
  SELECT
    payment."id",
    property."createdAt" + INTERVAL '1 year' AS "validUntil"
  FROM "Payment" payment
  JOIN "Property" property ON property."id" = payment."propertyId"
  WHERE
    payment."status" = 'succeeded'::"PaymentStatus"
    AND payment."provider" <> 'mock'::"PaymentProvider"
    AND (
      payment."tariffType" = 'demo'::"ObjectTariffType"
      OR payment."tariffCode" IN ('object_demo', 'demo')
      OR payment."providerPayload"->>'placementMode' = 'demo'
      OR payment."providerPayload"->>'placementCampaignType' IN (
        'free_placement_until_2027_05_01',
        'free_placement_until_2026_06_20',
        'free_placement_first_year',
        'post_launch_new_listing_trial_1_month',
        'post_launch_new_listing_trial_1_year'
      )
      OR payment."providerPayload" ? 'postLaunchTrial'
    )
)
UPDATE "Payment" payment
SET
  "placementValidUntil" = demo."validUntil",
  "updatedAt" = NOW()
FROM demo_property_payments demo
WHERE payment."id" = demo."id";

WITH demo_excursion_payments AS (
  SELECT
    payment."id",
    excursion."createdAt" + INTERVAL '1 year' AS "validUntil"
  FROM "Payment" payment
  JOIN "Excursion" excursion ON excursion."id" = payment."excursionId"
  WHERE
    payment."status" = 'succeeded'::"PaymentStatus"
    AND payment."provider" <> 'mock'::"PaymentProvider"
    AND (
      payment."amount" = 0
      OR payment."providerPayload"->>'placementMode' = 'demo'
      OR payment."providerPayload"->>'placementCampaignType' IN (
        'free_placement_until_2027_05_01',
        'free_placement_until_2026_06_20',
        'free_placement_first_year',
        'post_launch_new_listing_trial_1_month',
        'post_launch_new_listing_trial_1_year'
      )
      OR payment."providerPayload" ? 'postLaunchTrial'
    )
)
UPDATE "Payment" payment
SET
  "placementValidUntil" = demo."validUntil",
  "updatedAt" = NOW()
FROM demo_excursion_payments demo
WHERE payment."id" = demo."id";

WITH demo_transfer_payments AS (
  SELECT
    payment."id",
    transfer."createdAt" + INTERVAL '1 year' AS "validUntil"
  FROM "Payment" payment
  JOIN "Transfer" transfer ON transfer."id" = payment."transferId"
  WHERE
    payment."status" = 'succeeded'::"PaymentStatus"
    AND payment."provider" <> 'mock'::"PaymentProvider"
    AND (
      payment."amount" = 0
      OR payment."providerPayload"->>'placementMode' = 'demo'
      OR payment."providerPayload"->>'placementCampaignType' IN (
        'free_placement_until_2027_05_01',
        'free_placement_until_2026_06_20',
        'free_placement_first_year',
        'post_launch_new_listing_trial_1_month',
        'post_launch_new_listing_trial_1_year'
      )
      OR payment."providerPayload" ? 'postLaunchTrial'
    )
)
UPDATE "Payment" payment
SET
  "placementValidUntil" = demo."validUntil",
  "updatedAt" = NOW()
FROM demo_transfer_payments demo
WHERE payment."id" = demo."id";

WITH latest_property_demo AS (
  SELECT DISTINCT ON (payment."propertyId")
    payment."propertyId",
    payment."placementValidUntil",
    payment."paidFrom",
    payment."paidAt",
    payment."amount"
  FROM "Payment" payment
  WHERE
    payment."propertyId" IS NOT NULL
    AND payment."status" = 'succeeded'::"PaymentStatus"
    AND payment."provider" <> 'mock'::"PaymentProvider"
    AND (
      payment."tariffType" = 'demo'::"ObjectTariffType"
      OR payment."tariffCode" IN ('object_demo', 'demo')
      OR payment."providerPayload"->>'placementMode' = 'demo'
      OR payment."providerPayload"->>'placementCampaignType' IN (
        'free_placement_until_2027_05_01',
        'free_placement_until_2026_06_20',
        'free_placement_first_year',
        'post_launch_new_listing_trial_1_month',
        'post_launch_new_listing_trial_1_year'
      )
      OR payment."providerPayload" ? 'postLaunchTrial'
    )
  ORDER BY payment."propertyId", payment."placementValidUntil" DESC NULLS LAST, payment."paidAt" DESC NULLS LAST, payment."createdAt" DESC
)
UPDATE "Property" property
SET
  "paymentStatus" = CASE
    WHEN latest."placementValidUntil" <= NOW() THEN 'expired'::"ObjectPaymentStatus"
    ELSE 'demo'::"ObjectPaymentStatus"
  END,
  "tariffType" = 'demo'::"ObjectTariffType",
  "paidFrom" = latest."paidFrom",
  "paidUntil" = latest."placementValidUntil",
  "paidAmount" = latest."amount",
  "paidAt" = latest."paidAt",
  "updatedAt" = NOW()
FROM latest_property_demo latest
WHERE property."id" = latest."propertyId";
