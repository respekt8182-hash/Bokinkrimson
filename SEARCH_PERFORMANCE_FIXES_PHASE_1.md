# Search Performance Fixes — Phase 1

## 1. Summary

Implemented the first safe search/listing performance phase from `SEARCH_PERFORMANCE_AUDIT.md`.

The changes are intentionally small and reversible: opt-in performance instrumentation, removal of duplicate heavy overview calls, a lightweight transfer map query path, bounding-box prefilters for nearby blocks, bounded initial review includes on detail pages, a safer excursion load-more path, and an env gate for search impression writes.

Kept constraints:

- No database migrations.
- No external search service.
- No ranking or business-logic rewrite.
- No intentional public API contract break.
- No large frontend or catalog refactor.

## 2. Files Changed

| File | What changed | Why |
|---|---|---|
| `src/lib/performance-logging.ts` | Added env-gated search performance timer with sensitive-field redaction. | Allows safe timing logs with `SEARCH_PERF_LOGS=true` and near-zero overhead when disabled. |
| `src/lib/public-catalog-overview.ts` | Added lightweight housing/excursion overview helpers using count/aggregate-style queries. | Avoids loading/ranking thousands of catalog rows when `/search` only needs overview totals and price bounds. |
| `src/app/search/page.tsx` | Replaced cached overview wrappers that called heavy catalog functions; added page-flow timing. | Removes duplicate heavy work from `/search` while preserving SSR flow and visible UI. |
| `src/app/api/search/accommodations/route.ts` | Added opt-in route timing and error-status logging. | Makes housing search route latency observable without logging private query text. |
| `src/app/api/search/excursions/route.ts` | Added opt-in route timing and error-status logging. | Makes excursion search route latency observable without changing response shape. |
| `src/app/api/map/transfers/route.ts` | Replaced full `getPublicTransferCatalog` use with bounded direct Prisma select, bounds support, and cache headers. | Removes the full transfer catalog/ranking pipeline from map rendering. |
| `src/lib/nearby-public.ts` | Added `getBoundingBoxForRadiusKm` and applied it before existing JS Haversine filtering. | Reduces DB candidates for nearby sections without changing final distance semantics. |
| `src/lib/public-properties.ts` | Added perf logging, optional `SEARCH_IMPRESSION_WRITES=false` gate, and bounded initial detail reviews. | Improves observability, allows disabling write amplification during incidents/tests, and reduces detail payload size. |
| `src/lib/public-excursions.ts` | Added perf logging and bounded initial detail reviews. | Improves observability and reduces detail payload size. |
| `src/lib/public-marketplace.ts` | Added perf logging around transfer catalog execution. | Keeps the remaining heavy transfer catalog path measurable for the next phase. |
| `src/components/public/excursion-search-results.tsx` | Added abort/stale-response guards, retry helper usage, timeout handling, and visible load-more error state. | Prevents stale or failed load-more requests from silently corrupting frontend state. |
| `tests/unit/nearby-public.test.ts` | Added bounding-box helper coverage. | Protects radius, pole, tiny-radius, and antimeridian edge cases. |
| `tests/unit/detail-reviews-limit.test.ts` | Added detail include coverage for property and excursion reviews. | Prevents accidental return to unbounded initial review includes. |
| `tests/unit/map-endpoints-lightweight.test.ts` | Added transfer map endpoint coverage. | Prevents regression back to `getPublicTransferCatalog` in `/api/map/transfers`. |
| `tests/unit/search-page.test.ts` | Updated search page mocks/assertions for lightweight overview helpers. | Verifies `/search` overview no longer uses heavy catalog calls. |

## 3. Performance Impact Expected

| Area | Before | After | Expected impact |
|---|---|---|---|
| `/search` overview | Overview wrappers called heavy catalog functions and could load/rank broad catalog candidate sets. | Overview uses lightweight aggregate helpers for counts and max prices. | Lower server work and lower TTFB risk on `/search` and routes that reuse it. |
| `/api/map/transfers` | Map endpoint called `getPublicTransferCatalog({ pageSize: 5000, allowLargePageSize: true })`. | Endpoint uses direct bounded Prisma selection, applies bounds when provided, and excludes heavy fields. | Lower DB payload, CPU, memory, and response time for transfer map movement. |
| nearby | Nearby helpers fetched broad candidate sets and then computed distances in JS. | Helpers first apply a cheap bounding box, then keep existing Haversine filtering/sorting. | Fewer rows enter JS distance calculation while preserving final ordering semantics. |
| detail reviews | Property/excursion detail includes could bring all active reviews into the initial detail payload. | Initial detail review include is capped with `PUBLIC_REVIEWS_PAGE_SIZE`. | Smaller detail payloads and less relation load on card/detail navigation. |
| excursion load-more | Bare load-more fetch could fail silently or allow stale responses to overwrite newer state. | Uses abort/stale guards, existing retry helper, timeout, and visible retry error. | More stable pagination UX under slow or failing network/API conditions. |
| instrumentation | No focused opt-in timing for key search/listing paths. | Adds `[search-perf]` logs for page/routes/heavy functions when `SEARCH_PERF_LOGS=true`. | Enables before/after validation and p95/p99 investigation without normal logging noise. |

## 4. Behavior Compatibility

| Area | Compatibility status |
|---|---|
| Public ranking/search results | Existing ranking and filtering logic remains in place. No SQL/search-engine rewrite was introduced. |
| `/search` and `/rent` UI | Visible text and UI shape were preserved; overview data is produced through lighter helpers. |
| `/api/search/accommodations` | Response shape preserved. Added only disabled-by-default timing logs. |
| `/api/search/excursions` | Response shape preserved. Added only disabled-by-default timing logs. |
| `/api/map/transfers` | Preserves `items`, `map_points`, and `total`; adds `meta`. Items remain lightweight map-compatible objects. |
| Nearby blocks | Output shape and final JS Haversine distance logic preserved. Bounding box is only a candidate prefilter. |
| Detail reviews | Reviews are not removed; the initial include is capped. Existing rating/count summary behavior is kept. |
| Logging/privacy | Full user query text is not logged; sensitive string fields are redacted. Logging is disabled unless `SEARCH_PERF_LOGS` is enabled. |
| Impression writes | Default behavior remains enabled; `SEARCH_IMPRESSION_WRITES=false` can disable read-path impression writes for staging, load tests, or incidents. |

## 5. Tests Run

| Command | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | Passed | Re-run on the final code state; later changes were markdown-only. |
| `npx vitest run tests/unit/map-endpoints-lightweight.test.ts tests/unit/search-page.test.ts tests/unit/nearby-public.test.ts tests/unit/detail-reviews-limit.test.ts tests/unit/client-retry-fetch.test.ts` | Passed | Final run: 5 files, 11 tests. |
| `npx eslint src\lib\performance-logging.ts src\lib\public-catalog-overview.ts src\app\search\page.tsx src\app\api\search\accommodations\route.ts src\app\api\search\excursions\route.ts src\app\api\map\transfers\route.ts src\lib\nearby-public.ts src\lib\public-properties.ts src\lib\public-excursions.ts src\lib\public-marketplace.ts src\components\public\excursion-search-results.tsx tests\unit\nearby-public.test.ts tests\unit\detail-reviews-limit.test.ts tests\unit\map-endpoints-lightweight.test.ts tests\unit\search-page.test.ts` | Passed | Exit code 0 with 3 warnings in `src/lib/public-excursions.ts` for unused symbols. |
| `npm run lint` | Did not complete | Timed out after about 124s with no lint output before timeout. Targeted ESLint on changed files passed. |
| `npm run build` | Not run | Skipped for this narrow phase after successful typecheck, targeted route/unit tests, and targeted ESLint; full lint already hit environment/time limits. |

## 6. Tests Added / Updated

| Test file | Coverage |
|---|---|
| `tests/unit/nearby-public.test.ts` | Bounding-box helper: normal coordinates, antimeridian crossing, very small radius, and pole/all-longitudes behavior. |
| `tests/unit/detail-reviews-limit.test.ts` | Property and excursion detail queries include `reviews.take === PUBLIC_REVIEWS_PAGE_SIZE`. |
| `tests/unit/map-endpoints-lightweight.test.ts` | Transfer map endpoint avoids `getPublicTransferCatalog`, uses bounded query size, applies bounds, omits heavy fields, and returns map-compatible payloads. |
| `tests/unit/search-page.test.ts` | `/search` calls lightweight overview helpers and only calls the main housing catalog for the active initial result set. |

## 7. Risks / Follow-up

- Lightweight overview aggregate results should be compared against production-like data to catch any hidden assumptions from old JS post-filtered catalog totals.
- Nearby bounding boxes intentionally remain approximate prefilters; exact filtering still depends on the existing JS Haversine pass.
- Transfer map now has its own lightweight DTO path; sampled frontend map payloads should be compared in staging.
- `SEARCH_PERF_LOGS` should be enabled temporarily during staging/load tests, not left on blindly in noisy production windows.
- Full `npm run lint` needs a longer-running CI/local check because it timed out in this shell.
- Existing unused-symbol warnings in `src/lib/public-excursions.ts` can be cleaned in a separate low-risk hygiene pass.

## 8. Next Phase Recommendation

- DB/search candidate prefilter for properties.
- DB/search candidate prefilter for excursions.
- Transfer catalog query bounding for the main transfer listing, not only map data.
- Slug lookup caching or canonical slug migration planning.
- Frontend component split for the large excursion search client component.
- Playwright performance smoke tests for `/search`, excursion search, transfer map, and object detail navigation.
