# ─── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Prevent socket flooding, memory spikes, and hanging in Docker Desktop
ENV NPM_CONFIG_MAXSOCKETS=5
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
# Survive flaky networks (ECONNRESET) instead of failing the whole build
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --legacy-peer-deps

COPY prisma ./prisma/
COPY . .
RUN npx prisma generate
RUN npm run build
# Compiled seed so `npx prisma db seed` works without ts-node (see prisma/seed-runner.js)
RUN npm run build:seed

# Prune devDependencies to optimize production image
RUN npm prune --omit=dev --legacy-peer-deps

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

COPY package*.json ./
COPY --from=builder /app/node_modules          ./node_modules
COPY --from=builder /app/dist                  ./dist
COPY --from=builder /app/prisma                ./prisma

# Uploads live on a volume (see docker-compose.yml); pre-create it with the right owner.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 3000
CMD ["node", "dist/main"]
