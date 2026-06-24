# Legal configuration

Основной файл: `src/config/legal.ts`.

В нем хранятся:

- реквизиты владельца-самозанятого;
- режим платформы `LEAD_DIRECTORY`;
- запрет оплаты проживания;
- статус НПД и текст про НДС;
- страна/регион основной базы данных;
- версии юридических документов;
- список платных услуг платформы;
- список сторонних обработчиков.

Production validation выполняется функцией `assertLegalConfigForProduction()`. Она должна падать в production, если остались заглушки, включена оплата проживания, не указан адрес для претензий, не заполнены ФИО/ИНН/email/страна БД или версии документов.

Известные незаполненные значения после аудита:

- `owner.claimsPostalAddress`;
- `personalData.rknNotificationNumber`;
- `personalData.primaryDatabaseCountry`;
- `personalData.primaryDatabaseRegion`.

До заполнения этих значений production-сборка должна считаться заблокированной.

## Доменные модули

- `src/lib/legal-consents.ts` - evidence согласий с версией, URL, IP, User-Agent и категориями.
- `src/lib/accommodation-registry.ts` - правила публикации объектов, требующих записи в реестре.
- `src/lib/npd-receipts.ts` - интерфейс `NpdReceiptProvider` и ручной fallback без имитации интеграции с "Мой налог".
- `src/lib/refunds.ts` - предварительная формула возврата для периодических услуг.
