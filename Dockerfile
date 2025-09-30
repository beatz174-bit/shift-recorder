# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build for production (Vite will use .env.production automatically)
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# Nginx config
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Static site
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Simple healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
