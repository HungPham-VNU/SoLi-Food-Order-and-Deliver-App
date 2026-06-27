Remove-Item status.txt, status_utf8.txt -ErrorAction Ignore
git reset

git add -A apps/api
if (git diff --staged --name-only) { git commit -m "refactor: remove legacy monolith apps/api" }

git add -A services/ordering
if (git diff --staged --name-only) { git commit -m "refactor: remove legacy ordering service modules" }

git add -A apps/services
if (git diff --staged --name-only) { git commit -m "feat: update microservices for the new architecture" }

git add -A apps/admin apps/gateway apps/mobile apps/web
if (git diff --staged --name-only) { git commit -m "feat: update gateway, admin, web, and mobile apps" }

git add -A docs infra packages package.json pnpm-lock.yaml turbo.json .env.example README.md docker-compose.dev.yml
if (git diff --staged --name-only) { git commit -m "chore: update documentation, infrastructure, and root configs" }

git add -A
if (git diff --staged --name-only) { git commit -m "chore: update remaining files" }
