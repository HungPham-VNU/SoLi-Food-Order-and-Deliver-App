FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/services/review/package.json apps/services/review/package.json
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false

FROM deps AS build
COPY packages/contracts packages/contracts
COPY apps/services/review apps/services/review
RUN pnpm --filter @uitfood/contracts build && pnpm --filter review build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/services/review
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/services/review /app/apps/services/review
CMD ["node", "dist/main"]
