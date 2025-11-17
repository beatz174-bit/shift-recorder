# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
COPY scripts ./scripts
# npm 10 (bundled with Node 20) does not understand workspace:* refs in our lockfile.
# Explicitly install npm 11 before running npm ci so workspaces resolve correctly.
RUN npm install -g npm@11.6.1
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
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
