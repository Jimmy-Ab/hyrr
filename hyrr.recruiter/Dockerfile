FROM node:22-alpine AS builder
WORKDIR /app

# Build-time API endpoints baked into the bundle by Vite
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_SOCKET_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
# Optional: Cloudflare Turnstile site key and Sentry DSN (features stay off when empty)
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_SENTRY_DSN=
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Copy every workspace manifest first so `npm ci` can resolve the root lockfile
# (and this layer stays cached until dependencies change)
COPY package.json package-lock.json ./
COPY hyrr.shared/package.json ./hyrr.shared/
COPY hyrr.recruiter/package.json ./hyrr.recruiter/
COPY hyrr.jobseeker/package.json ./hyrr.jobseeker/
COPY hyrr.admin/package.json ./hyrr.admin/
COPY hyrr.backend/package.json ./hyrr.backend/
# Install only what this app needs (root + shared + recruiter), not the backend's heavy deps.
# Retries + a BuildKit cache make flaky networks survivable and rebuilds fast.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_MAXSOCKETS=8 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --ignore-scripts --include-workspace-root \
      --workspace=hyrr.shared --workspace=hyrr.recruiter

# Then only the sources this app needs
COPY tsconfig*.json ./
COPY hyrr.shared ./hyrr.shared
COPY hyrr.recruiter ./hyrr.recruiter
RUN npm run build --workspace=hyrr.recruiter

# Stage 2: Serve using Nginx
FROM nginx:alpine
COPY --from=builder /app/hyrr.recruiter/dist /usr/share/nginx/html

# SPA routing + gzip + long-lived caching for hashed assets
RUN printf '%s\n' \
  'server {' \
  '    listen 5173;' \
  '    root /usr/share/nginx/html;' \
  '    index index.html;' \
  '' \
  '    gzip on;' \
  '    gzip_comp_level 6;' \
  '    gzip_min_length 1024;' \
  '    gzip_vary on;' \
  '    gzip_types text/plain text/css application/javascript application/json image/svg+xml application/manifest+json;' \
  '' \
  '    location /assets/ {' \
  '        expires 1y;' \
  '        add_header Cache-Control "public, max-age=31536000, immutable";' \
  '        try_files $uri =404;' \
  '    }' \
  '' \
  '    location = /index.html {' \
  '        add_header Cache-Control "no-cache";' \
  '    }' \
  '' \
  '    location / {' \
  '        try_files $uri $uri/ /index.html;' \
  '    }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
