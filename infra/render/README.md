# Render Terraform

This directory manages the Render infrastructure for UITFood:

- `UITFood Web`
- `UITFood API`
- `UITFood Postgres`

Terraform should own infrastructure shape: service names, plans, region, image references, custom domains, Postgres, and service links. Runtime application secrets should stay in Render by default.

## Required Credentials

Set these before running Terraform:

```powershell
$env:RENDER_API_KEY = "rnd_xxx"
$env:RENDER_OWNER_ID = "usr_xxx-or-tea_xxx"
```

For GitHub Actions, store the same values as repository or environment secrets.

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

Your CI/CD workflow can keep using Render deploy hooks for image deploys. Terraform does not need to run on every app release unless you want image tags to be infrastructure-managed.

## After Terraform Owns Render

Remove this project from active Render Blueprint management. Keeping both `render.yaml` and Terraform active creates two sources of truth.
