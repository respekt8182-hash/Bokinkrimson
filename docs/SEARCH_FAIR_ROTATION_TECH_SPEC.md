# Search, Filters, Cards and Fair Rotation: Deep Analysis + Technical Specification

## 1. Purpose and Scope

Документ фиксирует:

- `AS-IS` анализ текущей реализации поиска жилья/экскурсий в проекте.
- `TO-BE` целевое ТЗ для разработки выдачи, фильтров, карточек, ранжирования и честной ротации.
- Пошаговый план внедрения без регрессий для текущей production-логики.

Охват:

- Публичный поиск: `/search`, `/rent`, `/excursions`.
- Детальные страницы: `/crimea/[location]/[slug]`, `/crimea/excursions/[location]/[slug]`.
- Search/API/map contracts.
- Ранжирование, fairness, аналитика событий, SEO, accessibility, DoD.

---

## 2. AS-IS Analysis (Current State in Repository)

### 2.1 What is already implemented well

1. Единая публичная страница поиска с ветвлением `housing | excursions`:
   - `src/app/search/page.tsx`
2. Отдельные сервисные доменные слои для выдач:
   - `src/lib/public-properties.ts`
   - `src/lib/public-excursions.ts`
3. Alias API-контракты поиска:
   - `src/app/api/search/accommodations/route.ts`
   - `src/app/api/search/excursions/route.ts`
4. Map endpoints и split-view жилья:
   - `src/app/api/map/accommodations/route.ts`
   - `src/app/api/map/excursions/route.ts`
   - `src/components/public/public-housing-results-with-map.tsx`
5. Сильная карточка жилья (визуал + инфо + цена + рейтинг + избранное):
   - `src/components/public/public-property-search-card.tsx`
6. Детальные страницы с богатым контентом и sticky-side UX:
   - `src/components/public/public-property-details.tsx`
   - `src/app/crimea/excursions/[location]/[slug]/page.tsx`

### 2.2 Current filters/sorts and ranking

Жилье (`getPublicCatalog`):

- Фильтры: локация, тип, даты, гости, `minPrice/maxPrice`, `minRating`, `hasPhotos`, `hasReviews`.
- Сортировки: `relevance`, `price_asc`, `price_desc`, `rating_desc`, `popular_desc`.
- Рейтинг по умолчанию = `catalogRank`:
  - `rating * 100 + log1p(reviewsCount) * 8 + daily_rotation(0..0.4)`.
  - Ежедневная ротация через ключ даты (`YYYY-MM-DD`).

Экскурсии (`getPublicExcursionCatalog`):

- Фильтры: локация, район, категория, даты, участники, формат, pickup, kids, радиус, `min/max price`, duration bucket, language, difficulty.
- Сортировки: `relevance`, `price_asc`, `price_desc`, `rating_desc`, `popular_desc`, `distance_asc`, `duration_asc`.
- `relevance` включает рейтинг, дистанцию, anchor/pickup match, доступность сеансов, текстовый match, completeness, daily rotation.

### 2.3 Gaps against target UX/product goals

1. Нет applied filters chips над выдачей с удалением в 1 клик.
2. Нет mobile drawer-фильтров с явным CTA `Показать N результатов`.
3. Нет фасетного ответа (`facets` + `counts`) на API.
4. Ротация есть, но только daily jitter, без:
   - 3-4h epoch rotation,
   - fairness budgets,
   - контроля экспозиции по 7d/weekly target.
5. Нет серверного event ingestion для:
   - impression,
   - click,
   - booking_start/complete,
   - filter/sort events.
6. Нет персистентных таблиц exposure/fairness метрик.
7. Нет прозрачного explain блока ранжирования в UI/partner.
8. В SEO нет стратегии faceted URL governance:
   - `robots.ts` разрешает `/search`,
   - нет canonicals/noindex для глубоких комбинаций фильтров.
9. Нет формализованного сохранения контекста SERP (scroll + state) как отдельного системного требования.

---

## 3. Target Product Requirements (TO-BE)

## 3.1 UX principles for search results

Для обоих сценариев (жилье/экскурсии) выдача должна:

1. Показывать ценность карточки сразу (фото, рейтинг, цена, ключевые атрибуты).
2. Показывать текущее состояние запроса (applied filters).
3. Давать быстрый контроль (remove chip, clear all, change dates/guests).
4. Быть стабильной в рамках сессии и в рамках rotation epoch.
5. Поддерживать возврат к SERP без потери контекста.

## 3.2 Filters behavior contract

Логика:

- Между группами фильтров: `AND`.
- Внутри мультивыбора одной группы: `OR`.

UI:

- Desktop: левый sticky filters panel.
- Mobile: drawer/modal:
  - `Применить (N)`,
  - `Сбросить`.
- Всегда: чипы примененных фильтров над выдачей + `Сбросить все`.

## 3.3 Mandatory sort options

Жилье:

- `recommended` (default),
- `price_asc`,
- `price_desc`,
- `rating_desc`,
- `distance_asc` (если доступны геоданные),
- `newest`.

Экскурсии:

- `recommended` (default),
- `price_asc`,
- `price_desc`,
- `rating_desc`,
- `duration_asc`,
- `newest`.

Примечание: текущие `relevance/popular_desc` остаются как совместимые alias на migration-период.

---

## 4. Cards and Details Requirements

## 4.1 HousingCard (list view)

Обязательные поля:

- Фото/галерея + favorite.
- Title + type + location (+ optional distance label).
- Rating + reviews count.
- 3-6 amenity chips.
- Price/night + total for selected stay.
- Условия: cancellation/payment notes (если доступны).
- CTA.
- Бейджи: `Новинка`, `Проверено`, `Скидка`, `Осталось мало` (по правилам).

## 4.2 TourCard (grid view)

Обязательные поля:

- Hero image + favorite.
- Category/tag badges.
- Title + 1-2 строки summary.
- Duration, group size, difficulty.
- Rating + reviews.
- Price per person (или формат group price).
- Trust labels: cancellation/transfer/etc.

## 4.3 Detail pages

Жилье:

- Галерея, sticky booking/sidebar, room variants, policies, amenities, map, reviews, similar.

Экскурсия:

- Описание/программа/include-exclude/важная инфо/meeting point/map.
- Sticky booking widget (date/time/participants/total/cancellation).

---

## 5. Fair Rotation and Ranking Specification

## 5.1 Design constraints

1. Полезность выдачи для пользователя остается первичной.
2. Новые и low-exposure объекты обязаны получать прогнозируемую долю показов.
3. Выдача не должна хаотично "прыгать".

## 5.2 Ranking pipeline (`sort=recommended`)

Шаг A. Hard filtering:

- даты, вместимость/участники, price range, location/category/etc.

Шаг B. Base score:

- text relevance,
- rating/reviews reliability,
- quality/completeness score,
- distance/date availability components.

Шаг C. Fairness adjustments:

- `exposure_penalty = f(impressions_7d)`,
- `new_item_boost = g(age_days)` (только при quality gate),
- optional supplier-cap penalty (anti-dominance).

Шаг D. Re-ranking with exploration slots:

- `80-90%` base-heavy slots,
- `10-20%` exploration slots from low-exposure/new candidates,
- deterministic shuffle by seed (см. ниже).

## 5.3 Rotation epoch contract

- `rotation_epoch = floor(now_utc / 4h)` (configurable to 3h).
- `seed = hash(rotation_epoch + query_signature + user_segment)`.
- Внутри одной epoch выдача детерминирована.
- На границе epoch происходит контролируемая ротация.

## 5.4 Session stability

При одинаковом `query_signature` и в пределах одной epoch пользователь получает тот же порядок (кроме изменения доступности/цены/жестких фильтров).

## 5.5 Fairness guardrails

Exploration-кандидаты допускаются только если:

- публикация/moderation status = опубликовано,
- минимум обязательных данных (title/description/media/location/price),
- quality_score выше порога,
- нет active moderation flags/complaints threshold breach.

---

## 6. Data Model Changes (Prisma)

Минимум для управляемой fairness-системы:

1. `SearchEvent`
   - `id`, `createdAt`, `entityType` (`PROPERTY|EXCURSION`), `entityId`
   - `eventType` (`IMPRESSION|CLICK|BOOKING_START|BOOKING_COMPLETE|FILTER_APPLY|FILTER_REMOVE|SORT_CHANGE`)
   - `position`, `searchSignature`, `rotationEpoch`, `sessionId`, `userId?`, `payload Json?`
   - индексы: `(eventType, createdAt)`, `(entityType, entityId, createdAt)`, `(searchSignature, createdAt)`

2. `ExposureDailyStat` (денормализованный агрегат)
   - `entityType`, `entityId`, `date`
   - `impressions`, `clicks`, `bookingStarts`, `bookingCompletes`
   - `ctr`, `cvr`
   - уникальный индекс: `(entityType, entityId, date)`

3. `RankingSettings`
   - exploration share, epoch hours, quality thresholds, new-item grace period, supplier caps.

4. (Опционально) в `Property` и `Excursion`:
   - `qualityScore Decimal @default(0)` (можно вычислять оффлайн без хранения на v1).

---

## 7. API Specification (v2, backward-compatible)

## 7.1 Search responses

`GET /api/search/accommodations` and `GET /api/search/excursions`

Добавить в response:

- `applied_filters[]` (UI-chips).
- `facets{}` with counts.
- `meta.ranking`:
  - `sort`,
  - `rotation_epoch`,
  - `explain_short` (для UI "О сортировке").

Сохранить текущие поля для совместимости: `items`, `total`, `page`, `page_size`, `total_pages`, `map_points`.

## 7.2 Analytics ingestion

`POST /api/events`

Payload:

- `event_type`,
- `entity_type`,
- `entity_id`,
- `position?`,
- `search_signature?`,
- `rotation_epoch?`,
- `session_id`,
- `payload?`.

Batch режим допускается на v2.1.

## 7.3 Admin/partner explainability

Новые endpoints:

- `GET /api/admin/ranking/settings`
- `PATCH /api/admin/ranking/settings`
- `GET /api/admin/ranking/exposure-report?entity_type=&period=7d`
- `GET /api/partner/ranking-summary?entity_type=&entity_id=`

---

## 8. Frontend Implementation Requirements

## 8.1 Search page

Для `src/app/search/page.tsx`:

1. Разделить верхнюю панель на:
   - SearchBar (location/dates/guests),
   - SortDropdown.
2. Вынести FiltersPanel:
   - desktop sidebar,
   - mobile drawer.
3. Добавить AppliedFiltersChips над results.
4. Добавить `О сортировке` (короткий explain).

## 8.2 Cards

Жилье:

- сохранить текущую сильную карточку как baseline,
- расширить правила бейджей данными fairness/newness,
- унифицировать CTA и pricing labels.

Экскурсии:

- перейти на grid-first presentation в выдаче,
- оставить list fallback для low-width/experimental toggle.

## 8.3 SERP context restore

Требование:

- при переходе в detail и обратно восстановить:
  - query params,
  - scroll position,
  - active map state (если был открыт split view).

Реализация:

- client store + `sessionStorage` keyed by `search_signature`.

---

## 9. SEO, Accessibility, Performance Requirements

## 9.1 SEO for faceted navigation

1. Определить индексируемые комбинации (whitelist):
   - базовые landing pages по location/category/district.
2. Для глубоких/технических комбинаций фильтров:
   - `noindex,follow` и/или canonical на основную страницу выдачи.
3. Пагинация должна иметь серверные URL.
4. Не полагаться только на infinite scroll.

## 9.2 Accessibility (WCAG 2.2 AA for key flows)

1. Доступность form controls:
   - корректные labels, focus styles, keyboard navigation.
2. Drawer/modal/date-picker:
   - focus trap,
   - Escape close,
   - aria attributes.
3. Карточки и интерактивные map controls:
   - keyboard reachable,
   - readable focus order.

## 9.3 Performance

Цели:

- быстрый TTFB на выдаче,
- LCP <= 2.5s (P75) для search pages,
- lazy media loading and map loading.

---

## 10. Definition of Done (Acceptance Criteria)

1. Applied filters всегда видны и снимаются в 1 клик.
2. Mobile filters drawer содержит:
   - `Показать N результатов`,
   - `Сбросить`.
3. `recommended` ранжирование:
   - стабильно в пределах 4h epoch,
   - имеет exploration slots,
   - логирует impression events.
4. В админке доступен weekly exposure report:
   - видно, попал ли объект/экскурсия в показы за 7 дней.
5. Детальная страница -> Back:
   - восстанавливаются фильтры, сортировка, скролл.
6. Search API возвращает `facets`, `applied_filters`, `meta.ranking`.
7. SEO правила faceted URLs внедрены (canonical/noindex policy).
8. Ключевые потоки проходят accessibility чек-лист AA.

---

## 11. Rollout Plan (Phased)

## Phase 1: Observability + Contracts (no UX break)

1. Prisma migrations:
   - `SearchEvent`, `ExposureDailyStat`, `RankingSettings`.
2. `POST /api/events`.
3. Search response extensions (`facets`, `applied_filters`, `meta.ranking`).
4. Impression logging on search results render.

Result:

- Данные для fairness доступны.

## Phase 2: UX Filters + Chips

1. Desktop FiltersPanel + AppliedFiltersChips.
2. Mobile drawer with apply/reset.
3. Unified sort UI + explain.

Result:

- Закрыты критичные UX gaps.

## Phase 3: Fair Re-ranking v1

1. Implement 4h epoch deterministic rotation.
2. Exploration slots + guardrails.
3. Exposure penalty/new item boost.
4. Admin exposure report.

Result:

- Контролируемая честная ротация без хаоса.

## Phase 4: SEO/A11y hardening

1. Faceted URL policy.
2. Canonical/noindex implementation.
3. A11y fixes and audits.
4. Performance tuning for LCP/INP.

---

## 12. Risks and Mitigations

1. Риск: деградация релевантности при агрессивной fairness.
   - Митигация: ограничить exploration 10-20%, A/B rollout, quality gates.

2. Риск: рост нагрузки из-за event logging.
   - Митигация: async/batched ingestion и daily aggregates.

3. Риск: SEO index bloat от faceted URLs.
   - Митигация: canonical/noindex + whitelist индексируемых landing pages.

4. Риск: "прыгающая" выдача.
   - Митигация: epoch-stability + deterministic seed.

---

## 13. Mapping to Current Codebase (Quick Reference)

Ключевые текущие точки расширения:

- Search page UI: `src/app/search/page.tsx`
- Housing ranking/domain: `src/lib/public-properties.ts`
- Excursion ranking/domain: `src/lib/public-excursions.ts`
- Search contract endpoints:
  - `src/app/api/search/accommodations/route.ts`
  - `src/app/api/search/excursions/route.ts`
- Map endpoints:
  - `src/app/api/map/accommodations/route.ts`
  - `src/app/api/map/excursions/route.ts`
- Housing card:
  - `src/components/public/public-property-search-card.tsx`
- Housing details:
  - `src/components/public/public-property-details.tsx`
- Excursion details:
  - `src/app/crimea/excursions/[location]/[slug]/page.tsx`
- Data model:
  - `prisma/schema.prisma`

---

## 14. Final Product Positioning (Short)

Целевая система выдачи должна быть одновременно:

1. Удобной для пользователя (быстрый и понятный выбор).
2. Предсказуемой по UX (stable SERP + clear filters).
3. Честной к поставщикам (управляемая экспозиция для новых и low-exposure карточек).
4. Технически управляемой (метрики, прозрачность, админ-настройки, DoD).
