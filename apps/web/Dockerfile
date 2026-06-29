# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune --scope=web --docker

# Add lockfile and package.json's of isolated subworkspace
FROM node:24-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.1.2
WORKDIR /app

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false

# Build the project
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV
ARG VITE_APP_VERSION
ARG VITE_COMMIT_SHA
ARG VITE_GRAFANA_FARO_COLLECTOR_URL
ARG VITE_GRAFANA_FARO_APP_NAME
ARG GRAFANA_FARO_SOURCEMAP_ENDPOINT
ARG GRAFANA_FARO_APP_ID
ARG GRAFANA_CLOUD_STACK_ID
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_COMMIT_SHA=$VITE_COMMIT_SHA
ENV VITE_GRAFANA_FARO_COLLECTOR_URL=$VITE_GRAFANA_FARO_COLLECTOR_URL
ENV VITE_GRAFANA_FARO_APP_NAME=$VITE_GRAFANA_FARO_APP_NAME
ENV GRAFANA_FARO_SOURCEMAP_ENDPOINT=$GRAFANA_FARO_SOURCEMAP_ENDPOINT
ENV GRAFANA_FARO_APP_ID=$GRAFANA_FARO_APP_ID
ENV GRAFANA_CLOUD_STACK_ID=$GRAFANA_CLOUD_STACK_ID
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
RUN --mount=type=secret,id=grafana_faro_sourcemap_api_key,required=false \
  export GRAFANA_FARO_SOURCEMAP_API_KEY="$(cat /run/secrets/grafana_faro_sourcemap_api_key 2>/dev/null || true)" && \
  pnpm turbo run build --filter=web...

FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=installer /app/apps/web/dist .
# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]
