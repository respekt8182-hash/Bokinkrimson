# Search Marketplace Roadmap (Crimea)

## Purpose
Этот документ фиксирует реализацию ТЗ по поиску и выдаче жилья/экскурсий по этапам, чтобы команда могла внедрять изменения итеративно без деградации текущего продукта.

Подробная спецификация (AS-IS + TO-BE + fairness rotation): `docs/SEARCH_FAIR_ROTATION_TECH_SPEC.md`

## Status Snapshot
- `Done (this iteration)`:
  - Контрактные alias-endpoints:
    - `GET /api/search/accommodations`
    - `GET /api/search/excursions`
    - `GET /api/map/accommodations`
    - `GET /api/map/excursions`
  - В каталогах добавлены координаты в карточки выдачи (`latitude/longitude`) для синхронизации списка и карты.
  - На главной unified-форме поиска включено localStorage-восстановление последнего поиска:
    - направление (`housing` / `excursions`)
    - локация/поисковая строка
    - даты
    - состав гостей
  - Антиспам отзывов переведен на глобальный лимит `1 отзыв / 24 часа` на пользователя (429 + `Retry-After` + `nextAllowedAt`).

- `Partially done`:
  - Ротация выдачи уже есть в домене (`daily rotation`), но не реализовано окно `5-6h` и fairness-политика с weekly target в `Top-K`.
  - Каталог и фильтры присутствуют, но часть фильтров из ТЗ пока не покрыта в UI/API.

- `Not done yet`:
  - Полный режим moderation workflow для отзывов `PENDING -> APPROVED/REJECTED`.
  - Рейтинг с шагом `0.5` на уровне хранения/агрегации (`rating_half`).
  - Ленивая и интерактивная карта на странице выдачи (`Показать на карте`, кластеры, синхронизация hover/click).
  - Полный набор сортировок и explainable-recommendation бейджей.
  - Сохранение “последнего поиска” в профиль пользователя (сейчас только localStorage).

## Next Recommended Phases
1. `Reviews moderation hardening`
   - расширить `ReviewStatus` до `PENDING/APPROVED/REJECTED`
   - вынести approve/reject в admin API
   - пересчет рейтинга только по `APPROVED`
2. `Rating model v2`
   - перейти на `rating_half (1..10)`
   - half-star UI в карточках и карточке объекта/экскурсии
3. `Search relevance + fairness`
   - окно ротации `6h`
   - `fairness_boost` + weekly impressions target по сегментам
4. `Map UX rollout`
   - lazy preview-map
   - полноэкранный/side-panel режим
   - кластеры и bidirectional sync list <-> map
5. `Extended filters`
   - price/rating/amenities/location-distance для жилья
   - format/duration/theme/language/included для экскурсий
