# TEST RUN GUIDE

## Prerequisites

| Tool           | Where it runs                           |
| -------------- | --------------------------------------- |
| Docker Desktop | Local machine, for PostgreSQL and Redis |
| Node.js >= 20  | Local machine                           |
| pnpm           | Local machine                           |

## 1. Start local infrastructure

From the repo root:

```bash
docker compose up -d
```

Expected containers:

```text
food_order_db     localhost:5432
food_order_redis  localhost:6379
```

## 2. Local E2E database isolation

Local E2E tests reset database state, so they must not use the normal
development database (`food_order_db`).

The test runner uses `TEST_DATABASE_URL` when it is set. If it is not set, local
non-CI runs derive a dedicated test database from `DATABASE_URL`:

```env
DATABASE_URL=postgresql://food_order:foodordersecret@localhost:5432/food_order_db
# local E2E derives:
TEST_DATABASE_URL=postgresql://food_order:foodordersecret@localhost:5432/food_order_test
```

The derived or configured test database name must include `test` or `e2e`.

To override the default locally, create `apps/api/.env.test.local`:

```env
TEST_DATABASE_URL=postgresql://food_order:foodordersecret@localhost:5432/food_order_e2e
```

## 3. Prepare the local test database

From `apps/api`:

```bash
pnpm run db:test:prepare
```

This command:

1. Loads local env files.
2. Creates the dedicated test database if it does not exist.
3. Runs `drizzle-kit push` against the test database.
4. Ensures the search extensions (`unaccent`, `pg_trgm`) are installed.

`pnpm run test:e2e` runs this preparation step automatically for local
development and skips it when `CI=true` or `GITHUB_ACTIONS=true`.

## 4. Run E2E tests

From `apps/api`:

```bash
pnpm run test:e2e
```

Run one spec:

```bash
pnpm run test:e2e --testPathPattern=modifiers
```

The Jest config uses `maxWorkers: 1` because suites reset shared test data.

## 5. Test lifecycle

```text
1. test:e2e prepares the local test DB when not running in CI.
2. env-setup.ts points DATABASE_URL at the dedicated E2E database.
3. Each suite boots the real NestJS app.
4. resetDb() clears E2E-owned rows.
5. The suite seeds the data it needs and runs HTTP assertions.
6. teardownTestApp() closes the app.
```

## Troubleshooting

| Symptom                                     | Cause                                    | Fix                         |
| ------------------------------------------- | ---------------------------------------- | --------------------------- |
| `connect ECONNREFUSED 127.0.0.1:5432`       | PostgreSQL is not running                | `docker compose up -d`      |
| `database "food_order_test" does not exist` | Test DB was not prepared                 | `pnpm run db:test:prepare`  |
| `relation "restaurants" does not exist`     | Schema was not pushed to the test DB     | `pnpm run db:test:prepare`  |
| `ECONNREFUSED 127.0.0.1:6379`               | Redis is not running                     | `docker compose up -d`      |
| Local E2E refuses to run                    | DB name does not include `test` or `e2e` | Use a dedicated test DB URL |
