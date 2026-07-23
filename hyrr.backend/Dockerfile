# ─── Stage 1: Production dependencies only ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# ─── Stage 2: Full build ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target es2021 --esModuleInterop --skipLibCheck

# ─── Stage 3: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Use pre-installed prod deps from stage 1 (no npm install here)
COPY --from=deps    /app/node_modules          ./node_modules
# Overwrite with the Prisma-generated client from the full build
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/dist                  ./dist
COPY --from=builder /app/prisma                ./prisma

EXPOSE 3000
CMD ["node", "dist/main"]
