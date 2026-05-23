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
- `RAILWAY_TOKEN`: Your Railway API token for deployment.

### B. Deployment to Railway/Render/VPS

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
