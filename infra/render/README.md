# Render Terraform

This directory manages the Render infrastructure for UITFood:

- `UITFood Web`
- `UITFood API`
- `UITFood Postgres`

Terraform should own infrastructure shape: service names, plans, region, image references, custom domains, Postgres, service links, and any environment variables declared in your local `.tfvars` file.

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

## Runtime Environment Variables

Copy the example variable file:

```powershell
Copy-Item .\production.auto.tfvars.example .\production.auto.tfvars
```

Then edit `production.auto.tfvars` and set:

- `api_image_tag`
- `web_image_tag`
- `api_env_vars`
- `web_env_vars`

Terraform automatically loads `*.auto.tfvars` files when you run `terraform plan` or `terraform apply` from this directory. Values from `api_env_vars` are sent to the Render API service, and values from `web_env_vars` are sent to the Render web service.

`DATABASE_URL` and `NODE_ENV` are managed automatically for the API service. Do not duplicate those keys unless you intentionally want the value from `api_env_vars` to override the default.

Any Render service environment variable that should keep existing after this change must be present in Terraform. Once `env_vars` is Terraform-managed, variables that exist only in the Render dashboard can be removed by the next apply.

These values are marked sensitive in Terraform output, but Terraform state can still contain sensitive values. Keep using the configured HCP Terraform remote state and restrict workspace access.

Secret files are still ignored by Terraform. Manage files such as `/etc/secrets/firebase-service-account.json` directly in Render unless you intentionally add `secret_files` management.

`api_env_group_id` remains available if you want to link an existing Render Environment Group to the API service. If a key exists both on the API service and in a linked group, Render service-level environment variables take precedence.

## First-Time Migration From Existing Render Resources

Copy the example variables:

```powershell
Copy-Item .\production.auto.tfvars.example .\production.auto.tfvars
```

Edit `production.auto.tfvars` and set the current image tags and environment variables.

For GitHub Actions, do not commit `production.auto.tfvars`. Put values needed in
CI into the HCP Terraform workspace variables instead. The workflow supplies
`api_image_tag` and `web_image_tag` through `TF_VAR_*` environment variables.

If you want Terraform-created resources to land inside the existing `UITFood` / `Production` Render Project environment, set `project_environment_id`. You can find it in the Render dashboard URL when viewing the project environment. Existing imported resources already carry their environment in state, but setting the variable makes the desired target explicit.

Initialize Terraform:

```powershell
terraform init
```

Import existing resources before applying. Replace the IDs with the IDs from your Render dashboard URLs.

```powershell
terraform import render_web_service.api srv_xxxxxxxxxxxxxxxxxxxx
terraform import render_web_service.web srv_xxxxxxxxxxxxxxxxxxxx
terraform import render_postgres.main dpg_xxxxxxxxxxxxxxxxxxxx
```

Then inspect the plan:

```powershell
terraform plan
```

Do not run `terraform apply` until the plan shows no unexpected replacement or deletion. Pay special attention to `env_vars`, `secret_files`, image tags, and Postgres settings.

Without these imports, Terraform treats the configuration as new infrastructure and will create new Render resources.

## Normal Usage

After migration:

```powershell
terraform plan
terraform apply
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
