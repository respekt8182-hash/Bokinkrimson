# Accommodation registry audit

В проекте уже есть поля:

- `Property.classificationApplicable`;
- `Property.registryNumber`;
- `Property.registryNumberPending`;
- `Property.registryModerationSubmittedAt`;
- `Property.registryDetails`;
- `Property.selfAssessmentPassed`;
- админский маршрут `src/app/api/admin/properties/[id]/registry-moderation/route.ts`.

Требуемое правило: объект, для которого нужен реестр, нельзя публиковать без номера и ссылки/подтверждения. Кодовая часть должна проверять это на модерации, а владелец должен предоставить фактические номера. Нельзя подставлять фиктивные номера.

Добавлено:

- `Property.legalListingType`;
- `Property.registryId`;
- `Property.registryUrl`;
- `Property.registryStatus`;
- `Property.registryCheckedAt`;
- `Property.registryType`;
- `Property.registryCategory`;
- статус `REQUIRES_REGISTRY_REVIEW`;
- helper `src/lib/accommodation-registry.ts`;
- админская очередь `/admin/registry-review`.

Миграция переводит опубликованные карточки с `classificationApplicable = true` и неполными сведениями реестра в `requires_registry_review`.
