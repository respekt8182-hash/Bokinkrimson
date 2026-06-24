# Third-party processors

Статус стран размещения требует подтверждения владельцем.

| Сервис | Назначение | Конфигурация | Страна/регион |
| --- | --- | --- | --- |
| YooKassa | Онлайн-оплата услуг платформы | `YOOKASSA_*` | TODO |
| Yandex Metrika | Аналитика после opt-in | счетчик в layout/cookie component | TODO |
| Yandex Maps / Geocoder | Карты и геокодинг | `src/lib/yandex-geocoder.ts`, map components | TODO |
| SMTP / nodemailer | Email-уведомления | `SMTP_*`, `EMAIL_DELIVERY_MODE` | TODO |
| S3-compatible storage | Файлы и медиа | `S3_*` | TODO |
| Upstash Redis | Rate limiting при настройке | `UPSTASH_REDIS_*` | TODO |
| Hosting / PostgreSQL | Приложение и база данных | deployment env | TODO |

До production владелец должен подтвердить фактические юрисдикции, договоры обработки и необходимость трансграничной передачи.
