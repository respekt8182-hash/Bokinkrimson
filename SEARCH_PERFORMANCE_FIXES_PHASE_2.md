# Search Performance Fixes — Phase 2

## 1. Summary

Implemented guarded Phase 2 backend optimizations for the public search/catalog pipeline.

The main change is an opt-in DB candidate-ID stage for properties, excursions, and transfers. When enabled, each catalog can first fetch a bounded list of candidate IDs through a lightweight Prisma query, then run the existing JS ranking/filtering/DTO logic against only those candidates. The old path remains the default.

Also added a short in-memory TTL cache for public slug lookups and cleaned the known live `src/lib/public-excursions.ts` unused-symbol warnings from Phase 1.

Kept constraints:

- No database migrations.
- No external search service.
- Existing JS ranking, token/trigram scoring, sorting, pagination, and DTO mapping remain in place.
- Public response shapes are preserved.
- Risky behavior is behind env flags or has fallback to the old path.

## 2. Starting Point

After Phase 1:

- `/search` overview totals were moved to lightweight aggregate helpers.
- `/api/map/transfers` no longer called the full transfer catalog.
- Nearby blocks got bounding-box prefilters before JS Haversine filtering.
- Initial detail reviews were capped.
- Search/listing perf logging existed behind `SEARCH_PERF_LOGS=true`.
- Excursion load-more got abort/stale/retry/error handling.
- `SEARCH_IMPRESSION_WRITES=false` could disable housing impression write amplification.

Remaining issues:

- `getPublicCatalog` could still load up to 5000 property rows with rooms, prices, media, amenities, and owner data before JS ranking.
- `getPublicExcursionCatalog` could still load up to 5000 rows with route, pickup, location, category, owner, session, and count relations.
- `getPublicTransferCatalog` still had an unbounded published-transfer `findMany` on the main listing path.
- Public slug lookup for properties, excursions, and transfers still scanned visible rows and compared computed slugs in JS.

## 3. Files Changed

| File | What changed | Why | Risk |
|---|---|---|---|
| `src/lib/search/prefilter-controls.ts` | Added env flag, force-fallback, candidate-limit, and timing helpers. | Keeps prefilter behavior consistent and opt-in. | Low; helper is inert unless imported flags are enabled. |
| `src/lib/public-slug-cache.ts` | Added short in-memory public slug lookup cache. | Avoids repeated public slug scans for direct detail URLs. | Medium; stale cache possible until TTL expires. |
| `src/lib/public-properties.ts` | Added property candidate-ID stage, sparse text fallback, perf fields, and public slug cache. | Reduces heavy property relation fetches when the opt-in flag is enabled. | Medium; candidate prefilter can affect relevance if rolled out without parity checks. |
| `src/lib/public-excursions.ts` | Added excursion candidate-ID stage, sparse text fallback, perf fields, public slug cache, and removed unused legacy symbols. | Reduces relation-heavy excursion fetches and clears Phase 1 warnings in live source. | Medium; location/text candidate narrowing needs staged validation. |
| `src/lib/public-marketplace.ts` | Added opt-in transfer candidate-ID stage, bounded transfer flag path, perf fields, and public slug cache. | Provides a safe path away from unbounded main transfer catalog fetches. | Medium; flag-on no-filter transfer catalog is capped at the candidate limit. |
| `tests/unit/search-db-prefilter.test.ts` | Added candidate-stage tests for property, excursion, and transfer catalogs. | Protects query shape, fallback, caps, and transfer response redaction. | Low. |
| `tests/unit/public-slug-cache.test.ts` | Added slug cache tests for property, excursion, and transfer lookup. | Protects miss/hit behavior, public visibility scoping, and collision ordering. | Low. |
| `SEARCH_PERFORMANCE_FIXES_PHASE_2.md` | Added this implementation report. | Documents rollout, checks, and risks. | Low. |

## 4. Candidate Prefilter Design

### Properties

Old path:

- `getPublicCatalog` fetched up to `CATALOG_CANDIDATE_LIMIT` / 5000 properties with card-level relations.
- JS then applied display-state resolution, text ranking, location/nearby filtering, price filtering, business ranking, sorting, pagination, and DTO mapping.

New path:

- Enabled only with `SEARCH_PROPERTY_DB_PREFILTER=true`.
- First query selects only `{ id: true }`.
- Heavy catalog select then runs only for those IDs.
- Default candidate limit: `3000`.
- Override: `SEARCH_PROPERTY_DB_PREFILTER_LIMIT`, capped by the existing 5000 candidate limit.
- Force old path: `SEARCH_DB_PREFILTER_FORCE_FALLBACK=true`.

DB candidate filters:

- Existing public visibility, rating/reviews, and bounds base filters.
- Type.
- Broad location match plus radius bounding box for nearby candidates.
- Broad text `contains` across name, location, address, description, and room title.
- Broad price relation check.
- Photos, family, pets, smoking, and quiet-hours coarse checks.
- Pending-edit rows are retained in candidate filters so published snapshots are still resolved by the existing JS display-state logic.

Still in JS:

- Published snapshot display-state resolution.
- Trigram/token scoring and transliteration variants.
- Exact/nearby location semantics.
- Stay pricing and min-night price logic.
- Amenity filters and ranking-v2 scoring.
- Sorting, pagination, card metadata enrichment, media existence filtering, and DTO mapping.

Fallback behavior:

- Default behavior is old path because the flag is off.
- Candidate-stage Prisma errors fall back to old path.
- Sparse non-empty text candidate results fall back to old path.
- `SEARCH_DB_PREFILTER_FORCE_FALLBACK=true` disables all new DB prefilters.

### Excursions

Old path:

- `getPublicExcursionCatalog` fetched up to 5000 excursions with route, pickup, location, category, owner, session, and `_count` relations.
- JS then applied text/location/date/capacity/language/duration filters, ranking, sorting, pagination, and DTO mapping.

New path:

- Enabled only with `SEARCH_EXCURSION_DB_PREFILTER=true`.
- First query selects only IDs using the existing catalog `where` plus optional broad text/location predicates.
- Heavy include query then runs only for candidate IDs.
- Default candidate limit: `3000`.
- Override: `SEARCH_EXCURSION_DB_PREFILTER_LIMIT`, capped at 5000.

DB candidate filters:

- Existing visibility, offer type, district, category, format, difficulty, pickup, kids, price, bounds, and session availability filters.
- Anchor/main/meeting/pickup/route location IDs where available.
- Broad location text across location/start/finish/district fields.
- Broad text across title, location, route points, descriptions, district, and category.
- Pending-edit rows are retained for published snapshot correctness.

Still in JS:

- Published snapshot resolution.
- Primary text score and trigram ranking.
- Exact/nearby location semantics.
- Date/capacity semantics for request-based excursions.
- Language, duration, ranking-v2 scoring, sorting, pagination, and DTO mapping.

Fallback behavior:

- Default behavior is old path because the flag is off.
- Candidate-stage errors fall back to old path.
- Sparse non-empty text candidate results fall back to old path.
- `SEARCH_DB_PREFILTER_FORCE_FALLBACK=true` disables the new path.

### Transfers

Old path:

- `getPublicTransferCatalog` loaded all published visible transfers without `take`.
- JS then applied location, text, type, price, bounds, ranking, sorting, pagination, and DTO mapping.

New path:

- Enabled only with `SEARCH_TRANSFER_DB_PREFILTER=true`.
- First query selects only IDs.
- Heavy transfer include then runs only for those IDs.
- Default candidate limit: `5000`.
- Override: `SEARCH_TRANSFER_DB_PREFILTER_LIMIT`, capped at 5000.
- This also bounds no-filter transfer listing when the flag is enabled.

DB candidate filters:

- Published/visible/owner-not-deleted visibility.
- Broad text across title, type, vehicle, location, service area, route examples, and descriptions.
- Broad location match by resolved location, text fields, related location/district, and radius box.
- Transfer type.
- Price range.
- Bounds.
- Pending-edit rows are retained for snapshot correctness.

Still in JS:

- Published transfer snapshot application.
- Fleet-derived summary and price logic.
- Search score, exact/nearby location semantics, ranking-v2 scoring, sorting, pagination, contact redaction, and DTO mapping.

Fallback behavior:

- Default behavior is old path because the flag is off.
- Candidate-stage errors fall back to old path.
- Sparse non-empty text candidate results fall back to old path.
- Known marketplace DB fallback behavior remains unchanged.
- `/api/map/transfers` remains on the lightweight Phase 1 route path and still avoids `getPublicTransferCatalog`.

## 5. Behavior Compatibility

Preserved response shapes:

- `PublicCatalogResult`.
- `PublicExcursionCatalogResult`.
- `PublicTransferCatalogResult`.
- `/api/map/transfers` contract from Phase 1.

Business rules not intentionally changed:

- Existing JS ranking and scoring remain authoritative.
- Existing sorting/pagination remain authoritative after candidate selection.
- Published snapshot display still happens in the existing mappers.
- Public contact redaction remains in place.

Relevance drift risk:

- Flag-on DB candidates can hide a relevant row before JS ranking sees it if the broad DB predicates miss a typo/transliteration/snapshot edge case.
- Sparse text fallback reduces this risk but does not prove full parity on production data.
- Default old path remains active until flags are enabled in staging/production.

## 6. Slug Lookup Improvement

What is cached:

- Public property slug -> ID.
- Public excursion slug/location -> ID.
- Public transfer slug -> ID.

TTL:

- Default `PUBLIC_SLUG_LOOKUP_CACHE_TTL_MS=600000` (10 minutes).
- Allowed helper range: 1 to 15 minutes.

Safety:

- Owner preview/private lookups bypass the cache.
- Cache keys include entity type and relevant slug/location mode.
- Public visibility is still enforced by the uncached lookup query.
- Null results are cached for the short TTL.

Invalidation risk:

- Publishing, hiding, renaming, or slug collision changes can be stale until TTL expiry.
- This is intentionally short-lived and does not replace a future canonical slug migration.

Tests added:

- Property public slug lookup miss/hit cache behavior.
- Property lookup uses published-visible scope.
- Excursion slug lookup respects expected location and cache hit.
- Transfer slug collision behavior still picks the first row from `updatedAt desc`.

Future canonical slug migration plan:

1. Add canonical slug columns for `Property`, `Excursion`, and `Transfer`.
2. Store location-scoped slug fields where URLs include a location segment.
3. Add unique or composite indexes, for example `(locationSlug, slug)` for location-scoped entities and unique `slug` for transfers if global.
4. Backfill in batches from current display titles/snapshots.
5. Detect collisions during backfill and append stable suffixes or public IDs.
6. Keep old computed-slug resolver as a redirect fallback during migration.
7. Add 301 redirects from old computed URLs to canonical URLs after confidence window.
8. Remove JS scan lookup after canonical slug coverage is complete and indexed.

## 7. Performance Impact Expected

| Area | Before | After | Expected impact | How to verify in staging |
|---|---|---|---|---|
| Property catalog | Up to 5000 relation-heavy rows loaded before JS ranking. | With flag on, lightweight ID stage then heavy fetch only for candidate IDs. | Lower DB payload, app memory, and ranking CPU on filtered searches. | Enable `SEARCH_PERF_LOGS=true` and compare `candidateIdsCount`, `heavyRowsFetched`, p50/p95/p99. |
| Excursion catalog | Up to 5000 rows with route/pickup/session/category/location relations. | With flag on, existing catalog filters run as ID stage before relation includes. | Lower relation load and serialization before JS ranking. | Compare `candidateStageDurationMs`, `heavyRowsFetched`, and top result parity. |
| Transfer catalog | Main listing fetched all published transfers. | With flag on, transfer catalog is capped by candidate ID stage. | Prevents unbounded growth and lowers heavy include rows. | Enable `SEARCH_TRANSFER_DB_PREFILTER=true`; compare listing totals/top rows against old path. |
| Slug lookup | Direct URLs scanned public rows and computed slugs repeatedly. | Public slug -> ID result cached for a short TTL. | Lower repeated detail-route DB work. | Open the same slug URL twice with `SEARCH_PERF_LOGS=true`; second lookup should show cache hit. |
| API payload tests | Transfer map had Phase 1 guardrails; main transfer catalog redaction was not covered here. | New tests assert transfer catalog contact fields remain redacted after prefilter. | Reduces risk that optimization leaks heavy/private fields. | Run targeted Vitest and sample API JSON in staging. |
| Perf logging | Phase 1 route timing only had broad candidate counts. | Catalog logs now include candidate-stage duration/counts, heavy rows, fallback, and flag status. | Better rollout diagnosis. | Watch `[search-perf]` logs while toggling one flag at a time. |

## 8. Tests Added / Updated

| Test file | Coverage |
|---|---|
| `tests/unit/search-db-prefilter.test.ts` | Property ID-stage query, property sparse text fallback, excursion ID-stage query, transfer ID-stage cap, and transfer contact redaction. |
| `tests/unit/public-slug-cache.test.ts` | Public slug cache hit/miss behavior, public visibility scoping, excursion location scoping, and transfer collision ordering. |

## 9. Tests Run

| Command | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | Passed | Re-run after Phase 2 code and tests. |
| `npx vitest run tests/unit/search-db-prefilter.test.ts tests/unit/public-slug-cache.test.ts tests/unit/map-endpoints-lightweight.test.ts tests/unit/search-page.test.ts tests/unit/nearby-public.test.ts tests/unit/detail-reviews-limit.test.ts tests/unit/client-retry-fetch.test.ts` | Passed | 7 files, 19 tests. Includes Phase 1 tests and Phase 2 tests. |
| `npx eslint src\lib\search\prefilter-controls.ts src\lib\public-slug-cache.ts src\lib\public-properties.ts src\lib\public-excursions.ts src\lib\public-marketplace.ts tests\unit\search-db-prefilter.test.ts tests\unit\public-slug-cache.test.ts` | Passed | Exit code 0. Live `src/lib/public-excursions.ts` unused warnings are gone. |
| `npm run lint` | Passed with warnings | Exit code 0 after about 158s. Remaining warnings are pre-existing in `.local/Bokinkrimson-git2/**`, `src/components/support-chat/support-chat-widget.tsx`, `src/components/ui/app-icon.tsx`, and `src/lib/properties.ts`. |
| `npm run build` | Failed before build | `prebuild` stopped at `npm run check:mojibake`; existing suspicious text was reported in `src/components/excursions/excursion-editor.tsx` lines 6722, 6744, 6753, 6767. Next build did not run. |

## 10. Risks

- Relevance drift if DB candidate predicates miss rows that old JS ranking would have found.
- Missing or suboptimal indexes can make broad `contains` prefilters slower than expected on large production data.
- Transfer flag-on no-filter listing is capped at 5000 candidates; validate totals and top rows before enabling broadly.
- Sparse text fallback may hide some performance gains for rare queries, by design.
- Stale slug cache can briefly serve an old slug result after publish/hide/rename.
- Production data assumptions remain unverified without staging row counts and common-query samples.
- Full Next build is still blocked by pre-existing mojibake checker findings.

## 11. How To Validate In Staging

1. Enable `SEARCH_PERF_LOGS=true`.
2. Enable only one prefilter flag at a time:
   - `SEARCH_PROPERTY_DB_PREFILTER=true`
   - `SEARCH_EXCURSION_DB_PREFILTER=true`
   - `SEARCH_TRANSFER_DB_PREFILTER=true`
3. Keep `SEARCH_DB_PREFILTER_FORCE_FALLBACK=true` ready as a fast rollback switch.
4. Compare p50/p95/p99 for `/search`, `/api/search/accommodations`, `/api/search/excursions`, `/transfers`, and detail URLs.
5. Compare top results for common housing, excursion, tour, and transfer queries with flags off/on.
6. Check Cyrillic, Latin, typo, and transliteration-like queries.
7. Check no-results and rare-query behavior; expect sparse text fallback in logs.
8. Verify map/list/detail flows, especially `/api/map/transfers` remains lightweight.
9. Open the same public detail slug twice and confirm slug cache miss then hit in perf logs.
10. Sample JSON payloads to confirm response shapes and contact redaction remain unchanged.

## 12. Next Phase Recommendation

- Add production-like golden result fixtures for property and excursion relevance parity.
- Use `EXPLAIN (ANALYZE, BUFFERS)` on candidate queries and add/adjust indexes in a migration-only phase.
- Plan and execute canonical slug columns/indexes/backfill/redirects.
- Add payload size budgets for search APIs.
- Add env-gated Playwright performance smoke tests once the current e2e setup is stable.
- Split the large excursion search client component after backend p95/p99 is under control.
