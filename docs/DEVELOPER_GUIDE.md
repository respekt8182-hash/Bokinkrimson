# Developer Guide

## Назначение

Этот документ — карта ответственности модулей проекта `Boking` для разработчиков.
Используйте его как первый ориентир: что за что отвечает и куда идти при изменениях.

## Архитектура по слоям

1. `UI / Pages`  
   `src/app/*` и `src/components/*` — экраны, формы, таблицы, рабочие панели.
2. `Domain / Services`  
   `src/lib/*` — бизнес-правила, сериализация, валидация, интеграции, security.
3. `Persistence`  
   `prisma/schema.prisma` + `prisma/migrations/*` — структура данных и эволюция БД.
4. `Operations / Docs`  
   `README.md`, `docs/*` — запуск, релиз, внутренняя документация.

## Структура проекта

- `src/app/`
  - `api/` — серверные route handlers (owner/admin/public/auth/payments/geocode).
  - `dashboard/` — личный кабинет владельца/организатора.
  - `admin/` — отдельный админ-интерфейс.
  - `crimea/`, `search/` — публичные страницы каталога и карточек.
  - `auth/`, `legal/` — авторизация и legal-страницы.
- `src/components/`
  - `objects/` — мастер карточки объекта (`ObjectWizard`).
  - `rooms/` — номерной фонд и полноэкранная шахматка занятости/цен.
  - `payments/` — панель оплаты и статусов платежей.
  - `excursions/` — редактор экскурсии и связанные экраны.
  - `applications/`, `reviews/`, `media/`, `forms/`, `layout/`, `ui/` — feature/UI-блоки.
- `src/lib/`
  - `schemas.ts` — входные контракты API (Zod).
  - `properties.ts`, `rooms.ts`, `pricing.ts`, `occupancy.ts`, `payments.ts`, `reviews.ts`, `excursions.ts` — ядро домена.
  - `public-properties.ts`, `public-excursions.ts` — read-модели публичного каталога.
  - `auth.ts`, `session.ts`, `security.ts`, `rate-limit.ts` — безопасность и сессии.
  - `storage.ts`, `yandex-geocoder.ts`, `yookassa.ts` — внешние интеграции.
- `prisma/`
  - `schema.prisma` — единый источник правды по моделям.
  - `migrations/*` — история изменений БД.
- `tests/` — unit + integration.
- `e2e/` — Playwright critical flows.

## Ключевые зоны ответственности

### Объекты размещения

- UI мастера: `src/components/objects/object-wizard.tsx`
- API мастера: `src/app/api/properties/[id]/route.ts`
- Прогресс шагов и сериализация: `src/lib/properties.ts`

Текущее правило потока:
- шаги 1-8 заполняются в мастере;
- шаг 9 — номерной фонд;
- шаг 10 — цены из полноэкранной шахматки;
- оплата доступна только после готовности шага 10.

### Номерной фонд и шахматка

- Управление номерами: `src/components/rooms/room-fund-manager.tsx`
- Полноэкранная шахматка: `src/components/rooms/property-chessboard-workspace.tsx`
- Настройки удобств категорий: `src/components/rooms/room-amenities-manager.tsx`
- API настроек удобств: `src/app/api/properties/[id]/room-amenities/route.ts`
- API занятости: `src/app/api/properties/[id]/rooms/[roomId]/occupancy/*`
- API цен: `src/app/api/properties/[id]/rooms/[roomId]/prices/*`
- Доменные типы: `src/lib/occupancy.ts`, `src/lib/pricing.ts`

Практическое правило:
- `room-fund-manager` отвечает только за категории/вместимость/санузлы/медиа;
- удобства категории (`featureIds`, платность, охват по категориям) редактируются только через `room-amenities-manager`;
- `rooms` API оставляет поля `featureIds/customFeatures` для совместимости контрактов.

### Оплата

- Экран оплаты: `src/components/payments/property-payment-panel.tsx`
- API оплаты: `src/app/api/properties/[id]/payments/route.ts`
- API quote: `src/app/api/properties/[id]/payments/quote/route.ts`
- Интеграция YooKassa: `src/lib/yookassa.ts`

### Экскурсии

- Редактор: `src/components/excursions/excursion-editor.tsx`
- Owner API: `src/app/api/excursions/*`
- Public API: `src/app/api/public/excursions/*`
- Сериализация/агрегаты: `src/lib/excursions.ts`, `src/lib/public-excursions.ts`

### Админка

- UI: `src/app/admin/*`
- API moderation: `src/app/api/admin/*`
- RBAC/guard: `src/lib/admin-auth.ts`

## Паттерн внесения изменений

При добавлении нового поля/правила соблюдайте цепочку:

1. `prisma/schema.prisma`
2. migration (`npm run db:migrate` или `db:deploy`)
3. сериализация в `src/lib/*`
4. входная валидация в `src/lib/schemas.ts`
5. API route (`src/app/api/*`)
6. UI (`src/components/*`, `src/app/*`)
7. тесты (`tests/*`, при необходимости `e2e/*`)

## Частые точки входа

- Новые правила прогресса мастера: `src/lib/properties.ts`
- Новая логика шахматки: `src/components/rooms/property-chessboard-workspace.tsx`
- Новые ограничения данных API: `src/lib/schemas.ts`
- Новая интеграция внешнего сервиса: `src/lib/*` + `src/app/api/*`
- Изменение публичной выдачи: `src/lib/public-properties.ts`, `src/lib/public-excursions.ts`

## Файлы с расширенными inline-комментариями

- `src/components/layout/dashboard-app-shell.tsx` — устройство shell, drawer и polling навигации.
- `src/components/layout/dashboard-sidebar.tsx` — контекст объекта и переключение между разделами.
- `src/components/rooms/room-amenities-manager.tsx` — группировка удобств, локальные draft-состояния и сохранение.
- `src/components/rooms/property-chessboard-workspace.tsx` — карта занятости/цен и drag-сценарии.
- `src/app/api/properties/[id]/route.ts` — поведение GET/PATCH/DELETE для карточки объекта.

## Проверка перед PR

```bash
npm run lint
npm run test
npm run build
```

Опционально e2e:

```bash
npm run test:e2e -- --list
```
