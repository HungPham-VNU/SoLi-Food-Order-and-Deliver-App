# CI/CD Implementation Guide

This document outlines the improvements made to the CI/CD pipeline and the steps required to finalize the CD setup.

## 1. Improved CI/CD Pipeline (`.github/workflows/pipeline-main.yml`)

The following enhancements have been implemented:

- **Security Audit:** Added `pnpm audit` to catch high-severity vulnerabilities early.
- **Typechecking:** Added a `typecheck` job using Turborepo to ensure type safety across the monorepo.
- **E2E Testing:** Integrated API E2E tests into the CI workflow.
- **Docker Registry:** Configured automatic build and push of API and Web Docker images to **GitHub Container Registry (GHCR)**.
- **Mobile CD:** Automated EAS builds for `production` (on push to master) profiles.

## 2. Finalizing the CD Setup

To fully enable the CD pipeline, you need to configure the following:

### A. GitHub Secrets

Ensure the following secrets are added to your GitHub repository settings (**Settings > Secrets and variables > Actions**):

- `EXPO_TOKEN`: Your Expo access token for EAS builds.
- `TURBO_TOKEN` & `TURBO_TEAM`: (Optional) If you use Turbo Remote Caching.
- `RENDER_API_KEY`: Render API key used by the Terraform provider. If the HCP
  Terraform workspace uses remote execution, also set this as a sensitive
  environment variable in that HCP workspace.
- `RENDER_OWNER_ID`: Render owner ID used by the Terraform provider. If the HCP
  Terraform workspace uses remote execution, also set this as an environment
  variable in that HCP workspace.
- `TF_API_TOKEN`: HCP Terraform API token used for remote Terraform state and runs.

### B. GitHub Variables

Ensure the following repository variables are added to your GitHub repository
settings (**Settings > Secrets and variables > Actions > Variables**):

- `TF_CLOUD_ORGANIZATION`: Your HCP Terraform organization name.
- `TF_WORKSPACE`: HCP Terraform workspace for Render infrastructure state.
- `RENDER_API_IMAGE_TAG`: Optional API Docker image tag for infra-only applies.
  Defaults to `master`.
- `RENDER_WEB_IMAGE_TAG`: Optional Web Docker image tag for infra-only applies.
  Defaults to `master`.

### C. Render Infrastructure Automation

Render infrastructure is managed by Terraform in `infra/render`.

- Pushes to `master` that change `infra/render/**` automatically run
  `.github/workflows/pipeline-render-iac.yml` and apply the Terraform plan.
- The full manual pipeline still calls the reusable
  `.github/workflows/cd-render-iac.yml` after publishing fresh Docker images,
  using the current commit's `sha-<short-sha>` image tag.
- HCP Terraform is configured with `cloud {}` in `infra/render/versions.tf` so
  GitHub Actions uses persistent remote state instead of ephemeral runner-local
  state.

Before the first automated apply, create or choose the HCP Terraform workspace,
set the variables above, and migrate/import any existing Render resources into
that workspace state.

### D. Deployment to Railway/Render/VPS

Since you chose a Docker-based deployment, you can connect your GHCR images to your hosting provider:

#### For Railway:

1. Create a new service from a Docker image.
2. Provide the image URL: `ghcr.io/<your-username>/food-delivery-api:master`.
3. Enable "Automatic Deploys" if Railway supports GHCR webhooks, or add a deployment step to `ci.yml`:
   ```yaml
   - name: Deploy to Railway
     run: npx @railway/cli up --service api --detach
     env:
       RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
   ```

#### For a VPS (using SSH):

Add a job to `ci.yml` that SSHs into your server and runs `docker compose pull && docker compose up -d`.

### C. Database Migrations

To automate migrations on deployment, add this command to your deployment script or as a post-deployment hook:

```bash
pnpm --filter api db:migrate
```

## 3. Mobile EAS Profiles

The pipeline currently uses:

- `production` profile for `master`: Ready for App Store/Play Store submission.

Verify your `eas.json` has these profiles configured correctly.
