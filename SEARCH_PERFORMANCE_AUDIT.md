# Search & Listing Performance Audit

Дата аудита: 2026-06-17  
Статус: только анализ. Код, API-контракты, схема БД, миграции и существующие файлы не изменялись.

## 1. Executive Summary

Самая большая проблема поиска и выдачи сейчас не в одном endpoint, а в повторяющемся паттерне: сервер берет широкий набор кандидатов, часто до 5000 строк с вложенными relation-данными, а затем фильтрует, ранжирует, сортирует и пагинирует в памяти приложения. Это подтверждено для жилья, экскурсий, трансферов, nearby-блоков и slug lookup. На малом объеме это дает гибкость релевантности, но на росте данных становится причиной высокого TTFB, CPU pressure, тяжелых JSON/RSC payload и нестабильных p95/p99.

Наиболее проблемные места:

1. **confirmed / Critical**: `getPublicCatalog` в `src/lib/public-properties.ts` выбирает до 5000 объектов с вложенными комнатами, ценами, amenities и media, затем делает trigram/token ranking, фильтры и пагинацию в JS.
2. **confirmed / Critical**: `getPublicExcursionCatalog` в `src/lib/public-excursions.ts` выбирает до 5000 экскурсий с route/pickup/location/category/sessions, затем ранжирует и пагинирует в памяти.
3. **confirmed / High**: `/search` и `/rent` принудительно dynamic/no-store и дополнительно делают overview-вызовы через те же тяжелые catalog функции.
4. **confirmed / High**: `getPublicTransferCatalog` в `src/lib/public-marketplace.ts` загружает все опубликованные трансферы без `take/skip`, а `/api/map/transfers` вызывает его с `pageSize: 5000`.
5. **confirmed / High**: detail-страницы из карточек запускают nearby-запросы, которые читают до 5000 properties/excursions и считают расстояния в JS.
6. **confirmed / High**: публичный slug lookup для жилья, экскурсий и трансферов сканирует набор опубликованных строк и сравнивает slug в JS.
7. **confirmed / Medium/High**: frontend для экскурсий - монолитный client component около 158 KB исходника с большим количеством state/effects; взаимодействие с картой может запускать и `/api/map/excursions`, и `/api/search/excursions`.

Старый локальный `PERFORMANCE_AUDIT.md` уже фиксировал симптомы: `/search` около 721 KB raw HTML / 1241 ms через `Invoke-WebRequest`, browser run около 74 requests и 38 images. Эти цифры нужно перепроверить на текущем стенде, но они хорошо совпадают с найденной архитектурной причиной: слишком много данных готовится до первого результата.

## 2. Project Stack

| Area | Found stack |
|---|---|
| Frontend | Next.js App Router `16.1.6`, React `19.2.3`, TypeScript, Tailwind CSS v4, client/server components |
| Backend | Next.js route handlers under `src/app/api/**`, server functions in `src/lib/**` |
| Database | PostgreSQL по `DATABASE_URL` |
| ORM/query layer | Prisma `6.16.2` |
| Search implementation | В основном custom application-level search: `rankByTrigramWithScores`, token scoring, normalized text, transliteration, JS ranking/filtering. Есть PostgreSQL `pg_trgm` indexes in migrations, но основной catalog ranking часто выполняется после широкого Prisma fetch |
| Caching | `unstable_cache` для directory/popular/overview; response cache headers у map/attraction/suggestions endpoints; housing search explicitly `no-store`; in-process 60s cache in suggestions route |
| Runtime/deployment | Next.js self-host/server runtime implied by scripts; exact production runtime not visible from code |
| Images/storage | Next Image AVIF/WebP, S3 public base URL, local upload compatibility checks |
| Tests/tools | Vitest, Playwright, ESLint, Prisma generate. `npm test` has `pretest` that cleans cache and ensures Prisma client, so I did not run it during this read-only audit |

Safe commands reviewed: `lint`, `test`, `build`, `test:e2e`. I did not run them because this task is diagnostic-only and the configured pre-scripts can write generated/cache state. I used only read/search commands plus creation of this report.

## 3. Search/User Flows Map

| User flow | Frontend files | Backend/API files | DB/search layer | Notes |
|---|---|---|---|---|
| Global search page | `src/app/search/page.tsx` | Direct server calls to `getPublicCatalog`, `getPublicExcursionCatalog`; client calls API after hydration | `Property`, `Excursion`, location directories, ranking stats | `force-dynamic`, `revalidate=0`, `noStore()` |
| Housing listing `/search`, `/rent` | `HousingCatalogClient`, `PublicHousingResultsWithMap`, `PublicPropertySearchCard` | `src/app/api/search/accommodations/route.ts`, `src/app/api/public/properties/route.ts` | `getPublicCatalog` in `src/lib/public-properties.ts` | Broad candidate pool, in-memory ranking/pagination |
| Excursion/tour listing | `ExcursionSearchResults` | `src/app/api/search/excursions/route.ts`, `src/app/api/public/excursions/route.ts` | `getPublicExcursionCatalog` in `src/lib/public-excursions.ts` | Broad `take: 5000`, heavy include, in-memory ranking |
| Attractions listing | `AttractionCatalog`, `AttractionCatalogClient`, `MarketplaceCatalogMap` | `src/app/api/search/attractions/route.ts`, `src/app/api/map/attractions/route.ts` | `getStaticAttractionCatalog`, static data | Static dataset currently safer, but all-row JS ranking/filtering scales poorly |
| Transfers listing | `TransferCatalog`, `MarketplaceCatalogMap` | `src/app/transfers/page.tsx`, `src/app/api/map/transfers/route.ts` | `getPublicTransferCatalog` in `src/lib/public-marketplace.ts` | Fetches all published transfers, map asks for 5000 |
| Autocomplete/suggestions | `HousingCatalogSearchCombobox`, excursion search suggestions UI | `src/app/api/search/suggestions/route.ts` | `getHousingSuggestionRows`, `getExcursionSuggestionRows`, static attraction rows, transfer rows | Debounced and cached client-side, but source rows are scanned up to 1200 per direction per process cache miss |
| Housing map search | `PublicHousingResultsWithMap`, `HousingCatalogClient` | `src/app/api/map/accommodations/route.ts` | Direct Prisma `property.findMany`, `take: limit + 1` | Lightweight relative to catalog; has tests ensuring no full catalog pipeline |
| Excursion map search | `ExcursionSearchResults` | `src/app/api/map/excursions/route.ts` | Direct Prisma `excursion.findMany`, `take: limit + 1` | Lightweight relative to catalog; map interaction may also trigger catalog bounds search |
| Transfer map search | `MarketplaceCatalogMap` | `src/app/api/map/transfers/route.ts` | Full `getPublicTransferCatalog` | Unlike housing/excursions, map endpoint reuses full catalog |
| Location pages | `src/app/excursions/[location]/page.tsx`, category/district routes | Direct server calls | `getPublicExcursionCatalog`, directory queries | Location pages inherit the same catalog costs |
| Object detail from cards | `PublicPropertyDetails`, excursion detail page | `getPublicPropertyByIdentifier`, `getPublicExcursionByIdentifier` | Slug lookup, full include, reviews, nearby queries | Detail page can be slow after clicking a card due to nearby and all-review include |
| Similar/recommended objects | `Nearby*SectionServer`, detail pages | `src/lib/nearby-public.ts` | `db.property.findMany`, `db.excursion.findMany`, static attractions | Up to 5000 rows, Haversine in JS |

## 4. API & Backend Findings

| Severity | File/endpoint | Problem | Evidence | Expected impact | Suggested fix later |
|---|---|---|---|---|---|
| Critical | `src/lib/public-properties.ts#getPublicCatalog` | confirmed: broad candidate fetch and app-level ranking/pagination | Lines 1734-1741 cap candidates to 5000; lines 1921-1926 `property.findMany(... take: candidateLimit)`; lines 1973-2037 trigram/token scoring over `allProperties`; lines 2039-2135 JS filters; lines 2298-2301 JS pagination | High TTFB/CPU as properties, rooms, prices and media grow | Push structured filters/search prefilter into SQL/search index; return lightweight DTO first; paginate before expensive enrichment where possible |
| Critical | `src/lib/public-excursions.ts#getPublicExcursionCatalog` | confirmed: broad `take: 5000` with heavy include and JS ranking | Lines 1260-1330 include location/category/route/pickup/sessions and `take: 5000`; lines 1498-1771 filter/rank/slice in JS | High CPU and memory, slow search/location pages | Split list DTO from full details; SQL prefilter text/location/date/price; keyset/cursor for deep pages; precompute rank/search fields |
| High | `src/app/search/page.tsx` | confirmed: dynamic/no-store plus duplicate overview catalog calls | Lines 25-26 force dynamic/revalidate 0; line 129 `noStore`; lines 28-69 cached overview wrappers call full catalog functions; lines 215-257 and 309-344 run main catalog plus overview | Every request recomputes core catalog; cache misses are expensive | Replace overview with cheap aggregate/count/price query; consider cacheable shell + client data fetch for non-SEO states |
| High | `src/app/rent/page.tsx` | confirmed: `/rent` reuses `/search` and inherits no-store catalog cost | Lines 9-10 force dynamic/revalidate 0; lines 21-29 call `SearchPage` with housing direction | Same housing cost on clean SEO route | Same fix as search; keep SEO state separate from dynamic catalog |
| High | `src/lib/public-marketplace.ts#getPublicTransferCatalog` | confirmed: transfer catalog loads all published transfers | Lines 813-823 `db.transfer.findMany` with no `take`; lines 856-1141 map/filter/rank/slice in JS | Unbounded memory/latency growth; map endpoint amplifies this | Add bounded candidate query, SQL filters, lightweight transfer map endpoint, separate detail include |
| High | `src/app/api/map/transfers/route.ts` | confirmed: transfer map endpoint calls full transfer catalog with `pageSize: 5000` | Lines 23-35 call `getPublicTransferCatalog({ pageSize: 5000, allowLargePageSize: true })` | Large map payload and repeated full ranking for map movement | Mirror lightweight housing/excursion map endpoint pattern |
| High | `src/lib/nearby-public.ts` | confirmed: nearby blocks fetch up to 5000 rows and compute Haversine in JS | Lines 327-336 excursions `take: 5000`; lines 377-384 properties `take: 5000`; detail pages call these blocks | Slow detail pages after card click; DB/CPU spikes on popular objects | Use SQL bounding box prefilter and order by approximate distance; cache nearby by entity/location |
| High | Slug lookup in `public-properties`, `public-excursions`, `public-marketplace` | confirmed: public slug lookup scans all visible rows then `.find()` in JS | Property lines 2725-2746; excursion lines 641-660; transfer lines 307-330 | Detail pages get slower with catalog growth; bad p95 on direct SEO URLs | Persist/index canonical public slug or lookup table; until then cache slug-to-id resolution |
| Medium | `src/lib/public-properties.ts#getPublicCatalog` | confirmed: read path performs fire-and-forget write for impressions | Lines 2303-2313 `db.property.updateMany(... increment)` inside catalog function | Extra DB write load and lock/noise from search traffic; errors swallowed | Move to analytics queue/batch endpoint or disable for API map/filter requests |
| Medium | `src/lib/public-properties.ts#getPublicCatalog` | confirmed: page results perform second DB query and filesystem/storage existence check | Lines 2316-2379 card metadata query; lines 2382-2387 `filterExistingLocalPublicUploadUrls` | More latency variance; filesystem checks can add p99 spikes | Store media validity in DB or perform async repair; keep list endpoint storage-agnostic |
| Medium | `src/app/api/search/accommodations/route.ts` | confirmed: endpoint returns page items plus `map_points` derived only from current page | Lines 75-111 calls catalog; lines 113-126 map points from current page; lines 148-150 no-store | Potentially confusing partial map data; duplicate responsibility with map endpoint | Keep contract but document/deprecate page-level map points later; rely on dedicated map endpoint |
| Medium | `src/app/api/search/excursions/route.ts` | confirmed: no explicit cache header and map points only from current page | Lines 58-112 full catalog; lines 114-128 map points from current page; response has no cache header | Repeat identical requests hit server; partial map semantics | Add cache policy if safe; separate map/list response responsibilities |
| Medium | `src/app/api/search/suggestions/route.ts` | confirmed: process-local source cache and row scans | Lines 124-129 limits; lines 179-189 rate limiter/cache; lines 1391-1527 scan rows and rank in memory | Cold-start or multi-instance bursts can hit DB repeatedly | Use shared cache/edge cache for popular; DB text prefix/trigram for active query |

Verification for Critical/High findings: enable Prisma query logging or `pg_stat_statements`, capture query count/duration for `/search?direction=housing`, `/search?direction=excursions`, `/transfers`, `/api/map/transfers`, one property detail and one excursion detail with production-like row counts. Compare p50/p95/p99 before any fix.

## 5. Database & Query Findings

| Severity | Model/table/query | Problem | Evidence | Index/query recommendation | Risk |
|---|---|---|---|---|---|
| Critical | `Property` catalog query | confirmed: many filters and ranking are applied after a broad `findMany` | `getPublicCatalog` lines 1921-1926 then JS filters/ranking/slice | SQL prefilter by visibility, location, type, bounds, price availability; use stored search vector/trigram candidate query | Ranking semantics can change; needs golden tests |
| Critical | `Excursion` catalog query | confirmed: SQL filters exist for some structured fields, but text/location/ranking still use 5000-row app loop | `getPublicExcursionCatalog` lines 1239-1256 build partial where; lines 1260-1330 fetch; lines 1498-1771 app filtering | Add DB/search-index candidate stage for text/location; composite indexes aligned with visibility + offer/category/district/price/date | Query complexity and index bloat |
| High | `Transfer` catalog query | confirmed: no pagination/candidate cap at DB layer | `db.transfer.findMany` lines 813-823 without `take` | Add `take`, structured `where`, indexed location/type/price/status fields; separate map select | May require API behavior review for total counts |
| High | Slug lookup for details | confirmed: slug is computed in app from display/snapshot and not directly indexed | Property/excursion/transfer slug lookup lines listed above | Persist canonical public slug and unique/composite index by visibility/location/slug; or search-slug table | Requires migration in future prompt |
| High | Geo/nearby queries | confirmed: nearby fetches up to 5000 and calculates distance in JS | `nearby-public.ts` lines 327-357 and 377-412 | Add bounding box predicates at minimum; consider PostGIS/earthdistance only if needed | Geospatial migration may be heavier; bounding box is low-risk |
| Medium | Text search indexes | confirmed: migrations add `pg_trgm` and expression trigram indexes, but catalog search does not primarily query them | Migrations `20260518133000_public_catalog_performance_indexes`, `20260614235532_search_map_indexes`; catalog uses `rankByTrigramWithScores` after fetch | Use SQL `ILIKE`/similarity or full-text candidate query matching the expression index; validate with `EXPLAIN ANALYZE` | Prisma may not express every index-friendly query cleanly |
| Medium | Map endpoints `contains` filters | hypothesis/needs EXPLAIN: Prisma `contains` can generate `ILIKE '%query%'` and may miss expression trigram indexes | `api/map/accommodations` buildMapWhere uses contains on name/location/address/type; `api/map/excursions` similar | Use raw SQL/search helper for trigram candidate IDs or align generated SQL with indexes | Must preserve injection safety |
| Medium | Detail includes reviews without `take` | confirmed: property/excursion detail includes all active reviews | Property include lines 2643-2656; excursion include lines 1996-2016 | Fetch first review page only; keep count; use existing reviews API for load more | SEO/UX may expect visible reviews; verify |
| Medium | Detail includes owner email/phone fields | confirmed: public detail include selects owner email; transfer include selects email/phone | Property lines 2610-2617; transfer lines 244-253; excursion owner lines 1986-1994 | Ensure mappers never expose private fields unintentionally; select only needed public contact fields | Security/privacy regression if not audited |
| Medium | Ranking stats query for all candidates | confirmed: ranking stats called with all candidate IDs | Property lines 1927-1931; excursion lines 1342-1348; transfer lines 865-869 | Precompute/denormalize listing stats, or request only fields needed for final candidate stage | Ranking behavior coupling |
| Low | Static attractions | confirmed: in-memory catalog over static data | `getStaticAttractionCatalog` uses all static rows and JS ranking/filtering | Accept while dataset is small; add budget/check if static catalog grows | Low current risk |

Existing indexes are a good start: `Property` has visibility/location/type/rating/geopoint indexes, `Excursion` has visibility/location/category/district/map/price indexes, and migrations add `pg_trgm`. The gap is not simply "missing indexes"; the larger issue is that the main catalog algorithms often do not let PostgreSQL use those indexes for final candidate reduction.

## 6. Frontend Findings

| Severity | File/component | Problem | Evidence | Expected impact | Suggested fix later |
|---|---|---|---|---|---|
| High | `src/components/public/excursion-search-results.tsx` | confirmed: very large monolithic client component with many responsibilities | File size about 157750 bytes; state/effects for filters, suggestions, map, mobile sheets, pagination; map/search effects lines 1667-1727 and 1877-1954 | Higher hydration and rerender risk; harder race/error reasoning | Split into filter state provider, list, map, suggestions, mobile sheet; memoize card rows |
| High | Excursion map interaction | confirmed: bounds interaction can trigger both map points and catalog search requests | `/api/map/excursions` effect lines 1667-1727; `/api/search/excursions` bounds search lines 1877-1954 | Duplicate network/server work while moving map | Decide one source of truth per interaction; debounce once and coalesce requests |
| Medium | `src/components/public/housing-catalog-client.tsx` | confirmed: request cancellation and sequence guards exist, but every filter/map change hits no-store API | Lines 365-439 map bounds fetch aborts/debounces; lines 459-535 filter request aborts and updates history | Good race protection, but server cost remains high; abort may not cancel completed DB work | Add shared client cache for recent queries and reduce server endpoint cost |
| Medium | `src/lib/api/search.ts#fetchAccommodationSearch` | confirmed: retries and 9s timeout on no-store search | Lines 108-115 `cache: "no-store"`, retries 2, timeout 9000 | Retries can amplify load when endpoint is slow | Use retries only for transient status/network, add server-side budgets |
| Medium | `src/components/public/excursion-search-results.tsx#handleLoadMore` | confirmed: load more uses bare `fetch`, no AbortController/retry/timeout, silent catch | Lines 1986-2013 | Poor UX on slow/failing network; stale update risk lower but possible on route changes | Match housing fetch helper pattern and show recoverable error |
| Medium | `HousingCatalogSearchCombobox` and suggestions UI | confirmed: client debounce/cache/AbortController exist | Housing combobox has 220ms debounce, cache TTL 8 min, abort; suggestions endpoint has min query length | This is mostly good; server-side source scan still needs optimization | Keep UX pattern; improve backend source/caching |
| Medium | Card images | confirmed: property card limits candidates and disables carousel preload | `PublicPropertySearchCard` slices image candidates to 4 and uses Next Image dimensions/quality | Good baseline, but old browser measurements still show many images on `/search` | Verify current browser waterfall; keep only visible/priority images eager |
| Medium | URL state | confirmed: housing manually uses `window.history.pushState/replaceState` | `HousingCatalogClient` lines 503-510 | Can diverge from Next router state if not carefully handled | Add popstate/e2e coverage; consider router transitions in future |
| Low | Loading/error states | confirmed: housing has toasts/loading; excursion map has fallback error; excursion load more silent | Various frontend code paths | Mixed UX quality | Normalize error/empty/loading behavior across verticals |

The frontend already does several things correctly: debounce, AbortController, request sequence guards, page-size caps, and lazy map imports. The biggest frontend opportunity is not "add debounce"; it is to reduce duplicated requests and split the heaviest components so hydration and rerenders stay bounded.

## 7. UX/Search Quality Findings

- **confirmed**: Search supports typo tolerance through trigram ranking and normalized token matching in application code.
- **confirmed**: Cyrillic/Latin transliteration is handled in several paths, including property search scoring and suggestions.
- **confirmed**: Suggestions skip one-character queries and cap query length, which protects UX and backend.
- **confirmed**: Housing filters preserve/share URL via query params, and client state updates URL manually.
- **confirmed**: Empty/partial data is handled in many places, but there is inconsistency: housing shows toasts; excursion load-more errors are silent; map failures show fallback text.
- **hypothesis**: Relevance can become unstable when the first 5000 `updatedAt desc` candidates do not include the best match. If relevant older listings fall outside the candidate pool, JS ranking never sees them.
- **hypothesis**: Location UX can be surprising because "nearby" expansion and exact location matches are mixed after broad fetch. This needs production query examples.
- **hypothesis**: Partial `map_points` in `/api/search/*` responses may confuse clients because dedicated map endpoints return a different set.
- **confirmed**: `/search` and `/rent` are dynamic/no-store, so Back/Forward and repeated URLs still recompute server data rather than using a stable cached page shell.

## 8. Bugs & Edge Cases

Likely test targets:

- Empty query with many filters: ensure it does not fetch/rank excessive rows beyond configured candidate limits.
- One-character query: suggestions skip it; catalog search behavior should be explicit and covered.
- Very long query and special characters: suggestions trims to 80 chars; catalog endpoints should have equivalent tests.
- Cyrillic/Latin mixed input: verify transliteration in housing, excursions, transfers, locations.
- Older but relevant listing outside first 5000 `updatedAt desc`: verify whether it can disappear from search.
- Property/excursion/transfer slug collision after slugify: current lookup picks first by `updatedAt desc`; canonical redirect behavior should be tested.
- Map bounds plus location filter: ensure bounds do not silently override location in a surprising way.
- Filters after page > 1: ensure page resets or clamps consistently.
- Objects without coordinates: map endpoints drop them; list should still behave predictably.
- Objects without price/images/category: cards and filters should not crash or hide incorrectly unless intended.
- Conflicting filters: e.g. minPrice > maxPrice, date range without availability, people > capacity.
- Fast map panning: ensure stale `/api/map/*` or `/api/search/*` responses cannot overwrite newer state.
- Slow network while load-more excursions: current bare fetch can hang longer than desired and errors are silent.
- Detail page with many reviews: current include fetches all active reviews; test payload and first render behavior.
- Private fields in public DTOs: owner email/phone are selected in backend includes; assert public API/components do not leak unintended fields.

## 9. Observability Gaps

What is missing for precise diagnosis:

- Per-route timing logs for `/search`, `/rent`, `/api/search/accommodations`, `/api/search/excursions`, `/api/search/suggestions`, `/api/map/*`, `/transfers`, detail pages.
- Prisma query count and duration per request, at least in staging with `PRISMA_LOG_QUERIES=true` or a structured query logger.
- PostgreSQL `pg_stat_statements` and slow query logs with normalized query text.
- `EXPLAIN (ANALYZE, BUFFERS)` for main property/excursion/transfer catalog queries, map queries, slug lookup, and nearby queries.
- Response payload metrics: raw JSON size, RSC/HTML size, item count, image URL count, nested relation counts.
- Browser performance budgets in Playwright: request count, image count, transferred bytes, LCP/INP proxy metrics where possible.
- Production search analytics: most common queries, filters, page depth, map interactions, no-result queries, autocomplete latency.
- Error monitoring grouped by endpoint and frontend action.
- Cache metrics: hit/miss for `unstable_cache`, suggestions source cache, response cache, and any CDN layer.

Without production/staging data, exact severity by latency is partly a hypothesis. The code evidence confirms scaling risk; actual priority should be validated with production-like row counts and traffic patterns.

## 10. Recommended Fix Plan For Next Prompt

### Phase 1 - Safe quick wins

| Item | Files to change later | Why | Expected effect | Risk | How to verify | Tests to add |
|---|---|---|---|---|---|---|
| Add lightweight timing/log wrappers around search endpoints | `src/app/api/search/*`, `src/app/api/map/*`, `src/app/search/page.tsx` | Need hard numbers before changing behavior | Faster diagnosis, no user-facing change | Low, but avoid noisy logs | Compare route timings/query counts in staging | Unit for log redaction if needed |
| Replace `/search` overview catalog calls with cheap aggregates | `src/app/search/page.tsx`, maybe new lib helper | Current overview calls full catalog with `pageSize: 1` | Lower TTFB on search page | Medium cache invalidation risk | Measure `/search` TTFB and query count | Search page tests for totals/price bounds |
| Add AbortController/timeout/error state to excursion load-more | `src/components/public/excursion-search-results.tsx` | Current load-more is bare fetch and silent catch | Better UX under slow network | Low | Simulate failed request | Component/unit test for retry-visible state |
| Cap initial detail reviews | `src/lib/public-properties.ts`, `src/lib/public-excursions.ts`, review components | Detail includes all active reviews | Smaller detail payload | Medium SEO/UX expectation | Payload size before/after | Detail tests with >100 reviews |
| Disable or batch search impression writes for non-critical paths | `src/lib/public-properties.ts`, analytics service | Read path performs write | Less DB write pressure | Medium ranking analytics impact | Compare DB writes per search | Ranking/analytics regression tests |

### Phase 2 - Backend/API optimization

| Item | Files to change later | Why | Expected effect | Risk | How to verify | Tests to add |
|---|---|---|---|---|---|---|
| Split list card DTO from heavy catalog row | `src/lib/public-properties.ts`, `src/lib/public-excursions.ts` | List needs fewer fields than detail/ranking source | Lower DB and serialization cost | High if DTO misses fields | Snapshot JSON payload diff | Contract tests for card fields |
| Build lightweight transfer map endpoint | `src/app/api/map/transfers/route.ts`, `src/lib/public-marketplace.ts` | Current transfer map uses full catalog | Large latency/payload reduction | Medium | Query count/payload for `/api/map/transfers` | Add test like `map-endpoints-lightweight.test.ts` |
| Coalesce excursion map/list bounds refresh | `src/components/public/excursion-search-results.tsx`, API usage | Map movement can trigger two endpoints | Less duplicate work | Medium UX coupling | Network waterfall during map pan | Playwright map interaction test |
| Normalize cache headers for search APIs where safe | `src/app/api/search/excursions/route.ts`, maybe suggestions | Some repeat requests are uncached | Lower repeat load | Medium if user-specific data appears | Header and CDN behavior | Route header tests |
| Make slug lookup cacheable | `public-properties`, `public-excursions`, `public-marketplace` | Slug scan grows linearly | Faster detail routes | Medium invalidation | Direct URL p95 | Slug redirect/collision tests |

### Phase 3 - Database/search optimization

| Item | Files to change later | Why | Expected effect | Risk | How to verify | Tests to add |
|---|---|---|---|---|---|---|
| Introduce DB/search candidate prefilter for property text search | `src/lib/public-properties.ts`, possibly raw SQL helper | Current trigram index is underused | Major TTFB/CPU reduction | High relevance drift | `EXPLAIN ANALYZE`, golden search results | Search relevance fixtures |
| Introduce DB/search candidate prefilter for excursions | `src/lib/public-excursions.ts` | Same 5000-row app ranking issue | Major TTFB/CPU reduction | High | `EXPLAIN ANALYZE`, result parity | Excursion search fixtures |
| Add bounded SQL filters for transfers | `src/lib/public-marketplace.ts` | Transfer query unbounded | Prevents future severe slowdown | Medium | Row count fetched per request | Transfer catalog tests |
| Add bounding-box prefilter for nearby | `src/lib/nearby-public.ts` | Nearby fetches 5000 and filters in JS | Faster detail pages | Low/Medium | Query duration and result parity | Nearby radius tests |
| Persist/index public slugs | Prisma schema/migration in a future prompt | Current slug lookup scans | O(1)/indexed detail lookup | High because migration/API behavior | Migration dry run, collision handling | Slug uniqueness tests |
| Decide PostgreSQL FTS/trigram vs external search | Architecture decision | Current DB may be enough if indexes are used | Avoid premature external engine | Medium | Benchmark common queries at target scale | Search benchmark suite |

### Phase 4 - Frontend optimization

| Item | Files to change later | Why | Expected effect | Risk | How to verify | Tests to add |
|---|---|---|---|---|---|---|
| Split `ExcursionSearchResults` | `src/components/public/excursion-search-results.tsx` | Monolith drives hydration/rerender risk | Better INP and maintainability | Medium | React profiler, bundle chunks | Interaction tests |
| Split map/list/filter responsibilities in marketplace catalogs | `marketplace-catalogs.tsx`, `marketplace-catalog-map.tsx` | Large components and map data coupling | Faster initial render | Medium | Bundle/resource counts | Catalog smoke tests |
| Add query-result client cache for recent filter states | Search client helpers/components | Back/Forward and toggles refetch no-store data | Better perceived speed | Medium stale data | Repeat navigation timings | Cache invalidation tests |
| Verify and tune image loading budget | Search cards/detail/gallery components | Old measurement showed many images | Better LCP/bandwidth | Low/Medium | Playwright resource count | Image priority tests |
| Normalize error/empty/loading states | Housing/excursion/marketplace clients | Inconsistent UX under failures | More stable UX | Low | Simulated API failures | Component tests |

### Phase 5 - Tests and monitoring

| Item | Files to change later | Why | Expected effect | Risk | How to verify | Tests to add |
|---|---|---|---|---|---|---|
| Add seeded high-volume performance fixtures | tests/scripts | Current unit tests do not reveal 5000-row behavior | Catch regressions | Medium setup cost | CI/staging perf run | Catalog perf tests |
| Add API payload size snapshots | `tests/unit` or integration | Overfetching can regress silently | Smaller stable contracts | Low | JSON byte budgets | Route contract tests |
| Add Playwright performance smoke | `tests/perf` or Playwright config | Need request/image/HTML budgets | Detect frontend regressions | Medium flake risk | Repeat 3-run median | `/search`, `/transfers`, `/attractions` |
| Add `EXPLAIN` baseline docs | `docs/` | DB optimization needs proof | Safer index/query work | Low | Stored explain output | Manual/staging checklist |
| Add production dashboards | Observability config | Need p95/p99 and slow query visibility | Faster incident diagnosis | Medium infra dependency | Dashboard checks | Alert rule tests if available |

## 11. Questions / Missing Information

- How many published properties, rooms, room prices, excursions, sessions, transfers and reviews exist in production?
- What are the p50/p95/p99 latencies for `/search`, `/api/search/*`, `/api/map/*`, `/transfers`, and detail pages?
- What are the top 100 search queries and filters by traffic?
- How often do users use map bounds search versus plain list search?
- What target performance budgets matter most: TTFB, LCP, INP, API p95, JSON size, or conversion from search to contact?
- Is production single-node self-hosted, serverless, or horizontally scaled? This changes in-process cache usefulness.
- Is CDN caching active for public API responses with `s-maxage`?
- Are `pg_stat_statements` and slow query logs available?
- Are there production examples where users report wrong/empty search results?
- Which languages/countries are intended beyond Russian/Crimea-focused search?
- Are owner phone/email fields intentionally available to public card/detail mappers, or should contact reveal be gated?
- Should search ranking prioritize newest, paid placement, relevance, fairness rotation, conversion, or a strict business rule?

## 12. Final Recommendation

Start the implementation prompt with the highest-impact, lowest-risk path: instrument and measure the current search endpoints, then remove duplicate overview catalog calls from `/search`, and build a lightweight transfer map endpoint using the already-tested pattern from accommodation/excursion map endpoints. In parallel, prepare DB-backed candidate prefiltering for `getPublicCatalog` and `getPublicExcursionCatalog`, but do not change ranking semantics without golden-result tests.

The strategic fix is to stop making the app server rank thousands of full objects for every page view. PostgreSQL trigram/full-text plus structured filters should produce a smaller candidate ID set; only then should application ranking and card enrichment run.

## Top 10 actions for the implementation prompt

1. Add route/query timing instrumentation for `/search`, `/api/search/*`, `/api/map/*`, `/transfers`, detail pages.
2. Replace `/search` overview catalog calls with cheap cached aggregate helpers.
3. Create a lightweight `/api/map/transfers` implementation that does not call `getPublicTransferCatalog`.
4. Add bounding-box prefiltering to `getNearbyProperties` and `getNearbyExcursions`.
5. Add timeout/abort/error handling to excursion load-more.
6. Cap initial detail reviews and load additional reviews through existing pagination APIs.
7. Build golden tests for housing/excursion relevance before moving search prefiltering into SQL.
8. Refactor property catalog query into candidate ID stage plus page-card enrichment stage.
9. Refactor excursion catalog query into candidate ID stage plus page-card enrichment stage.
10. Add Playwright/API performance smoke budgets for `/search`, `/transfers`, `/attractions`, and map interactions.
