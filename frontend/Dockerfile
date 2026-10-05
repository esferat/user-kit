FROM node:22-alpine AS build
WORKDIR /app

# Configuration is baked in at build time, because Vite inlines VITE_* variables
# into the bundle. Pass them as build arguments, see docker-compose.yml.
# The bundle carries no identity provider settings: the backend owns the login and
# tells the frontend which methods it offers.
ARG VITE_API_BASE_URL=
ARG VITE_UI5_THEME=sap_horizon
ARG VITE_DEV_ROLE=user
ARG VITE_DEFAULT_LOCALE=ru

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
    CMD ["sh", "-c", "wget -qO- http://127.0.0.1/ >/dev/null || exit 1"]
