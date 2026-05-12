# Деплой на Ubuntu VPS (`krymvokrug.ru`)

Этот проект уже подготовлен под одиночный VPS на Ubuntu через `Docker Compose`:

- `PostgreSQL` поднимается в контейнере `db`
- приложение `Next.js + Prisma` поднимается в контейнере `app`
- `Caddy` работает как reverse proxy и сам выпускает HTTPS-сертификат для `krymvokrug.ru`
- локальные загрузки сохраняются в docker volumes и не теряются при пересборке контейнера

## Что уже добавлено в проект

- [Dockerfile](/d:/Bokinkrimson-master/Dockerfile)
- [compose.prod.yml](/d:/Bokinkrimson-master/compose.prod.yml)
- [deploy/Caddyfile](/d:/Bokinkrimson-master/deploy/Caddyfile)
- [scripts/deploy/up.sh](/d:/Bokinkrimson-master/scripts/deploy/up.sh)
- [scripts/deploy/install-docker-ubuntu.sh](/d:/Bokinkrimson-master/scripts/deploy/install-docker-ubuntu.sh)
- [scripts/hash-admin-password.mjs](/d:/Bokinkrimson-master/scripts/hash-admin-password.mjs)
- [src/app/api/health/route.ts](/d:/Bokinkrimson-master/src/app/api/health/route.ts)

## 1. DNS до запуска

На стороне регистратора/панели DNS создайте записи:

- `A` для `krymvokrug.ru` на IP вашего VPS
- `A` для `www.krymvokrug.ru` на тот же IP

Важно:

- дождитесь, пока DNS действительно начнёт резолвиться на VPS
- в Reg.ru Cloud откройте входящие порты `80` и `443`
- если включён `ufw`, откройте `22`, `80`, `443`

Пример:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Подготовка сервера

Подключитесь по SSH и установите Docker:

```bash
ssh root@YOUR_SERVER_IP
cd /opt
git clone <ваш-репозиторий> krymvokrug
cd krymvokrug
bash scripts/deploy/install-docker-ubuntu.sh
```

После установки Docker переподключитесь по SSH.

Если репозиторий вы копируете не через `git clone`, а через `scp`/архив, просто положите проект на сервер, например в `/opt/krymvokrug`.

## 3. Подготовка production env

Скопируйте шаблон:

```bash
cd /opt/krymvokrug
cp .env.production.example .env.production
```

Сгенерируйте hash для админ-пароля:

```bash
node scripts/hash-admin-password.mjs "VeryStrongAdminPassword123!"
```

И подставьте значения в `.env.production`.

Минимально обязательно заполнить:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_JWT_SECRET`
- `CRON_SECRET`
- `ACME_EMAIL`

Для этого проекта базовые production значения уже заданы:

- `NEXT_PUBLIC_APP_URL="https://krymvokrug.ru"`
- `CSRF_TRUSTED_ORIGINS="https://krymvokrug.ru https://www.krymvokrug.ru"`
- `RATE_LIMIT_MODE="memory"` для одного VPS-инстанса
- `SECURITY_EMAIL_DELIVERY_MODE="log"` чтобы запуск не зависел от SMTP

Если позже подключите внешние сервисы, можно дополнительно заполнить:

- `S3_*` для объектного хранилища
- `SMTP_*` и `SECURITY_EMAIL_FROM` для реальной отправки security email
- `UPSTASH_REDIS_*` и `RATE_LIMIT_MODE="upstash"` если захотите вынести rate-limit из памяти

Если `S3_*` пустые, проект использует локальное хранение в volumes:

- `uploads_data`
- `private_storage_data`

## 4. Первый запуск

Запуск:

```bash
cd /opt/krymvokrug
bash scripts/deploy/up.sh
```

Проверка логов:

```bash
bash scripts/deploy/logs.sh
```

Если всё прошло нормально, откройте:

- `https://krymvokrug.ru`
- `https://krymvokrug.ru/api/health`

Ожидаемый ответ healthcheck:

```json
{"status":"ok","service":"krymvokrug","timestamp":"..."}
```

## 5. Обновление проекта

После нового коммита на сервере:

```bash
cd /opt/krymvokrug
git pull
bash scripts/deploy/up.sh
```

Команда пересоберёт контейнер приложения, применит `Prisma`-миграции и перезапустит сервис.

## 6. Полезные команды

Статус контейнеров:

```bash
docker compose --env-file .env.production -f compose.prod.yml ps
```

Логи только приложения:

```bash
docker compose --env-file .env.production -f compose.prod.yml logs -f app
```

Остановить проект:

```bash
docker compose --env-file .env.production -f compose.prod.yml down
```

Перезапустить без полной пересборки:

```bash
docker compose --env-file .env.production -f compose.prod.yml up -d
```

## 7. Что важно помнить

- `Caddy` выпустит HTTPS-сертификат только если `krymvokrug.ru` и `www.krymvokrug.ru` уже смотрят на этот VPS и порты `80/443` доступны снаружи
- `DATABASE_URL` в `.env.production` должен использовать хост `db`, а не `localhost`, потому что приложение работает в Docker-сети
- если включите `S3`, новые файлы пойдут туда; если не включите, загрузки останутся в docker volumes
- `RATE_LIMIT_MODE="memory"` подходит для одного VPS. Для нескольких реплик лучше переключиться на `upstash`
