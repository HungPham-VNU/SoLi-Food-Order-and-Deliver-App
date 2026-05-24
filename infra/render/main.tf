locals {
  has_api_env_group = trimspace(var.api_env_group_id) != ""
}

resource "render_postgres" "main" {
  name           = var.postgres_name
  plan           = var.postgres_plan
  region         = var.region
  version        = var.postgres_version
  database_name  = var.postgres_database_name
  database_user  = var.postgres_database_user
  environment_id = var.project_environment_id

  ip_allow_list = var.postgres_ip_allow_list
}

resource "render_web_service" "api" {
  name              = var.api_service_name
  plan              = var.service_plan
  region            = var.region
  custom_domains    = var.api_custom_domains
  environment_id    = var.project_environment_id
  health_check_path = var.api_health_check_path

  runtime_source = {
    image = {
      image_url = var.api_image_url
      tag       = var.api_image_tag
    }
  }

  # Runtime secrets such as BETTER_AUTH_SECRET, CLOUDINARY_*, SMTP_*,
  # VNPAY_*, Firebase, and Redis stay in Render by default. This prevents
  # Terraform state from becoming the application's secret store.
  env_vars = {
    DATABASE_URL = {
      value = render_postgres.main.connection_info.internal_connection_string
    }
    NODE_ENV = {
      value = "production"
    }
  }

  # NOTE: Ignoring env_vars/secret_files allows you to safely manage runtime
  # secrets/config in the Render dashboard without Terraform overwriting them.
  # CAVEAT: Any subsequent updates to env_vars in this file (e.g., DATABASE_URL)
  # will NOT be applied to existing services by Terraform; they must be updated
  # manually in the Render console.
  lifecycle {
    ignore_changes = [
      env_vars,
      secret_files,
    ]
  }
}

resource "render_web_service" "web" {
  name              = var.web_service_name
  plan              = var.service_plan
  region            = var.region
  custom_domains    = var.web_custom_domains
  environment_id    = var.project_environment_id
  health_check_path = var.web_health_check_path

  runtime_source = {
    image = {
      image_url = var.web_image_url
      tag       = var.web_image_tag
    }
  }

  # NOTE: Ignoring env_vars/secret_files allows you to safely manage runtime
  # secrets/config in the Render dashboard without Terraform overwriting them.
  # CAVEAT: Any subsequent updates to env_vars in this file will NOT be applied
  # to existing services by Terraform; they must be updated manually in the Render console.
  lifecycle {
    ignore_changes = [
      env_vars,
      secret_files,
    ]
  }
}


resource "render_env_group_link" "api_runtime_secrets" {
  count = local.has_api_env_group ? 1 : 0

  env_group_id = var.api_env_group_id
  service_ids = [
    render_web_service.api.id,
  ]
}
