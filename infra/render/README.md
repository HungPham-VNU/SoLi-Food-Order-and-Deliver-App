# Render Terraform

This directory manages the Render infrastructure for UITFood:

- `UITFood Web`
- `UITFood API`
- `UITFood Postgres`

Terraform should own infrastructure shape: service names, plans, region, image references, custom domains, Postgres, and service links. Runtime application secrets should stay in Render by default.

## Required Credentials

This configuration uses HCP Terraform via `cloud {}` so CI/CD has persistent
remote state. The organization (`UITFood`) and workspace (`uitfood-render-production`) are pre-configured directly inside `versions.tf`.

To authenticate your local machine to HCP Terraform, run:

```powershell
terraform login
```

Set Render credentials before running Terraform locally:

```powershell
$env:RENDER_API_KEY = "rnd_xxx"
$env:RENDER_OWNER_ID = "usr_xxx-or-tea_xxx"
```

For GitHub Actions, store `RENDER_API_KEY`, `RENDER_OWNER_ID`, and
`TF_API_TOKEN` as repository or environment secrets.

If the HCP Terraform workspace uses remote execution, also set
`RENDER_API_KEY` and `RENDER_OWNER_ID` as environment variables in the HCP
Terraform workspace because the provider runs inside HCP Terraform.

## Runtime Secrets Policy

Keep these in Render, not Terraform:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `REDIS_HOST`
- `REDIS_PORT`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `CLOUDINARY_*`
- `SMTP_*`
- `VNPAY_*`

Terraform config sets `DATABASE_URL` and `NODE_ENV` for API service creation, but ignores later `env_vars` and `secret_files` changes. This is intentional because Terraform state can contain sensitive values.

If you want a cleaner Render UI, move the runtime secrets into a Render Environment Group and set `api_env_group_id` in your real `.tfvars` file.

## First-Time Migration From Existing Render Resources

Copy the example variables:

```powershell
Copy-Item .\production.tfvars.example .\production.tfvars
```

Edit `production.tfvars` and set the current image tags.

For GitHub Actions, put any values from `production.tfvars` that are needed in
CI into the HCP Terraform workspace variables instead. The workflow supplies
`api_image_tag` and `web_image_tag` through `TF_VAR_*` environment variables.

If you want Terraform-created resources to land inside the existing `UITFood` / `Production` Render Project environment, set `project_environment_id`. You can find it in the Render dashboard URL when viewing the project environment. Existing imported resources already carry their environment in state, but setting the variable makes the desired target explicit.

Initialize Terraform:

```powershell
terraform init
```

Import existing resources before applying. Replace the IDs with the IDs from your Render dashboard URLs.

```powershell
terraform import -var-file=production.tfvars render_web_service.api srv_xxxxxxxxxxxxxxxxxxxx
terraform import -var-file=production.tfvars render_web_service.web srv_xxxxxxxxxxxxxxxxxxxx
terraform import -var-file=production.tfvars render_postgres.main dpg_xxxxxxxxxxxxxxxxxxxx
```

Then inspect the plan:

```powershell
terraform plan -var-file=production.tfvars
```

Do not run `terraform apply` until the plan shows no unexpected replacement or deletion. Pay special attention to `env_vars`, `secret_files`, image tags, and Postgres settings.

Without these imports, Terraform treats the configuration as new infrastructure and will create new Render resources.

## Normal Usage

After migration:

```powershell
terraform plan -var-file=production.tfvars
terraform apply -var-file=production.tfvars
```

GitHub Actions automatically applies Render infrastructure changes on pushes to
`master` that touch `infra/render/**`. App image deploys also run through
Terraform: the pipeline publishes Docker images to GHCR with `sha-<short-sha>`
tags, then updates the Render service image tag through Terraform.

Do not use Render deploy hooks for API/Web releases while Terraform manages
`runtime_source.image.tag`; using both would create two release mechanisms for
the same Render field.

## After Terraform Owns Render

Remove this project from active Render Blueprint management. Keeping both `render.yaml` and Terraform active creates two sources of truth.
