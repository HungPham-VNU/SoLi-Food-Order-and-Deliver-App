# Turborepo CI/CD and Render Deployment

This document explains how this repository builds, validates, packages, and deploys the UITFood food ordering platform. It covers the GitHub Actions CI/CD workflows, the Turborepo task model, Docker image publication to GitHub Container Registry, Render image deploy hooks, Expo mobile packaging, and the Terraform configuration that manages Render infrastructure.

## 1. System Overview

This repository is a pnpm workspace managed by Turborepo.

Main workspace layout:

- `apps/api`: NestJS API service.
- `apps/web`: Vite React restaurant/admin web frontend.
- `apps/mobile`: Expo React Native customer mobile app.
- `infra/render`: Terraform IaC for Render services and Postgres.
- `.github/workflows`: GitHub Actions CI/CD workflows.
- `.github/actions/setup-environment`: shared GitHub composite action for Node, pnpm, and dependency installation.

The pipeline separates validation, packaging, and deployment:

- Validation runs linting, typechecking, tests, audit checks, and builds.
- API and Web are packaged as Docker images and pushed to GHCR.
- Render API and Web services are redeployed by Render deploy hooks with the newly pushed `sha-<short-sha>` image tag.
- Mobile is packaged with EAS into an Android APK artifact.
- Render infrastructure shape is managed by Terraform, with HCP Terraform used for remote state and remote runs.

## 2. Source Of Truth

The project intentionally has different sources of truth for different concerns.

| Concern                      | Source of truth                                                          |
| ---------------------------- | ------------------------------------------------------------------------ |
| Monorepo task graph          | `turbo.json`                                                             |
| Workspace membership         | `pnpm-workspace.yaml`                                                    |
| CI/CD workflow orchestration | `.github/workflows/*.yml`                                                |
| Shared CI environment setup  | `.github/actions/setup-environment/action.yml`                           |
| API Docker image build       | `apps/api/Dockerfile`                                                    |
| Web Docker image build       | `apps/web/Dockerfile` and `apps/web/nginx.conf`                          |
| Mobile build profile         | `apps/mobile/eas.json` and root `eas.json`                               |
| Render image promotion       | Render deploy hooks called by `.github/workflows/cd-render-image.yml`    |
| Render infrastructure        | `infra/render/*.tf`                                                      |
| Render runtime secrets       | Render service settings or Render environment group, not Terraform files |
| Terraform state              | HCP Terraform workspace selected by `infra/render/versions.tf`           |

Do not manage the same Render service with both Terraform and Render Blueprint YAML. Once Terraform owns the Render services, remove the project from active Blueprint management. Running both creates two competing release mechanisms for the same service fields.

Application image promotion is intentionally outside Terraform CD. The API and Web pipelines push GHCR images and then call Render deploy hooks so Render pulls the exact image tag produced by the workflow.

## 3. Turborepo Configuration

The root `package.json` exposes these workspace-wide commands:

```bash
pnpm build
pnpm dev
pnpm lint
pnpm test
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
pnpm build:web
```

The Turborepo task graph is defined in `turbo.json`.

Important task behavior:

- `build` depends on upstream package builds with `dependsOn: ["^build"]`.
- `build` caches outputs from `dist/**`, `.next/**`, `.expo/**`, and `web-build/**`.
- `test`, `lint`, and `typecheck` depend on the synthetic `transit` task.
- `test:e2e` depends on `build` and disables cache with `cache: false`.
- `dev` disables cache and is marked as persistent.
- `globalEnv` includes `NODE_ENV`, `DATABASE_URL`, and `REDIS_URL`, so changes to those values can affect task cache keys.

The reusable full validation workflow uses:

```bash
pnpm turbo run lint typecheck --affected --cache-dir=".turbo"
pnpm turbo run test --affected --cache-dir=".turbo"
pnpm turbo run build --affected --cache-dir=".turbo"
pnpm turbo run test:e2e --filter=api --cache-dir=".turbo" -- --detectOpenHandles --forceExit
```

`--affected` scopes work to packages affected by the current change set. The workflow checks out with `fetch-depth: 0` in `ci-validate.yml`, which gives Turborepo enough Git history to determine affected packages.

The workflows also cache `.turbo` with `actions/cache`. Remote Turborepo caching is supported through `TURBO_TOKEN` and `TURBO_TEAM`.

## 4. Shared CI Environment Setup

All major validation and packaging workflows use `.github/actions/setup-environment/action.yml`.

That composite action:

1. Installs pnpm `11.1.2`.
2. Installs Node.js `22`.
3. Enables pnpm dependency caching through `actions/setup-node`.
4. Runs `pnpm install --frozen-lockfile`.

This keeps all GitHub workflows aligned on the same Node and package manager versions.

## 5. Workflow Inventory

GitHub Actions only loads workflow files directly under `.github/workflows`, so this repository uses filename prefixes.

### Pipeline Workflows

| Workflow                  | Trigger                                                               | Purpose                                                                                       |
| ------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pipeline-main.yml`       | Manual `workflow_dispatch`                                            | Runs the full CI/CD path for API, Web, Mobile, and Render image deploys when run on `master`. |
| `pipeline-api.yml`        | Push to `master` touching `apps/api/**`, or manual                    | Validates API, publishes API Docker image, and triggers the Render API deploy hook.           |
| `pipeline-web.yml`        | Push to `master` touching `apps/web/**`, or manual                    | Validates Web, publishes Web Docker image, and triggers the Render Web deploy hook.           |
| `pipeline-mobile.yml`     | Push to `master` touching `apps/mobile/**`, or manual                 | Validates Mobile and packages an Android APK with EAS.                                        |
| `pipeline-render-iac.yml` | Push to `master` touching Render IaC workflow/config paths, or manual | Applies or plans Terraform changes in `infra/render`.                                         |

### Reusable Workflows

| Workflow                | Called by                | Purpose                                                                                                                   |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `ci-validate.yml`       | `pipeline-main.yml`      | Full monorepo validation with Turborepo affected tasks, Postgres, Redis, audit, build, migration push, and API E2E tests. |
| `cd-package-docker.yml` | API, Web, Main pipelines | Builds and pushes app Docker images to GHCR.                                                                              |
| `cd-package-mobile.yml` | Mobile, Main pipelines   | Runs an EAS local Android build and uploads the APK artifact.                                                             |
| `cd-render-image.yml`   | API, Web, Main pipelines | Calls Render deploy hooks for image-backed services with the current commit's GHCR image tag.                             |
| `cd-render-iac.yml`     | Render IaC pipeline      | Runs Terraform fmt, init, validate, plan, or apply for Render infrastructure.                                             |

## 6. Main Pipeline

File: `.github/workflows/pipeline-main.yml`

The main pipeline is manually triggered. It is useful when you want to run a full release path instead of waiting for path-specific workflows.

Job order:

1. `validate`
   - Calls `ci-validate.yml`.
   - Runs full monorepo validation.

2. `publish-api-docker`
   - Needs `validate`.
   - Calls `cd-package-docker.yml` with `app: api`.
   - Pushes API image tags to GHCR.

3. `publish-web-docker`
   - Needs `validate`.
   - Calls `cd-package-docker.yml` with `app: web`.
   - Passes `vars.VITE_API_BASE_URL` as the Vite build-time API URL.
   - Pushes Web image tags to GHCR.

4. `deploy-api-render`
   - Needs both Docker publish jobs.
   - Runs only when the workflow ref is `refs/heads/master`.
   - Calls `cd-render-image.yml` with `app: api`.
   - Triggers the Render API deploy hook with `ghcr.io/<owner>/<repo>-api:sha-<short-sha>`.

5. `deploy-web-render`
   - Needs both Docker publish jobs.
   - Runs only when the workflow ref is `refs/heads/master`.
   - Calls `cd-render-image.yml` with `app: web`.
   - Triggers the Render Web deploy hook with `ghcr.io/<owner>/<repo>-web:sha-<short-sha>`.

6. `publish-mobile`
   - Needs `validate`.
   - Calls `cd-package-mobile.yml`.
   - Uses `EXPO_TOKEN`.

The main pipeline has `cancel-in-progress: true`, so a newer manual run on the same ref cancels the older run.

## 7. API Pipeline

File: `.github/workflows/pipeline-api.yml`

Trigger:

- Push to `master` where files under `apps/api/**` changed.
- Manual `workflow_dispatch`.

Validation job:

1. Checks out code.
2. Starts Postgres `18` and Redis `7-alpine` service containers.
3. Runs shared setup.
4. Restores `.turbo` cache under an API-specific key.
5. Runs API lint.
6. Runs API typecheck.
7. Runs `pnpm audit --audit-level high`.
8. Runs API unit tests with required test environment variables.
9. Builds API.
10. Runs `pnpm --filter=api run db:push` against the CI Postgres service.
11. Runs API E2E tests with `--detectOpenHandles`.

Publish job:

- Calls `cd-package-docker.yml` with `app: api`.
- Publishes `ghcr.io/<owner>/<repo>-api` image tags.

Render deploy job:

- Runs only on `refs/heads/master`.
- Calls `cd-render-image.yml`.
- Uses the `RENDER_API_DEPLOY_HOOK` GitHub secret.
- Triggers Render with the API image reference `ghcr.io/<owner>/<repo>-api:sha-<short-sha>`.
- The Web service remains on its previous image tag.

## 8. Web Pipeline

File: `.github/workflows/pipeline-web.yml`

Trigger:

- Push to `master` where files under `apps/web/**` changed.
- Manual `workflow_dispatch`.

Validation job:

1. Checks out code.
2. Runs shared setup.
3. Restores `.turbo` cache under a Web-specific key.
4. Runs Web lint.
5. Runs Web typecheck.
6. Runs `pnpm audit --audit-level high`.
7. Runs Web tests. Currently this script prints `No tests configured for web`.
8. Builds Web with Vite.

Publish job:

- Calls `cd-package-docker.yml` with `app: web`.
- Passes Web Vite build arguments for API base URL, Grafana Faro, and PostHog.
- Passes the Grafana Faro source-map API key to Docker as a BuildKit secret when configured.
- Publishes `ghcr.io/<owner>/<repo>-web` image tags.

Render deploy job:

- Runs only on `refs/heads/master`.
- Calls `cd-render-image.yml`.
- Uses the `RENDER_WEB_DEPLOY_HOOK` GitHub secret.
- Triggers Render with the Web image reference `ghcr.io/<owner>/<repo>-web:sha-<short-sha>`.
- The API service remains on its previous image tag.

## 9. Mobile Pipeline

File: `.github/workflows/pipeline-mobile.yml`

Trigger:

- Push to `master` where files under `apps/mobile/**` changed.
- Manual `workflow_dispatch`.

Validation job:

1. Checks out code.
2. Runs shared setup.
3. Restores `.turbo` cache under a Mobile-specific key.
4. Runs Mobile lint through Expo.
5. Runs Mobile typecheck.
6. Runs `pnpm audit --audit-level high`.
7. Runs Mobile tests. Currently this script prints `No tests configured for mobile`.
8. Runs Mobile build through `expo export`.

Publish job:

- Calls `cd-package-mobile.yml`.
- Uses `expo/expo-github-action`.
- Installs Java 17.
- Runs from `apps/mobile`:

```bash
eas build --platform android --profile preview --local --non-interactive --output build.apk
```

- Uploads `apps/mobile/build.apk` as the `mobile-production-build` artifact.

Important naming note: the uploaded artifact is named `mobile-production-build`, but the command currently uses the EAS `preview` profile.

## 10. Render IaC Pipeline

File: `.github/workflows/pipeline-render-iac.yml`

Trigger:

- Push to `master` touching:
  - `infra/render/**`
  - `.github/workflows/cd-render-iac.yml`
  - `.github/workflows/pipeline-render-iac.yml`
- Manual `workflow_dispatch`.

Push behavior:

- Calls `cd-render-iac.yml`.
- Always applies with `apply: true`.
- Uses the image tags resolved by the reusable Terraform workflow.

Manual behavior:

- Accepts `apply`, `api_image_tag`, and `web_image_tag` inputs.
- Can be used for:
  - Applying infrastructure-only changes.
  - Running a plan by setting `apply: false`.
  - Pinning API or Web to a specific existing image tag.
  - Rolling back to a previous `sha-<short-sha>` tag.

This workflow sets `cancel-in-progress: false`. That is intentional for infrastructure because canceling an in-progress Terraform run can leave an operator uncertain about whether the remote run completed. Let one infrastructure run finish before starting another.

## 11. Reusable Validation Workflow

File: `.github/workflows/ci-validate.yml`

This workflow is used by the main pipeline to validate the monorepo as a whole.

It provisions CI service containers:

- Postgres `18`
- Redis `7-alpine`

It then runs:

1. Checkout with full Git history.
2. Shared Node/pnpm setup.
3. `.turbo` cache restore.
4. Turborepo affected lint and typecheck.
5. High-severity pnpm audit.
6. Turborepo affected unit tests.
7. Turborepo affected builds.
8. API `db:push` migration sync against CI Postgres.
9. API E2E tests.

The workflow declares `TURBO_TOKEN` and `TURBO_TEAM` as required workflow-call secrets. Because of that, `pipeline-main.yml` currently needs those secrets even if remote caching is not essential. If remote cache should be optional, change those workflow-call secrets to `required: false` and keep the environment variables empty when unavailable.

## 12. Docker Image Packaging

File: `.github/workflows/cd-package-docker.yml`

This reusable workflow builds API and Web images and publishes them to GHCR.

Common behavior:

1. Checks out code.
2. Logs in to `ghcr.io` with `GITHUB_TOKEN`.
3. Sets up Docker Buildx.
4. Uses `docker/metadata-action` to generate image names and tags.
5. Builds and pushes with `docker/build-push-action`.
6. Uses GitHub Actions Docker layer cache with per-app scopes.

Image name format:

```text
ghcr.io/<github-owner-lowercase>/<github-repo-lowercase>-<app>
```

The Docker packaging workflow and the Render image deploy workflow both accept
an optional explicit image URL. When no explicit URL is provided, they derive
this value from `github.repository`, lower-case it, and append `-api` or
`-web`. For the current `NDTruongDanh/UITFood` repository, the default workflow
image refs are:

```text
ghcr.io/ndtruongdanh/uitfood-api
ghcr.io/ndtruongdanh/uitfood-web
```

The default image URL configured on each Render image-backed service must match
the workflow image URL, except for the tag. Render rejects deploy hook requests
where the image host, repository, or image name differs from the service's
configured default image URL.

If a Render service is configured to pull a different image repository, update
the Render service image URL to this workflow image repository. The deploy hook
can then move the service from one `sha-<short-sha>` tag to the next.

Tag format:

- Branch tag, for example `master`.
- Short SHA tag, for example `sha-1a2b3c4`.

The Render deployment path uses the SHA tag. This gives each release an immutable-ish identifier tied to the Git commit.

### API Dockerfile

File: `apps/api/Dockerfile`

The API Dockerfile is a multi-stage monorepo build:

1. Uses `turbo prune --scope=api --docker` to produce a pruned workspace.
2. Installs only the dependencies needed for the pruned workspace.
3. Runs `turbo run build --filter=api...`.
4. Installs production dependencies separately.
5. Copies `apps/api/dist` and production dependencies into a smaller runtime image.
6. Runs as a non-root `nestjs` user.
7. Exposes port `3000`.
8. Starts with:

```bash
node dist/main
```

The NestJS app listens on `process.env.PORT ?? 3000`, so Render can provide the port through its runtime environment.

### Web Dockerfile

File: `apps/web/Dockerfile`

The Web Dockerfile is also a pruned monorepo build:

1. Uses `turbo prune --scope=web --docker`.
2. Installs pruned dependencies.
3. Sets the `VITE_API_BASE_URL` build argument and environment variable.
4. Runs `pnpm turbo run build --filter=web...`.
5. Copies the Vite `dist` output into `nginx:alpine`.
6. Uses `apps/web/nginx.conf` to serve the SPA and fall back to `index.html`.
7. Exposes port `80`.

Because Vite embeds `VITE_*` values at build time, changing `VITE_API_BASE_URL` requires rebuilding and republishing the Web image.

## 13. Render Image Deploy Hooks

File: `.github/workflows/cd-render-image.yml`

This workflow is the app deployment path for Render image-backed services. It
does not run Terraform and does not mutate Render infrastructure state.

Inputs:

- `app`: app suffix used for the GHCR image name, such as `api` or `web`.
- `gh_repository`: GitHub repository in `<owner>/<repo>` form.
- `image_url`: optional explicit image repository, without a tag.
- `image_tag`: optional explicit image tag.

Required secret:

- `RENDER_DEPLOY_HOOK`: the service deploy hook URL from Render settings.

The API and Web pipelines pass this secret from service-specific GitHub secrets:

```text
RENDER_API_DEPLOY_HOOK
RENDER_WEB_DEPLOY_HOOK
```

Default image resolution:

1. If `image_url` is provided, use it.
2. Else derive `ghcr.io/<github-owner>/<github-repo>-<app>`.
3. If `image_tag` is provided, use it.
4. Else use `sha-<short-sha>` from the current commit.

The workflow calls the Render deploy hook with `imgURL=<image_url>:<image_tag>`.
For image-backed services, this tells Render to pull and deploy the exact image
that GitHub Actions just pushed to GHCR.

## 14. Render Terraform IaC

Directory: `infra/render`

The Render IaC configuration manages:

- `UITFood API` Render web service.
- `UITFood Web` Render web service.
- `UITFood Postgres` Render Postgres database.
- Optional Render environment group link for API runtime secrets.

### Terraform Version And Provider

File: `infra/render/versions.tf`

The configuration requires:

- Terraform `>= 1.6.0`
- Render provider `render-oss/render` version `~> 1.8`

The reusable GitHub workflow currently installs Terraform `1.15.4`.

### HCP Terraform State

The Terraform block uses HCP Terraform:

```hcl
terraform {
  cloud {
    workspaces {
      tags = ["uitfood", "render", "production"]
    }
  }
}
```

The workflow sets:

```text
TF_CLOUD_ORGANIZATION
TF_WORKSPACE
```

The cloud block maps this configuration to an HCP Terraform workspace using the configured organization and workspace selection. HCP Terraform provides persistent remote state, which is required because GitHub-hosted runners are ephemeral.

### Render Provider Credentials

File: `infra/render/provider.tf`

The provider reads credentials from environment variables:

```text
RENDER_API_KEY
RENDER_OWNER_ID
```

These should be stored as GitHub Actions secrets. If the HCP Terraform workspace uses remote execution, also store them as sensitive environment variables in the HCP Terraform workspace, because the provider runs inside HCP Terraform.

### Render Resources

File: `infra/render/main.tf`

`render_postgres.main` creates or manages the production database:

- Name: `UITFood Postgres` by default.
- Region: `singapore` by default.
- Plan: `free` by default.
- Version: `18` by default.
- Database name: `uitfood_db` by default.
- Database user: `nestjs` by default.
- Optional `project_environment_id` to place it into an existing Render project environment.
- `postgres_ip_allow_list` defaults to `0.0.0.0/0`.

`render_web_service.api` creates or manages the API service:

- Name: `UITFood API` by default.
- Runtime source: GHCR Docker image.
- Image URL: `var.api_image_url`.
- Image tag: `var.api_image_tag`.
- Optional custom domains.
- Optional health check path.
- `DATABASE_URL` set from the internal Render Postgres connection string.
- `NODE_ENV` set to `production`.

`render_web_service.web` creates or manages the Web service:

- Name: `UITFood Web` by default.
- Runtime source: GHCR Docker image.
- Image URL: `var.web_image_url`.
- Image tag: `var.web_image_tag`.
- Optional custom domains.
- Optional health check path.

`render_env_group_link.api_runtime_secrets` optionally links an existing Render environment group to the API service when `api_env_group_id` is set.

### Terraform Secret Boundary

The API and Web services use:

```hcl
lifecycle {
  ignore_changes = [
    env_vars,
    secret_files,
  ]
}
```

This is a deliberate security boundary.

Terraform creates the initial API `DATABASE_URL` and `NODE_ENV`, but it does not keep managing every runtime environment variable afterward. Runtime application secrets should stay in Render service settings or a Render environment group, not in Terraform state.

Keep these values out of Terraform variable files and Terraform-managed `env_vars`:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `REDIS_HOST`
- `REDIS_PORT`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `CLOUDINARY_*`
- `SMTP_*`
- `VNPAY_*`

If a secret is placed into Terraform configuration, it can end up in Terraform state. HCP Terraform protects sensitive variables, but the safest project policy is still to avoid using Terraform as the application secret store.

### Terraform Outputs

File: `infra/render/outputs.tf`

The module outputs:

- API service ID.
- API service URL.
- Web service ID.
- Web service URL.
- Postgres ID.
- Sensitive internal Postgres connection string.

## 15. Reusable Render Terraform Workflow

File: `.github/workflows/cd-render-iac.yml`

This workflow is the automation entry point for Terraform infrastructure
changes. It is no longer used by the API, Web, or Main pipelines for app image
promotion.

Inputs:

- `apply`: whether to apply or only plan.
- `use_github_sha_tag`: use the current commit SHA tag for both API and Web.
- `api_use_github_sha_tag`: use the current commit SHA tag for API only.
- `web_use_github_sha_tag`: use the current commit SHA tag for Web only.
- `api_image_tag`: explicit API image tag.
- `web_image_tag`: explicit Web image tag.
- `api_image_url`: optional explicit API image repository, without a tag.
- `web_image_url`: optional explicit Web image repository, without a tag.
- `working_directory`: defaults to `infra/render`.
- `terraform_version`: defaults to `1.15.4`.

Required secrets:

- `RENDER_API_KEY`
- `RENDER_OWNER_ID`
- `TF_API_TOKEN`

Environment:

- `RENDER_API_KEY`
- `RENDER_OWNER_ID`
- `TF_CLOUD_ORGANIZATION`
- `TF_WORKSPACE`

Steps:

1. Checkout.
2. Install Terraform with `hashicorp/setup-terraform`.
3. Configure HCP Terraform CLI credentials from `TF_API_TOKEN`.
4. Run `terraform fmt -check -recursive`.
5. Run `terraform init -input=false`.
6. Resolve API and Web image tags.
7. Run `terraform validate -no-color`.
8. Run `terraform plan -input=false -no-color` when `apply` is false.
9. Run `terraform apply -input=false -auto-approve` when `apply` is true.

### Image Tag Resolution

The workflow calculates `short_sha` from the first seven characters of `GITHUB_SHA`.

For each service, the image tag is resolved in this order:

1. If `use_github_sha_tag` or the service-specific SHA flag is true, use `sha-<short-sha>`.
2. Else use explicit workflow input such as `api_image_tag`.
3. Else use repository variables such as `RENDER_API_IMAGE_TAG`.
4. Else read the current image tag from Terraform state with `terraform state pull`.

Resolved tags are exported as:

```text
TF_VAR_api_image_tag
TF_VAR_web_image_tag
```

Terraform automatically maps `TF_VAR_*` environment variables to matching Terraform input variables.

This fallback behavior allows infrastructure-only applies to keep the currently deployed app images instead of accidentally requiring a new image tag.

## 16. End-To-End Release Flow

### API Release

1. A commit lands on `master` under `apps/api/**`.
2. `pipeline-api.yml` starts.
3. API validation runs against CI Postgres and Redis.
4. API Docker image is built and pushed to GHCR.
5. GHCR receives tags like:

```text
master
sha-<short-sha>
```

6. `cd-render-image.yml` runs with `app: api`.
7. The workflow calls the Render API deploy hook with `imgURL=ghcr.io/<owner>/<repo>-api:sha-<short-sha>`.
8. Render deploys the API service with the new container image.
9. The Web service remains on its previous image tag.

### Web Release

1. A commit lands on `master` under `apps/web/**`.
2. `pipeline-web.yml` starts.
3. Web validation runs.
4. Web Docker image is built with API, Grafana Faro, and PostHog build configuration.
5. Web image is pushed to GHCR.
6. `cd-render-image.yml` runs with `app: web`.
7. The workflow calls the Render Web deploy hook with `imgURL=ghcr.io/<owner>/<repo>-web:sha-<short-sha>`.
8. Render deploys the Web service with the new container image.
9. The API service remains on its previous image tag.

### Full Manual Release

1. A user manually starts `pipeline-main.yml`.
2. Full monorepo validation runs through `ci-validate.yml`.
3. API and Web Docker images are published.
4. If the workflow runs against `master`, Render deploy hooks are triggered for both API and Web images from the current commit.
5. Mobile EAS local build runs and uploads the APK artifact.

### Infrastructure Release

1. A commit lands on `master` under `infra/render/**` or the Render workflow files.
2. `pipeline-render-iac.yml` starts.
3. `cd-render-iac.yml` runs `terraform fmt`, `init`, `validate`, and `apply`.
4. Image tags are preserved from inputs, repository variables, or existing Terraform state unless explicitly overridden.
5. Render infrastructure changes are applied.

## 17. First-Time Render Terraform Setup

Before the automated Render pipeline can safely apply, complete these steps.

### 1. Create Or Select HCP Terraform Workspace

Create an HCP Terraform workspace for Render production state.

The workspace should match the cloud block selection:

- Tags: `uitfood`, `render`, `production`
- Organization: repository variable `TF_CLOUD_ORGANIZATION`
- Workspace: repository variable `TF_WORKSPACE`

### 2. Configure GitHub Secrets

Set these in GitHub repository secrets:

- `RENDER_API_KEY`: Render API key for the Terraform provider.
- `RENDER_OWNER_ID`: Render owner ID for the Terraform provider.
- `TF_API_TOKEN`: HCP Terraform API token for CLI-driven remote runs.
- `EXPO_TOKEN`: Expo token for EAS packaging.
- `TURBO_TOKEN`: Turborepo remote cache token. Currently required by `ci-validate.yml`.
- `TURBO_TEAM`: Turborepo team slug. Currently required by `ci-validate.yml`.

Set application test secrets used by API CI:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`
- `VNPAY_URL`
- `VNPAY_RETURN_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### 3. Configure GitHub Variables

Set these in GitHub repository variables:

- `TF_CLOUD_ORGANIZATION`
- `TF_WORKSPACE`
- `VITE_API_BASE_URL`

Optional variables:

- `RENDER_API_IMAGE_TAG`
- `RENDER_WEB_IMAGE_TAG`

The optional image tag variables are useful for manual infrastructure applies when no new Docker image was published in the same workflow.

### 4. Configure HCP Terraform Variables

Set Terraform variables in the HCP workspace as needed:

- `project_environment_id`
- `api_image_tag`
- `web_image_tag`
- `api_env_group_id`
- custom domain variables
- health check path variables
- plan or region overrides

Set these as sensitive HCP Terraform environment variables if remote execution is enabled:

- `RENDER_API_KEY`
- `RENDER_OWNER_ID`

### 5. Import Existing Render Resources

If the Render services or database already exist, import them before applying.

From `infra/render`:

```powershell
$env:TF_CLOUD_ORGANIZATION = "your-hcp-terraform-org"
$env:TF_WORKSPACE = "uitfood-render-production"
$env:RENDER_API_KEY = "rnd_xxx"
$env:RENDER_OWNER_ID = "usr_or_team_xxx"

terraform init
terraform import -var-file=production.tfvars render_web_service.api srv_xxxxxxxxxxxxxxxxxxxx
terraform import -var-file=production.tfvars render_web_service.web srv_xxxxxxxxxxxxxxxxxxxx
terraform import -var-file=production.tfvars render_postgres.main dpg_xxxxxxxxxxxxxxxxxxxx
terraform plan -var-file=production.tfvars
```

Do not apply until the plan shows no unexpected replacement or deletion.

Without imports, Terraform treats the resources as new and may create duplicates.

## 18. Local Operator Commands

### Validate the Monorepo Locally

```bash
pnpm install --frozen-lockfile
pnpm turbo run lint typecheck
pnpm turbo run test
pnpm turbo run build
```

### Run API E2E Locally

Start Postgres and Redis first, then run:

```bash
pnpm --filter=api run db:push
pnpm --filter=api run test:e2e --detectOpenHandles
```

### Build Docker Images Locally

```bash
docker build -f apps/api/Dockerfile -t uitfood-api:local .
docker build -f apps/web/Dockerfile -t uitfood-web:local --build-arg VITE_API_BASE_URL=http://localhost:3000 .
```

### Plan Render Terraform Locally

```powershell
cd infra/render
$env:TF_CLOUD_ORGANIZATION = "your-hcp-terraform-org"
$env:TF_WORKSPACE = "uitfood-render-production"
$env:RENDER_API_KEY = "rnd_xxx"
$env:RENDER_OWNER_ID = "usr_or_team_xxx"
$env:TF_VAR_api_image_tag = "sha-current"
$env:TF_VAR_web_image_tag = "sha-current"

terraform fmt -check -recursive
terraform init -input=false
terraform validate -no-color
terraform plan -input=false
```

### Apply Render Terraform Locally

```powershell
terraform apply -input=false
```

Use local apply only when you understand how it interacts with the shared HCP Terraform state. CI should remain the normal production path.

## 19. Rollback Procedure

API and Web images are tagged with short Git SHA tags. Rollback is done by
manually running `cd-render-image.yml` through the API, Web, or Main pipeline
with an explicit previous known-good image tag, or by using the Render Dashboard
manual deploy flow for the image-backed service.

Recommended rollback path:

1. Find the previous working tag in GHCR or GitHub Actions logs, for example `sha-1a2b3c4`.
2. Start the API or Web pipeline manually after temporarily adding an explicit `image_tag` input, or trigger the Render deploy hook directly with `imgURL=<image-url>:<tag>`.
3. Verify the Render service URL and logs.

For a full API and Web rollback, provide both image tags.

Do not remove the old image tag from GHCR until the rollback window has passed. Render needs the referenced image to remain available in the registry.

## 20. Security And Governance

Current safeguards:

- Actions are pinned to commit SHAs.
- Workflows request minimal default permissions with `contents: read`.
- Docker publishing jobs explicitly request `packages: write`.
- `pnpm audit --audit-level high` runs in validation jobs.
- Render deploy hook URLs are stored as GitHub Actions secrets.
- Terraform credentials are passed through secrets.
- Terraform avoids owning application runtime secrets after initial service setup.
- API Docker image runs as a non-root user.
- HCP Terraform remote state avoids losing state between ephemeral GitHub runners.

Operational rules:

- Keep secrets out of committed `.tfvars` files.
- Keep `production.tfvars` free of credentials.
- Prefer Render environment groups for runtime application secrets.
- Keep GHCR package visibility and Render image pull access aligned.
- Keep Render deploy hook URLs secret and rotate them if they are exposed.
- Review Terraform plans before first import or any major service setting change.

## 21. Current Caveats And Improvement Opportunities

These are current behaviors to be aware of:

- `pipeline-main.yml` is manual only. There is no full automatic pipeline for every push or pull request.
- The API, Web, and Mobile pipelines are path-specific. Root-level changes such as `package.json`, `pnpm-lock.yaml`, `turbo.json`, or shared workflow changes may require manually running the main pipeline unless their workflow path filters are expanded.
- `ci-validate.yml` requires `TURBO_TOKEN` and `TURBO_TEAM`. If remote caching is optional for the team, make those workflow-call secrets optional.
- The deploy hook workflow requires each Render service's configured image URL to match the GHCR image URL used by Docker publish and deploy. If the Render image repository differs from `ghcr.io/<owner>/<repo>-<app>`, update the Render service image URL.
- The Web and Mobile test scripts currently do not run real tests.
- `pipeline-mobile.yml` uploads an artifact named `mobile-production-build`, but the reusable mobile package workflow builds the `preview` EAS profile.
- Render Postgres `postgres_ip_allow_list` defaults to `0.0.0.0/0`. Tighten this if external public database access is not required.
- The API pipeline uses `drizzle-kit push` in CI. For production database changes, prefer an explicit migration strategy through `db:migrate` or a controlled migration job.
- The Terraform workflow applies automatically on Render IaC pushes to `master`. For stricter infrastructure control, change the push path to plan-only and require manual apply.

## 22. Troubleshooting

### Terraform Fails Because `TF_CLOUD_ORGANIZATION` Or `TF_WORKSPACE` Is Empty

Set repository variables:

```text
TF_CLOUD_ORGANIZATION
TF_WORKSPACE
```

Then rerun the workflow.

### Terraform Cannot Authenticate To HCP Terraform

Check that `TF_API_TOKEN` is present as a GitHub secret and has access to the target HCP Terraform organization and workspace.

### Terraform Cannot Authenticate To Render

Check:

- `RENDER_API_KEY` GitHub secret.
- `RENDER_OWNER_ID` GitHub secret.
- HCP Terraform environment variables if using remote execution.

### Render Service Deploys The Wrong Image

Check the resolved image tag in the `Resolve image tags` workflow step.

Expected release tags look like:

```text
sha-<short-sha>
```

Also confirm the Terraform image URL variables match the GHCR repository names produced by `cd-package-docker.yml`.

If the deploy hook fails with:

```text
deploy hook cannot change the host, project, or image name. Only the digest or tag may be modified
```

the image repository sent in `imgURL` does not match the image repository
currently configured on the Render service. Either update the Render service
image URL to the workflow image repository, or explicitly pass a matching
`image_url` input from a custom workflow caller.

### Web Points To The Wrong API URL

`VITE_API_BASE_URL` is baked into the Web image at build time. Update the GitHub repository variable, rerun the Web pipeline, and let Terraform apply the new Web image tag.

### API Starts Locally But Fails On Render

Check Render service environment variables or environment group values:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `REDIS_HOST`
- `REDIS_PORT`
- `CLOUDINARY_*`
- `VNPAY_*`
- `SMTP_*`
- Firebase secret file path if push notifications are enabled.

Terraform manages `DATABASE_URL` initially, but runtime secret drift is intentionally ignored afterward.

### GHCR Image Pull Fails On Render

Check package visibility and registry credentials. If GHCR packages are private, Render needs credentials that can pull the image.

### Mobile Build Fails In GitHub Actions

Check:

- `EXPO_TOKEN`.
- EAS CLI version compatibility.
- Java 17 setup.
- Android credentials and EAS project configuration.
- Whether the local GitHub runner has enough disk space for local Android builds.

## 23. Reference Notes

This guide follows current tool behavior from the official documentation:

- Turborepo supports affected task execution, local or remote caching, task outputs, environment-sensitive cache inputs, and `turbo prune --docker` for pruned Docker build contexts.
- Terraform automation should use non-interactive flags such as `-input=false`, validate configuration before plan or apply, and can set variables through `TF_VAR_*` environment variables.
- HCP Terraform CLI integration uses the `cloud` block to map local CLI runs to remote workspaces, with remote plans and applies using workspace variables and remote state.
- Render organizes deployable resources as services, databases, projects, environments, environment variable groups, health checks, and image-backed web services.

## 24. Diagrams

### CI Pipeline

Triggered by a pull request targeting `master`. All steps run inside a single job with Postgres and Redis service containers.

```mermaid
flowchart LR
    PR["Pull Request → master\n(opened / synchronize / reopened / ready_for_review)"]
    PR --> CIV

    subgraph CIV["ci-validate.yml — job: validate (ubuntu-latest)"]
        direction LR
        SVC["🐘 Postgres 18  +  🟥 Redis 7-alpine\n(service containers)"]
        A["Checkout (fetch-depth=0)"]
        B["Configure Turbo Affected Range\n(PR base SHA → HEAD)"]
        C["Setup Environment\npnpm 11.1.2 · Node 22 · frozen install"]
        D["Restore Turbo Cache (.turbo)"]
        E["Lint & Typecheck\nturbo --affected"]
        F["Security Scan\npnpm audit --audit-level high"]
        G["Unit Tests\nturbo --affected  (Postgres + Redis)"]
        H["Build\nturbo --affected"]
        I["DB Migrate\npnpm --filter=api db:push"]
        J["E2E Tests\nturbo --filter=api  (Postgres + Redis)"]

        SVC --> A --> B --> C --> D --> E --> F --> G --> H --> I --> J
    end

    J -->|all steps pass| OK["✅ PR can be merged"]
    J -->|any step fails| FAIL["❌ gh pr comment\n(notify-author job auto-posts\nfailure link to PR author)"]
```

---

### CD Pipeline

Triggered by a push to `master` (path-filtered per app). Each app has an independent pipeline.

```mermaid
flowchart LR
    PUSH["Push to master"]

    PUSH -->|"apps/api/**"| API_P["pipeline-api.yml"]
    PUSH -->|"apps/web/**"| WEB_P["pipeline-web.yml"]
    PUSH -->|"apps/admin/**"| ADM_P["pipeline-admin.yml"]
    PUSH -->|"apps/mobile/**"| MOB_P["pipeline-mobile.yml"]
    PUSH -->|"infra/render/**\nor workflow files"| IaC_P["pipeline-render-iac.yml"]

    subgraph API["API"]
        API_P --> API_V["validate\nLint+TC · Audit · Unit Test\nBuild · DB Migrate · E2E\n(Postgres + Redis)"]
        API_V --> API_D["cd-package-docker.yml\nBuild & push GHCR image\nghcr.io/…/uitfood-api:sha-xxxxxxx"]
        API_D --> API_R["cd-render-image.yml\nPOST Render deploy hook\n(RENDER_API_DEPLOY_HOOK)"]
    end

    subgraph WEB["Web"]
        WEB_P --> WEB_V["validate\nLint+TC · Audit · Unit Test · Build\n(Vite build args baked in)"]
        WEB_V --> WEB_D["cd-package-docker.yml\nBuild & push GHCR image\nghcr.io/…/uitfood-web:sha-xxxxxxx\n(Grafana Faro sourcemap upload)"]
        WEB_D --> WEB_R["cd-render-image.yml\nPOST Render deploy hook\n(RENDER_WEB_DEPLOY_HOOK)"]
    end

    subgraph ADMIN["Admin"]
        ADM_P --> ADM_V["validate\nLint+TC · Audit · Unit Test · Build\n(Vite build args baked in)"]
        ADM_V --> ADM_D["cd-package-docker.yml\nBuild & push GHCR image\nghcr.io/…/uitfood-admin:sha-xxxxxxx"]
        ADM_D --> ADM_R["cd-render-image.yml\nPOST Render deploy hook\n(RENDER_ADMIN_DEPLOY_HOOK)"]
    end

    subgraph MOBILE["Mobile"]
        MOB_P --> MOB_V["validate\nLint+TC · Audit · Unit Test · Build\nSentry sourcemaps upload"]
        MOB_V --> MOB_E["cd-package-mobile.yml\nEAS local Android build\n(Java 17 · eas build --local)"]
        MOB_E --> MOB_A["Upload artifact\nmobile-production-build / build.apk"]
    end

    subgraph IaC["Infrastructure (Render Terraform)"]
        IaC_P --> TF["cd-render-iac.yml\nterraform fmt · init · validate\nterraform plan -out=tfplan\nterraform apply tfplan\n(HCP Terraform remote state)"]
        TF --> RENDER_INFRA["Render Infrastructure\nAPI service · Web service\nPostgres database"]
    end

    API_R --> RENDER_API["Render: UITFood API\n(new container deployed)"]
    WEB_R --> RENDER_WEB["Render: UITFood Web\n(new container deployed)"]
    ADM_R --> RENDER_ADM["Render: UITFood Admin\n(new container deployed)"]
```

---

### High-Level CI/CD Overview

End-to-end flow from developer commit to production.

```mermaid
---
config:
  layout: elk
  flowchart:
    curve: rounded
---
flowchart LR
    DEV["👨‍💻 Developer"]

    DEV -->|"feature branch push"| PR["Pull Request\n(to master)"]

    subgraph CI["CI  ·  ci-validate.yml"]
        direction TB
        C1["Lint & Typecheck\n(turbo --affected)"]
        C2["Security Audit\n(pnpm audit)"]
        C3["Unit Tests\n(turbo --affected)"]
        C4["Build\n(turbo --affected)"]
        C5["E2E Tests\n(API only)"]
        C1 --> C2 --> C3 --> C4 --> C5
    end

    PR -->|"triggers CI"| CI
    CI -->|"passes + reviewed"| MERGE["Merge to master"]
    CI -->|"fails"| FB["💬 Automated PR comment\n(failure link → author)"]

    subgraph CD["CD  ·  path-filtered per app (push to master)"]
        direction TB
        V["Re-validate\n(lint · typecheck · audit\nunit test · build)"]

        subgraph PKG["Package"]
            PKG1["Docker → GHCR\napi · web · admin\nsha-xxxxxxx tag"]
            PKG2["EAS APK artifact\nmobile"]
        end

        V --> PKG

        PKG1 -->|"api · web · admin"| DEPLOY["Deploy\nRender deploy hook\n→ pull new image → restart"]
        PKG2 -->|"mobile"| ART["GitHub Actions Artifact\n(APK download)"]
    end

    MERGE --> CD

    subgraph IaC["IaC  ·  path-filtered (infra/render/**)"]
        TF["Terraform\nfmt · init · plan → apply\n(HCP Terraform remote state)"]
    end

    MERGE -->|"infra changes"| IaC
    IaC --> RENDER_INFRA["Render Infrastructure\n(services · database · scaling)"]
    DEPLOY --> RENDER_INFRA
```
