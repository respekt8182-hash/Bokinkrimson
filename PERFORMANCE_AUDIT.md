# PERFORMANCE_AUDIT

Date: 2026-04-15

## Scope

Primary focus during this audit iteration:

- public housing search
- public excursions search
- property card opening from search
- excursion card opening from search

## Main Bottleneck Found

### PERF-001 Eager Yandex map preview loading in search results

- Area:
  - `src/components/public/public-housing-results-with-map.tsx`
  - `src/components/public/excursion-search-results.tsx`
- Root cause:
  - result pages embedded Yandex preview `iframe` widgets before user intent
- Why it mattered:
  - expensive third-party requests and map assets loaded on initial search render
  - extra network pressure before the user even asked to open the map

## Fix Applied

- Introduced lightweight local preview CTA component:
  - `src/components/maps/catalog-map-preview-card.tsx`
- Replaced eager `iframe` previews with deferred map activation.
- Real Yandex map viewer now initializes only after explicit click.

## Measured Result

### Housing search before opening map

- Page used only local app/image/static requests on initial load.
- DevTools network after fix:
  - `21` total requests
  - `0` Yandex map requests before map open

### Housing search after opening map

- DevTools network after explicit map open:
  - `71` total requests
  - Yandex API/tiles/coverage requests start only after the click

## Impact

- lower initial network load
- lower third-party script pressure on first render
- faster path to usable search list and cards
- better separation between “list browsing” and “map exploration”

## Other Performance Signals

- `npm run build` succeeds on current codebase
- property card open from search works after Playwright origin/config cleanup
- search/card smoke flows pass in Playwright

## Remaining Performance Work

- existing `eslint` warnings include a few `<img>` usage warnings in support chat; not addressed in this iteration
- no DB ownership access means deeper migration-backed query tuning was constrained by compatibility mode
- no formal Lighthouse trace/report was captured in this pass

## Conclusion

The highest-value, user-visible performance issue found in this audit pass was fixed: map-heavy third-party traffic is now deferred until the user explicitly opens the map.
