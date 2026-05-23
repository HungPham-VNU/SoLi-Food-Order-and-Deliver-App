# Render Terraform

This directory translates the current `render.yaml` Blueprint into Terraform for
Render's official `render-oss/render` provider.

## Viability

Terraform is viable if you want GitHub Actions, another CI system, or a local
machine to apply Render IaC without connecting a Git provider directly to Render.
The provider uses `RENDER_API_KEY` and `RENDER_OWNER_ID`, so the automation
boundary moves from Render's Blueprint sync to your Terraform runner.

The important tradeoffs:

- `sync: false` in `render.yaml` does not translate directly. Terraform needs
  actual secret values, supplied through the sensitive `api_env_vars` variable.
- The current provider docs for `render_web_service` list paid service plans
  (`starter`, `standard`, `pro`, etc.) and do not list `free`, while your
  Blueprint uses `free`. Keep the default as `free` to avoid accidental billing,
  but expect `terraform validate` or `terraform apply` may require changing
  `web_service_plan` to a paid plan such as `starter`.
- `autoDeployTrigger: commit` is a Git-backed Blueprint concept. These services
  are image-backed, so the deploy trigger becomes a Terraform change to the image
  tag or service configuration.
- Project/environment grouping is represented by `render_environment_id`. Set it
  to the existing Render Production environment ID if you want the resources under
  the same project environment.

## Local usage

First configure persistent Terraform state. For CI/CD, rename
`backend.tf.example` to `backend.tf` and fill in your backend settings. HCP
Terraform is the simplest option if you do not already have S3, Azure Storage,
GCS, or another state backend.

```bash
cd infra/render
export RENDER_API_KEY="..."
export RENDER_OWNER_ID="usr-or-tea-..."
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Do not commit a real `terraform.tfvars`; it will contain secrets.

## Migrating existing Render resources

Because `render.yaml` was exported from existing Render resources, import those
resources into Terraform state before the first apply:

```bash
terraform import render_web_service.web srv-...
terraform import render_web_service.api srv-...
terraform import render_postgres.uitfood dpg-...
```

Use the service/database IDs from the Render Dashboard or API. After imports,
run `terraform plan` and reconcile any drift before enabling apply on `master`.

## GitHub Actions

The `Render IaC` workflow runs `fmt` and `validate` immediately. It runs
`plan` and `apply` only after `infra/render/backend.tf` exists, because applying
from an ephemeral GitHub runner without remote state would be unsafe.

Required GitHub secrets:

- `RENDER_API_KEY`
- `RENDER_OWNER_ID`
- `RENDER_API_ENV_VARS_JSON`: JSON map matching the `api_env_vars` example

Optional GitHub variables:

- `RENDER_ENVIRONMENT_ID`
- `RENDER_IMAGE_TAG`
