# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune --scope=admin --docker

# Add lockfile and package.json's of isolated subworkspace
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.1.2
WORKDIR /app

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV
ARG VITE_APP_VERSION
ARG VITE_COMMIT_SHA
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_COMMIT_SHA=$VITE_COMMIT_SHA
RUN pnpm turbo run build --filter=admin...

FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=installer /app/apps/admin/dist .
# Copy custom nginx config
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]
