# ─── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Prevent socket flooding, memory spikes, and hanging in Docker Desktop
ENV NPM_CONFIG_MAXSOCKETS=5
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY prisma ./prisma/
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target es2021 --esModuleInterop --skipLibCheck

# Prune devDependencies to optimize production image
RUN npm prune --omit=dev --legacy-peer-deps

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules          ./node_modules
COPY --from=builder /app/dist                  ./dist
COPY --from=builder /app/prisma                ./prisma

EXPOSE 3000
CMD ["node", "dist/main"]
