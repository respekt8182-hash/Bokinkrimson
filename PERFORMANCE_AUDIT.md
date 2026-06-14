# Performance Audit

Date: 2026-06-15
Project: `boking`, Next.js 16.1.6 / React 19.2.3 / App Router / Prisma / Tailwind CSS 4.

Important constraint: this pass is audit-only. Application code was not changed. Only this report was updated.

## 1. Краткое резюме

Сайт ощущается медленным не из-за одной маленькой ошибки, а из-за сочетания тяжелых динамических каталогов, крупных client components, большого общего CSS и насыщенных карт/галерей. Production build проходит, но Next/Turbopack прямо предупреждает о слишком широких динамических file patterns, которые матчят десятки тысяч файлов и могут ухудшать build/server bundling. На сервере самые дорогие зоны - `/search`, жилье, экскурсии, досуг и трансферы: данные выбираются широко, затем фильтруются, ранжируются, сортируются, считают цены/дистанции/снимки в памяти. На клиенте самые тяжелые зоны - `HomeSearchShowcase`, `HousingCatalogClient`, `ExcursionSearchResults`, `MarketplaceCatalogs`, `PublicHousingResultsWithMap`, `MarketplaceCatalogMap`, `PublicPropertyDetails`, `YandexMapMultiViewer`, редакторы и шахматка.

Проверенный production-прогон показал: `/search` отдает около 721 KB raw HTML за 1241 ms через `Invoke-WebRequest`, `/attractions` около 776 KB за 608 ms, главная около 240 KB за 786 ms. В браузере gzip/transfer ниже, но `/search` все равно грузит 74 request, `/attractions` 71 request, главная 56 request и 27 изображений. CSS production chunk - 462106 bytes, крупнейшие JS chunks - 299038, 223553, 216476, 168382 bytes. Самый быстрый прирост дадут: уменьшение initial payload каталогов, перенос части серверной фильтрации/сортировки в БД или кешируемые materialized/snapshot данные, дробление монолитных client components, снижение общего CSS и отложенная загрузка галерей/карт/модалок.

## 2. Карта сайта и проверенные зоны

### Найденные page routes

Public:
- `/`
- `/about`
- `/attractions`
- `/attractions/[slug]`
- `/auth/forgot-password`
- `/auth/login`
- `/auth/register`
- `/auth/reset-password`
- `/consent`
- `/cooperation`
- `/crimea/[location]`
- `/crimea/[location]/[slug]`
- `/crimea/excursions/[location]/[slug]`
- `/excursions`
- `/excursions/[location]`
- `/excursions/category/[category]`
- `/excursions/district/[district]`
- `/favorites`
- `/legal/privacy`
- `/legal/terms`
- `/oferta`
- `/rent`
- `/rozigrash`
- `/search`
- `/tours`
- `/transfers`
- `/transfers/[slug]`
- `/uslugi-i-tarify`

Dashboard:
- `/dashboard`
- `/dashboard/chessboard`
- `/dashboard/excursions`
- `/dashboard/excursions/[id]`
- `/dashboard/excursions/[id]/external-reviews`
- `/dashboard/favorites`
- `/dashboard/objects`
- `/dashboard/objects/[id]`
- `/dashboard/objects/[id]/about`
- `/dashboard/objects/[id]/amenities`
- `/dashboard/objects/[id]/chessboard`
- `/dashboard/objects/[id]/contracts-reports`
- `/dashboard/objects/[id]/external-reviews`
- `/dashboard/objects/[id]/payment`
- `/dashboard/objects/[id]/room-categories`
- `/dashboard/objects/[id]/rooms`
- `/dashboard/objects/[id]/rules`
- `/dashboard/payments`
- `/dashboard/profile`
- `/dashboard/requests`
- `/dashboard/reviews`
- `/dashboard/transfers`
- `/dashboard/transfers/[id]`
- `/dashboard/transfers/[id]/external-reviews`

Admin:
- `/admin`
- `/admin/admins`
- `/admin/applications`
- `/admin/attractions`
- `/admin/attractions/[id]`
- `/admin/attractions/new`
- `/admin/attractions/reports`
- `/admin/excursions`
- `/admin/excursions/[id]`
- `/admin/excursions/[id]/external-reviews`
- `/admin/excursions/[id]/settings`
- `/admin/excursions/new`
- `/admin/help`
- `/admin/login`
- `/admin/messages`
- `/admin/moderation`
- `/admin/moderation/[id]`
- `/admin/moderation/excursions`
- `/admin/moderation/excursions/[id]`
- `/admin/objects`
- `/admin/objects/[id]`
- `/admin/objects/[id]/about`
- `/admin/objects/[id]/amenities`
- `/admin/objects/[id]/chessboard`
- `/admin/objects/[id]/external-reviews`
- `/admin/objects/[id]/room-categories`
- `/admin/objects/[id]/rules`
- `/admin/objects/new`
- `/admin/password-resets`
- `/admin/payments`
- `/admin/phone-verification`
- `/admin/profile`
- `/admin/renewals`
- `/admin/reviews`
- `/admin/statistics`
- `/admin/support-chat`
- `/admin/transfers`
- `/admin/transfers/[id]`
- `/admin/transfers/[id]/external-reviews`
- `/admin/users`
- `/admin/users/[id]`

### Зоны и компоненты

| Route / вкладка / раздел | Основной компонент | Что происходит при открытии | Потенциальные проблемы | Риск |
|---|---|---|---|---|
| `/` | `src/app/page.tsx`, `HomeSearchShowcase`, `PopularPropertiesSectionServer` | Сервер собирает города, локации, статистику, карточки достопримечательностей; клиент гидратирует большой поисковый виджет | 162 KB client component, много state/effect, 14 месяцев календаря, typewriter, dropdowns, 27 images in browser run | High |
| `/search?direction=housing` | `SearchPage`, `HousingCatalogClient`, `PublicHousingResultsWithMap` | `noStore`, server catalog fetch, потом клиентские фильтры, карта, подгрузка, popstate | 721 KB raw HTML, broad DB fetch + in-memory ranking, повторные `/api/search/accommodations`, тяжелый map/list shell | Critical |
| `/search?direction=excursions` and `/excursions*` | `ExcursionSearchResults` | Серверный каталог экскурсий + клиентский фильтр/карта/мобильный sheet | 156 KB client component, десятки state/effect, broad DB fetch up to 5000 rows, map points fetch | Critical |
| `/attractions` | `AttractionCatalog`, `MarketplaceCatalogMap`, `AttractionCatalogClient` | Каталог досуга из static/data + directory | 776 KB raw HTML, 71 browser requests, map/filter shell, large static payload | High |
| `/transfers` | `TransferCatalog`, `MarketplaceCatalogMap` | Две выборки: pageSize 30 и mapResult pageSize 5000 | map data до 5000 объектов сразу, ранжирование/фильтр в памяти | High |
| `/crimea/[location]/[slug]` | `PublicPropertyDetails`, `PropertyMediaGallery`, reviews/nearby | Детальная карточка жилья, галереи, комнаты, отзывы, контакты | 135 KB component, много state, eager gallery previews, тяжелый HTML при богатых объектах | High |
| `/crimea/excursions/[location]/[slug]` | excursion detail page + galleries/timeline | Детальная экскурсия с программой, фото, сессиями, отзывами | очень крупная page file 166 KB, много text/media serialization | High |
| `/favorites` | `LocalFavoritesPage` | localStorage + fetch favorite cards | клиентская загрузка, local cache без глобального cache layer | Medium |
| `/dashboard/*` | `DashboardAppShell`, editors/managers | Авторизованные рабочие зоны, редиректы без сессии | тяжелые редакторы, много форм и fetch, support chat может монтироваться на нескольких dashboard routes | High |
| `/admin/*` | `AdminShell`, admin pages/editors | Админская навигация, уведомления, таблицы, редакторы | missing hook dependency warning, polling/notifications, большие редакторы без route-level/lazy дробления | High |

## 3. Критические проблемы

### PERF-001: Каталоги жилья и экскурсий делают широкий DB fetch и тяжелое in-memory ранжирование

- Severity: Critical
- Файлы: `src/lib/public-properties.ts`, `src/lib/public-excursions.ts`
- Компонент/функция: `getPublicCatalog`, `getPublicExcursionCatalog`
- Что не так: `public-properties.ts` сам помечает, что fine-grained ranking/sorting applied in memory around lines 1917-1924. `public-excursions.ts` делает `db.excursion.findMany` with `take: 5000` around lines 1202-1272, затем pipeline hard filters, scoring, sort, slice around lines 1329-1704.
- Почему тормозит: сервер вынужден сериализовать и обработать гораздо больше строк/relations, чем нужно для одной страницы выдачи. Чем больше объектов, комнат, цен, сессий и отзывов, тем дороже каждый фильтр и переход.
- Как проявляется: `/search` raw HTML 721212 bytes / 1241 ms; browser wall 2664 ms, 74 requests. Каталог фильтров делает повторные запросы при изменениях.
- Доказательства: production build ok; HTTP замер `/search`: 1241 ms, 721212 bytes; code comments and `take: 5000` in `public-excursions.ts`.
- Эффект от исправления: сильное снижение TTFB, меньше CPU на сервере, меньше HTML/RSC payload.
- Рекомендация без внесения изменений: вынести часть фильтров/сортировок в SQL, хранить catalog snapshot/search index, считать price/ranking summary заранее, ограничивать candidate set до ранжирования.

### PERF-002: `/search` принудительно dynamic/noStore и дополнительно делает overview-запросы

- Severity: High
- Файл: `src/app/search/page.tsx`
- Компонент/функция: `SearchPage`
- Что не так: `dynamic = "force-dynamic"`, `revalidate = 0`, `noStore()`. Для excursions выполняются `getPublicExcursionCatalog(...)` и `getPublicExcursionCatalog({ pageSize: 1 })`; для housing - `getPublicCatalog(...)` и при location еще overview `getPublicCatalog({ pageSize: 1 })`.
- Почему тормозит: даже повторный переход на похожий URL не использует Next cache; overview удваивает часть серверной работы.
- Как проявляется: переходы между вкладками/фильтрами не ощущаются мгновенными, потому что серверная часть каждый раз считается заново.
- Доказательства: `src/app/search/page.tsx` lines 21-23, 187-221, 278-317.
- Эффект от исправления: быстрее повторные переходы, меньше DB pressure.
- Рекомендация: отделить SEO/cacheable catalog shell от personalized/dynamic counters, кешировать directory/overview отдельно, использовать `unstable_cache`/tagged cache там, где данные не персональные.

### PERF-003: Монолитные client components создают большую стоимость hydration и rerender

- Severity: High
- Файлы: `src/components/home/home-search-showcase.tsx`, `src/components/public/excursion-search-results.tsx`, `src/components/public/marketplace-catalogs.tsx`, `src/components/public/public-property-details.tsx`
- Компонент/функция: `HomeSearchShowcase`, `ExcursionSearchResults`, `MarketplaceCatalogs`, `PublicPropertyDetails`
- Что не так: файлы 92-162 KB с десятками `useState`, `useEffect`, `useMemo`, DOM effects, timers, map state, dropdown state, mobile sheet state в одной клиентской границе.
- Почему тормозит: любое изменение фильтра/таба/карты затрагивает крупный React subtree, увеличивает JS parse/evaluate/hydration и усложняет memoization.
- Как проявляется: задержка между кликом и визуальной реакцией на вкладках/фильтрах, особенно mobile sheet, карта, дата/гости.
- Доказательства: file size list: `home-search-showcase.tsx` 162238, `excursion-search-results.tsx` 156364, `public-property-details.tsx` 135440, `marketplace-catalogs.tsx` 92084.
- Эффект от исправления: меньше initial JS и меньше synchronous render work.
- Рекомендация: split by interaction zones: search form, date picker, guests, map shell, list, mobile sheet, modal/gallery; lazy-load rarely opened panels.

### PERF-004: Большой общий CSS chunk и дорогие paint effects

- Severity: High
- Файл: `src/app/globals.css`
- Компонент/функция: global CSS
- Что не так: production CSS chunk `9a008570150b17cf.css` = 462106 bytes. В CSS много `backdrop-filter`, `filter: blur`, `box-shadow`, анимаций и `transition: all`.
- Почему тормозит: большой CSS блокирует/замедляет style calculation; blur/backdrop/filter/large shadows дороги на low/mid devices и усиливают jank при overlay/map/modal transitions.
- Как проявляется: субъективные "фризы" при открытии модалок, галерей, mobile sheets, фильтров.
- Доказательства: chunk size; `globals.css` lines 1113, 1175, 1363, 1464, 1556, 1663, 3142, 3153; animations around 2289, 2338, 2781.
- Эффект от исправления: быстрее first paint/style, меньше GPU/compositor pressure.
- Рекомендация: разбить CSS по зонам, убрать `transition: all`, ограничить backdrop blur, добавить бюджет на blur/shadow for catalog/mobile overlays.

### PERF-005: Map subsystems перегружены состоянием, запросами и viewport effects

- Severity: High
- Файлы: `src/components/public/public-housing-results-with-map.tsx`, `src/components/public/marketplace-catalog-map.tsx`, `src/components/public/excursion-search-results.tsx`, `src/components/maps/yandex-map-multi-viewer.tsx`
- Компонент/функция: `PublicHousingResultsWithMap`, `MarketplaceCatalogMap`, `ExcursionSearchResults`, `YandexMapMultiViewer`
- Что не так: карты lazy-loaded, но shell вокруг карты все равно большой: map points, bounds, viewed markers, mobile sheet, hover sync, `requestAnimationFrame`, timers, remote point refresh.
- Почему тормозит: при движении/открытии карты меняются bounds and active state, запускаются debounce/fetch/recompute markers.
- Как проявляется: задержки при открытии карты, изменении области карты, переключении list/map на мобильном.
- Доказательства: dynamic map import in `public-housing-results-with-map.tsx` lines 97-100; map points fetch around 709-787; `YandexMapMultiViewer` script loader lines 210-259; `excursion-search-results.tsx` renders map viewer in multiple branches around 3413+.
- Эффект от исправления: плавнее map open and pan/zoom, меньше повторных API calls.
- Рекомендация: виртуализировать/кластеризовать markers before rendering, keep map component mounted across tabs, memoize stable point arrays, throttle bounds commits more aggressively.

### PERF-006: `/transfers` сразу готовит map dataset до 5000 элементов

- Severity: High
- Файл: `src/app/transfers/page.tsx`
- Компонент/функция: `TransferCatalog`
- Что не так: страница параллельно запрашивает catalog pageSize 30 и mapResult pageSize 5000 with `allowLargePageSize: true`.
- Почему тормозит: даже если пользователь смотрит список, сервер готовит карту на тысячи объектов.
- Как проявляется: рост TTFB/HTML/RSC при наполнении базы трансферов.
- Доказательства: `src/app/transfers/page.tsx` lines 52-66.
- Эффект от исправления: меньше server work and payload on initial list.
- Рекомендация: грузить map points endpoint после user intent or viewport, отдавать только id/lat/lng/price summary, не полные карточки.

### PERF-007: Изображения и галереи дают высокий request count и eager pressure

- Severity: High
- Файлы: `HomeSearchShowcase`, `PublicPropertySearchCard`, `PropertyMediaGallery`, `PublicPropertyDetails`
- Компонент/функция: image blocks/galleries
- Что не так: главная загрузила 27 img resources; `/search` 38 img resources; property gallery использует несколько `loading="eager"` preview images; часть `<img>` остается в detail/support-chat.
- Почему тормозит: сеть и decode конкурируют с JS/CSS; много картинок увеличивают LCP/INP risk.
- Как проявляется: первый экран долго "дособирается", карточки/галереи могут задерживать интерактивность.
- Доказательства: Playwright resource counts; `property-media-gallery.tsx` lines 133, 153, 188, 229, 269, 319, 340, 379; lint warnings for support chat `<img>`.
- Эффект от исправления: быстрее LCP/less bandwidth, особенно mobile.
- Рекомендация: eager только для одного LCP image, остальные lazy; thumbnails via fixed small sizes; avoid rendering all gallery controls before interaction.

### PERF-008: RootShell делает весь layout route-aware client shell

- Severity: Medium
- Файл: `src/components/layout/root-shell.tsx`
- Компонент/функция: `RootShell`
- Что не так: shell uses `usePathname` and `useSearchParams` globally and wraps header/footer/children slots for every route.
- Почему тормозит: это не гидратирует все children напрямую, но добавляет обязательную client boundary and route recalculation to every page.
- Как проявляется: каждый переход обновляет chrome rules, mobile nav visibility, support chat condition.
- Доказательства: `root-shell.tsx` lines 2, 5, 39-64.
- Эффект от исправления: modest but broad reduction in common client work.
- Рекомендация: keep server layout mostly static; isolate only route-aware chrome toggles into small client components.

### PERF-009: Detail pages serialize/render too much rich content at once

- Severity: High
- Файлы: `src/components/public/public-property-details.tsx`, `src/app/crimea/excursions/[location]/[slug]/page.tsx`, `src/lib/public-properties.ts`, `src/lib/public-excursions.ts`
- Компонент/функция: property/excursion details
- Что не так: большие detail components, many rooms/media/reviews/sections, external review merge, rich excursion timeline/itinerary sanitization.
- Почему тормозит: HTML/RSC grows with object richness; client state controls many independent sections in one component.
- Как проявляется: открытие карточки из поиска может ощущаться тяжелым, особенно на объектах с комнатами/фото/отзывами.
- Доказательства: `public-property-details.tsx` 135440 bytes; excursion detail page 166995 bytes; public property include has media/reviews/rooms around `public-properties.ts` 2591+.
- Эффект от исправления: faster card open and less hydration work.
- Рекомендация: render critical hero/contact/summary first, lazy-load reviews/nearby/gallery lightbox/room details below fold.

### PERF-010: Build warnings about broad dynamic file patterns

- Severity: Medium
- Файлы: `src/app/sitemap.ts`, `src/lib/nearby-public.ts`, `src/lib/public-excursions.ts`, `src/lib/storage.ts`
- Компонент/функция: file existence / stat helpers
- Что не так: Turbopack reports file patterns matching 22886 files in project root, 13764 files under public, 19512 files under public/uploads.
- Почему тормозит: может ухудшать build performance and over bundling; warning прямо указывает на риск.
- Как проявляется: build-time overhead; potential server bundle bloat.
- Доказательства: `npm run build` warnings on `sitemap.ts:118`, `nearby-public.ts:72`, `public-excursions.ts:501`, `storage.ts:355`.
- Эффект от исправления: faster builds, smaller traced server dependencies.
- Рекомендация: avoid dynamic `path.join(process.cwd(), ...dynamicParts)` in bundled paths; route through storage manifest, explicit base helpers, or runtime-only untraced IO boundary.

## 4. Проблемы переходов между вкладками/страницами

Самые медленные потенциальные переходы:
- Home direction tabs inside `HomeSearchShowcase`: переключают search mode, date/guests behavior, dropdown suggestions; вся логика живет в одном крупном component.
- `/search` housing <-> excursions/tours: меняется серверный branch and full client component (`HousingCatalogClient` vs `ExcursionSearchResults`), данные грузятся заново because `noStore`.
- Catalog list <-> map: map component lazy, but map shell state and points refresh live in large parent.
- Filters/date/guests in catalogs: UI reacts locally, then triggers network refresh and replaces list; perceived delay is visible when request overlaps with map bounds or suggestions.
- Dashboard/admin section switches: route-level navigation remounts large editor/managers; some editors are 90-280 KB source files.

Лишнее remount/mount:
- `ExcursionSearchResults` renders `YandexMapMultiViewer` in multiple branches for desktop/mobile/expanded states; even with dynamic import, state orchestration is duplicated.
- `HomeSearchShowcase` mounts a lot of dormant logic for date, guests, mobile flow, suggestions, typewriter and hero visuals.
- Dashboard/admin routes mount full feature managers instead of lazy subpanels for rarely used tabs.

Где данные грузятся заново:
- `/search` explicitly `noStore`.
- `HousingCatalogClient` calls `fetchAccommodationSearch` for filter changes, map bounds, page changes.
- `ExcursionSearchResults` calls `/api/search/excursions` and `/api/map/excursions`.
- `PublicHousingResultsWithMap` calls `/api/map/accommodations`.
- Home suggestions call `/api/search/suggestions`.

Prefetch/lazy/caching opportunities:
- Prefetch small route JS for top nav/hub pages on idle.
- Cache directory data: locations, categories, districts, popular suggestions, active counts.
- Lazy-load date picker, guests editor, map shell, gallery lightbox, review panels, support chat internals.
- Keep list skeleton stable during server/client refresh, and show immediate optimistic filter chip state.

## 5. Проблемы повторных рендеров

Likely hot rerender zones:
- `HousingCatalogClient`: `filters`, `toasts`, `mapBoundsFilter`, `isRefreshing`, `newItemIds`, `locationLabel` cause the catalog filter bar and results/map shell to receive new props. Memo helps only if props are stable; `filters` object changes often.
- `PublicHousingResultsWithMap`: map points, hover/active states, refs, mobile map state can rerender list/map coordination.
- `ExcursionSearchResults`: many independent state variables in one component; changing one filter can rerender filter panel, cards, map shell and mobile sheet.
- `HomeSearchShowcase`: dropdown, recent search, date panel, guests panel, typewriter and mobile search state are colocated.
- `PublicPropertyDetails`: room/gallery/contact/mobile modal states are colocated with large detail markup.
- `AdminShell`: lint warning says `useEffect` is missing dependency `refreshNotifications`; this can hide stale closure or unintended refresh behavior.

Где нужна memoization:
- Stable arrays/maps passed to card lists and map components: points, active ids, filter chips, dropdown options.
- Card components where only favorite/image hover changes.
- Derived catalog summaries (`activeChips`, map points, search dropdown options).

Где memoization не решит проблему:
- `getPublicCatalog` / `getPublicExcursionCatalog` server CPU and DB work.
- Large single client components where unrelated states remain colocated.
- Heavy CSS paint/compositing.
- Huge HTML/RSC payload from server routes.

## 6. Проблемы загрузки данных

Duplicating/waterfall risks:
- `/search` does main catalog plus overview catalog call.
- `/transfers` does list catalog plus map catalog pageSize 5000.
- Map bounds refresh can overlap with filter refresh; code uses abort controllers, but user still experiences loading churn.
- Suggestions fetches are debounced, but results are local to component and not shared across pages.
- External reviews compatibility mode appears during build logs, adding fallback complexity.

Cache gaps:
- No global client cache layer like SWR/React Query is present.
- `noStore` disables route caching for `/search`.
- Directory data and popular suggestions are good candidates for stable cache.

Blocking requests:
- Initial catalog server render blocks page response.
- Map points are deferred but still coupled to map UI opening and bounds updates.

Heavy client processing:
- Search/filter components parse URL params, build option lists, compute map points, manage scroll restoration and view state.
- Cards compute image candidates and preload logic per card.

Load early:
- Critical first 12-30 cards summary, one LCP image, filter labels, total count.

Load later:
- Map points, non-visible gallery images, reviews beyond first slice, nearby sections, support chat history, admin notifications details.

## 7. Bundle / JavaScript / зависимости

Heavy dependencies and imports:
- Next/React baseline.
- `@tabler/icons-react` is imported through `src/components/ui/lucide-react.ts`, which re-exports many icons. Need analyzer to confirm tree-shaking output.
- `lucide-react` is used directly in many components; usually tree-shakable, but widespread icon imports still add chunks.
- Yandex map SDK is runtime-loaded by `YandexMapMultiViewer`; good that it is dynamic/ssr false, but component code around it is still large.
- Prisma/server libs are extensive; broad file pattern warnings suggest tracing/bundling attention is needed.

Measured production chunks:
- CSS: `.next/static/chunks/9a008570150b17cf.css` = 462106 bytes.
- Largest JS chunks: 299038, 223553, 216476, 168382, 123863, 112594, 111301 bytes.
- No bundle analyzer script exists in `package.json`.

Where code splitting is needed:
- `HomeSearchShowcase`: date picker, guests editor, mobile search wizard, suggestions dropdown.
- `ExcursionSearchResults`: map, mobile map sheet, filters, card list, suggestion dropdown.
- `MarketplaceCatalogs`: attraction/transfer-specific catalog branches.
- `PublicPropertyDetails`: gallery lightbox, rooms expanded details, reviews, lead modal.
- Admin/dashboard editors: `excursion-editor.tsx`, `property-chessboard-workspace.tsx`, `room-fund-manager.tsx`, `transfer-editor-page.tsx`, `object-wizard.tsx`.

## 8. UI, CSS, анимации, изображения

Heavy UI/CSS:
- Multiple `backdrop-filter` values between blur(8px) and blur(26px).
- Many big shadows and `transition: all`.
- Global CSS includes many feature-specific blocks, producing a 462 KB production CSS chunk.
- Animation-heavy home/catalog/gallery/admin UI can compete with input handling on weaker devices.

Layout shift risks:
- Dynamic map/list shells and mobile sheets adjust height after viewport measurements.
- Image galleries and cards need consistently reserved dimensions; some `<img>` usages bypass Next image sizing.

Images:
- Browser run: `/` loaded 27 images, `/search` 38 images, `/attractions` 35 images.
- `PropertyMediaGallery` has several eager preview images; only the true LCP image should be eager.
- Next image config is good overall: AVIF/WebP, cache TTL, device sizes.

Fonts:
- `next/font/google` with Manrope and Yeseva One is good: self-hosted build pipeline, no external font fetch at runtime.

## 9. Приоритизированный план исправлений

| Приоритет | Проблема | Файл/зона | Почему важно | Сложность | Ожидаемый эффект | Риск |
|---|---|---|---|---|---|---|
| P0 | Broad DB fetch + in-memory ranking | `public-properties.ts`, `public-excursions.ts` | Главная причина server latency on `/search` | High | Major TTFB and CPU reduction | Ranking semantics can change |
| P0 | `/search` noStore + duplicate overview calls | `src/app/search/page.tsx` | Every transition recomputes catalog | Medium | Faster repeat navigation | Cache invalidation must be correct |
| P0 | Split monolithic catalog clients | `HousingCatalogClient`, `ExcursionSearchResults` | Directly affects click/input responsiveness | High | Better INP/perceived speed | More component boundaries |
| P1 | Reduce initial map data | `/transfers`, map components | Avoid pageSize 5000 before user intent | Medium | Lower payload/server work | Map needs loading state |
| P1 | Cut CSS payload and paint effects | `globals.css` | 462 KB CSS and expensive effects | Medium | Faster style/paint, smoother overlays | Visual regressions |
| P1 | Image loading budget | home/search/detail galleries | High request count and eager images | Medium | Better LCP/bandwidth | Need careful priority tuning |
| P1 | Lazy-load detail subpanels | property/excursion detail | Faster card open from search | Medium | Lower hydration and initial payload | SEO content decisions |
| P2 | Narrow file-system patterns | sitemap/storage/public-excursions | Build warnings and possible over-bundling | Medium | Faster build/server trace | Storage path edge cases |
| P2 | Add bundle analyzer script later | `package.json` / Next config | Need real route chunk attribution | Low | Better prioritization | Adds dev dependency |
| P2 | Admin/dashboard editor splitting | dashboard/admin components | Improves authenticated UX | High | Faster internal navigation | Editor state boundaries |
| P3 | Micro-memoization of chips/options | catalog UI | Helpful after splitting | Low | Small rerender reduction | Over-memoization noise |

## 10. Что НЕ нужно оптимизировать прямо сейчас

- Fonts are already handled through `next/font`; this is not a primary bottleneck.
- Yandex map SDK itself is already dynamically loaded with `ssr:false`; the bigger issue is map shell state/data, not the fact of dynamic import.
- Do not add generic `useMemo/useCallback` everywhere. It will not fix server catalog CPU or monolithic state ownership.
- Do not focus first on tiny icon components until analyzer confirms icon chunk cost.
- Do not rewrite all images blindly; prioritize first-screen and eager gallery images.
- Do not optimize static legal/about pages before catalogs, details and dashboard/admin working surfaces.

## 11. Рекомендации для следующего промпта на исправление

Suggested task list for the next AI agent:

1. Optimize `/search` server data flow: remove duplicate overview catalog calls or cache them; keep SEO data separate from personalized/dynamic data.
2. Refactor `getPublicCatalog` and `getPublicExcursionCatalog` to reduce candidate rows before in-memory ranking. Preserve ranking behavior with tests.
3. Split `ExcursionSearchResults` into smaller memoized/lazy components: filter panel, results list, map stage, mobile sheet, suggestions.
4. Split `HomeSearchShowcase`: lazy-load calendar/guests/mobile wizard/suggestions; keep first render to visible hero/search fields.
5. Change `/transfers` map dataset to lazy endpoint after map open; initial page should load only list pageSize 30.
6. Reduce CSS payload: move feature CSS closer to feature routes, replace `transition: all`, limit `backdrop-filter` and blur-heavy animations.
7. Audit first-screen images: only one priority/eager image per route; make gallery previews lazy except visible LCP tile.
8. Fix Turbopack broad file pattern warnings by replacing dynamic file path checks with manifest/runtime storage helpers.
9. Add a non-invasive bundle analyzer script in a separate change, then re-run production build to attribute largest chunks by route.
10. Add Playwright performance smoke for `/`, `/search`, `/attractions`, `/transfers`: record resource count, transfer size, domInteractive and navigation time budgets.

## Проверенные команды и результаты

- `npm run build`: success. Compile 15.8s. Generated static pages: 118. Warnings: 4 broad file patterns.
- `npm run lint`: success with 8 warnings, 0 errors.
- `next start -p 3001`: ready in 1405 ms.
- HTTP checks via `Invoke-WebRequest`:
  - `/`: 200, 786 ms, 240464 raw bytes.
  - `/search`: 200, 1241 ms, 721212 raw bytes.
  - `/excursions`: 200, 180 ms, 87843 raw bytes.
  - `/transfers`: 200, 179 ms, 85517 raw bytes.
  - `/attractions`: 200, 608 ms, 775866 raw bytes.
  - `/favorites`: 200, 157 ms, 72922 raw bytes.
  - `/dashboard`: 307 redirect, 25 ms.
  - `/admin`: 307 redirect, 14 ms.
- Playwright Chromium production navigation:
  - `/`: wall 2776 ms, TTFB 33 ms, domInteractive 451 ms, 56 requests, 27 images.
  - `/search`: wall 2664 ms, TTFB 30 ms, domInteractive 670 ms, 74 requests, 38 images.
  - `/excursions`: wall 1295 ms, TTFB 21 ms, domInteractive 83 ms, 63 requests, 31 images.
  - `/transfers`: wall 1101 ms, TTFB 20 ms, domInteractive 69 ms, 61 requests, 30 images.
  - `/attractions`: wall 1551 ms, TTFB 50 ms, domInteractive 163 ms, 71 requests, 35 images.

## Непроверенное / ограничения

- Lighthouse trace was not captured.
- React Profiler flamegraph was not captured.
- No production database scale test was run; current local dataset may be smaller than real production.
- Bundle analyzer is absent, so chunk-to-route attribution is approximate.
- Repository has no `.git` directory in this workspace, so no git diff/status validation was possible.
