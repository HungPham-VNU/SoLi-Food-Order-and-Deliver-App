FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo@2.9.14
WORKDIR /app
COPY . .
RUN turbo prune --scope=api --docker

# Add lockfile and package.json's of isolated subworkspace
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.1.2 turbo@2.9.14
WORKDIR /app

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN turbo run build --filter=api...

FROM node:22-alpine AS production-deps
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.1.2
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runner
RUN apk add --no-cache ca-certificates
WORKDIR /app/apps/api
ENV NODE_ENV=production

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nestjs
# Render mounts secret files at /etc/secrets with group 1000 access.
RUN addgroup nestjs node
USER nestjs

COPY --from=installer /app/apps/api/package.json ./package.json
COPY --from=installer /app/apps/api/dist ./dist
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=production-deps /app/apps/api/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "--require", "./dist/telemetry", "dist/main"]
