FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --include=dev

COPY . .

ARG NEXT_PUBLIC_APP_URL="https://krymvokrug.ru"
ARG NEXT_PUBLIC_YANDEX_MAPS_API_KEY=""
ARG S3_PUBLIC_BASE_URL=""
ARG S3_ENDPOINT=""
ARG DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_YANDEX_MAPS_API_KEY=$NEXT_PUBLIC_YANDEX_MAPS_API_KEY
ENV S3_PUBLIC_BASE_URL=$S3_PUBLIC_BASE_URL
ENV S3_ENDPOINT=$S3_ENDPOINT

RUN BUILD_WITHOUT_DATABASE=1 DATABASE_URL="$DATABASE_URL" npm run build
RUN chmod +x scripts/deploy/entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./scripts/deploy/entrypoint.sh"]
