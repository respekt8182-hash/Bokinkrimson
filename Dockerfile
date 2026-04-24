FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --include=dev

COPY . .

RUN npm run build
RUN chmod +x scripts/deploy/entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./scripts/deploy/entrypoint.sh"]
