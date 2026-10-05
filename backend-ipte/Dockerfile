# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.17.0

# Single environment for build + runtime
FROM node:${NODE_VERSION}-bookworm-slim

# App directory and runtime config
WORKDIR /usr/src/app
ENV PORT=4000

# System packages needed for node-gyp/Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install JS dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy sources and build, then prune dev deps
COPY . .
RUN npm run prisma:generate \
  && npm run build \
  && npm prune --omit=dev \
  && rm -rf ~/.npm /tmp/*

# Drop privileges for runtime
ENV NODE_ENV=production
RUN useradd -m nodeuser && chown -R nodeuser:nodeuser /usr/src/app
USER nodeuser

EXPOSE 4000
CMD ["node", "dist/server.js"]
