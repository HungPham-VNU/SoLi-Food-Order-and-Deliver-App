locals {
  has_api_env_group = trimspace(var.api_env_group_id) != ""
  api_env_vars = merge(
    {
      DATABASE_URL = {
        value = render_postgres.main.connection_info.internal_connection_string
      }
      NODE_ENV = {
        value = "production"
      }
      APP_ENV = {
        value = var.environment
      }
    },
    {
      for key, value in var.api_env_vars : key => {
        value = value
      }
    }
  )
  web_env_vars = {
    for key, value in var.web_env_vars : key => {
      value = value
    }
  }
  gateway_env_vars = merge(
    {
      NODE_ENV = {
        value = "production"
      }
      # Where the gateway proxies. Falls back to the managed API service URL when
      # an explicit upstream is not provided. Render injects PORT automatically.
      MONOLITH_UPSTREAM_URL = {
        value = coalesce(
          trimspace(var.gateway_monolith_upstream_url),
          render_web_service.api.url,
        )
      }
    },
    {
      for key, value in var.gateway_env_vars : key => {
        value = value
      }
    }
  )
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

  env_vars = local.api_env_vars

  # Keep secret files in Render unless Terraform should own their full contents.
  lifecycle {
    ignore_changes = [
      secret_files,
    ]
  }
}

resource "render_web_service" "gateway" {
  name              = var.gateway_service_name
  plan              = var.service_plan
  region            = var.region
  custom_domains    = var.gateway_custom_domains
  environment_id    = var.project_environment_id
  health_check_path = var.gateway_health_check_path

  runtime_source = {
    image = {
      image_url = var.gateway_image_url
      tag       = var.gateway_image_tag
    }
  }

  env_vars = local.gateway_env_vars

  # Keep secret files in Render unless Terraform should own their full contents.
  lifecycle {
    ignore_changes = [
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

  env_vars = local.web_env_vars

  # Keep secret files in Render unless Terraform should own their full contents.
  lifecycle {
    ignore_changes = [
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
