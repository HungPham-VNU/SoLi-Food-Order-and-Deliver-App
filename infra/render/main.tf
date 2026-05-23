terraform {
  required_version = ">= 1.3.0"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
  }
}

provider "render" {}

locals {
  # These were exported from Render as envVars with sync: false. Terraform needs
  # concrete values, supplied through var.api_env_vars, to keep managing them.
  api_secret_env_var_names = [
    "BETTER_AUTH_URL",
    "CORS_ORIGIN",
    "REDIS_PORT",
    "REDIS_HOST",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "soli-food-delivery-FCM-key.json",
    "CLOUDINARY_API_SECRET",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "SMTP_FROM",
    "SMTP_PASS",
    "SMTP_USER",
    "SMTP_SECURE",
    "SMTP_PORT",
    "SMTP_HOST",
    "VNPAY_RETURN_URL",
    "VNPAY_URL",
    "VNPAY_HASH_SECRET",
    "VNPAY_TMN_CODE",
    "BETTER_AUTH_SECRET",
  ]

  api_secret_env_vars = {
    for key in local.api_secret_env_var_names : key => {
      value = var.api_env_vars[key]
    }
  }

  common_service_settings = {
    plan           = var.web_service_plan
    region         = var.region
    environment_id = var.render_environment_id == null || var.render_environment_id == "" ? null : var.render_environment_id
  }
}

resource "render_postgres" "uitfood" {
  name           = "UITFood Postgres"
  database_name  = "uitfood_db"
  database_user  = "nestjs"
  plan           = var.postgres_plan
  region         = var.region
  version        = "18"
  environment_id = local.common_service_settings.environment_id

  ip_allow_list = [
    {
      cidr_block  = "0.0.0.0/0"
      description = "everywhere"
    },
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "render_web_service" "web" {
  name           = "UITFood Web"
  plan           = local.common_service_settings.plan
  region         = local.common_service_settings.region
  environment_id = local.common_service_settings.environment_id

  runtime_source = {
    image = {
      image_url              = var.web_image_repository
      tag                    = coalesce(var.web_image_tag, var.image_tag)
      registry_credential_id = var.web_registry_credential_id
    }
  }
}

resource "render_web_service" "api" {
  name           = "UITFood API"
  plan           = local.common_service_settings.plan
  region         = local.common_service_settings.region
  environment_id = local.common_service_settings.environment_id

  runtime_source = {
    image = {
      image_url              = var.api_image_repository
      tag                    = coalesce(var.api_image_tag, var.image_tag)
      registry_credential_id = var.api_registry_credential_id
    }
  }

  env_vars = merge(
    local.api_secret_env_vars,
    {
      DATABASE_URL = {
        value = render_postgres.uitfood.connection_info.internal_connection_string
      }
    }
  )
}
