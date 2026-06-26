FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo@2.9.14
WORKDIR /app
COPY . .
RUN turbo prune --scope=promotion --docker

FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.1.2 turbo@2.9.14
WORKDIR /app
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN turbo run build --filter=promotion...

FROM node:22-alpine AS production-deps
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.1.2
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runner
RUN apk add --no-cache ca-certificates
WORKDIR /app/apps/services/promotion
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nestjs
USER nestjs

COPY --from=installer /app/apps/services/promotion/package.json ./package.json
COPY --from=installer /app/apps/services/promotion/dist ./dist
COPY --from=installer /app/packages/contracts/package.json /app/packages/contracts/package.json
COPY --from=installer /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=production-deps /app/apps/services/promotion/node_modules ./node_modules

EXPOSE 4041 4042

CMD ["node", "dist/main"]
