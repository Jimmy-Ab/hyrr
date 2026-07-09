FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY hyrr.jobseeker ./hyrr.jobseeker
COPY hyrr.shared ./hyrr.shared

# Install dependencies and build shared + jobseeker
RUN npm ci --include=dev
RUN npm run build --workspace=hyrr.jobseeker

# Stage 2: Serve using Nginx
FROM nginx:alpine
COPY --from=builder /app/hyrr.jobseeker/dist /usr/share/nginx/html

# Simple custom Nginx config to support SPA routing
RUN echo 'server { \
    listen 5174; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5174
CMD ["nginx", "-g", "daemon off;"]
