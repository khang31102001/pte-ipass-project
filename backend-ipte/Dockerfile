# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.17.0

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION}-bookworm-slim
WORKDIR /usr/src/app
ENV NODE_ENV=production PORT=4000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/package.json ./package.json
RUN useradd -m nodeuser && mkdir -p storage && chown -R nodeuser:nodeuser /usr/src/app
USER nodeuser
EXPOSE 4000
# Áp dụng migration (idempotent) rồi chạy server. Bí mật/DB URL chỉ qua biến môi trường.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
