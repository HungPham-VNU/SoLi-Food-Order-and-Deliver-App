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
      MEDIA_TCP_HOST = {
        value = coalesce(trimspace(var.media_tcp_host), render_private_service.media.slug)
      }
      MEDIA_TCP_PORT = {
        value = tostring(var.media_tcp_port)
      }
      MEDIA_RPC_TIMEOUT_MS = {
        value = tostring(var.media_rpc_timeout_ms)
      }
      MEDIA_RPC_MAX_ATTEMPTS = {
        value = tostring(var.media_rpc_max_attempts)
      }
      MEDIA_RPC_REQUIRED = {
        value = "true"
      }
      LEGACY_MEDIA_ROUTES_ENABLED = {
        value = tostring(var.legacy_media_routes_enabled)
      }
      LEGACY_NOTIFICATION_ROUTES_ENABLED = {
        value = tostring(var.legacy_notification_routes_enabled)
      }
      LEGACY_NOTIFICATION_RUNTIME_ENABLED = {
        value = tostring(var.legacy_notification_runtime_enabled)
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
      MEDIA_ROUTES_ENABLED = {
        value = tostring(var.media_routes_enabled)
      }
      MEDIA_TCP_HOST = {
        value = coalesce(trimspace(var.media_tcp_host), render_private_service.media.slug)
      }
      MEDIA_TCP_PORT = {
        value = tostring(var.media_tcp_port)
      }
      MEDIA_MANAGEMENT_PORT = {
        value = tostring(var.media_management_port)
      }
      MEDIA_RPC_TIMEOUT_MS = {
        value = tostring(var.media_rpc_timeout_ms)
      }
      NOTIFICATION_ROUTES_ENABLED = {
        value = tostring(var.notification_routes_enabled)
      }
      NOTIFICATION_TCP_HOST = {
        value = coalesce(trimspace(var.notification_tcp_host), render_private_service.notification.slug)
      }
      NOTIFICATION_TCP_PORT = {
        value = tostring(var.notification_tcp_port)
      }
      NOTIFICATION_MANAGEMENT_PORT = {
        value = tostring(var.notification_management_port)
      }
      NOTIFICATION_RPC_TIMEOUT_MS = {
        value = tostring(var.notification_rpc_timeout_ms)
      }
      GATEWAY_AUTH_TIMEOUT_MS = {
        value = tostring(var.gateway_auth_timeout_ms)
      }
      GATEWAY_CORS_ORIGINS = {
        value = var.gateway_cors_origins
      }
    },
    {
      for key, value in var.gateway_env_vars : key => {
        value = value
      }
    }
  )
  media_env_vars = merge(
    {
      DATABASE_URL = {
        value = render_postgres.media.connection_info.internal_connection_string
      }
      NODE_ENV = {
        value = "production"
      }
      APP_ENV = {
        value = var.environment
      }
      MEDIA_TCP_PORT = {
        value = tostring(var.media_tcp_port)
      }
      MEDIA_MANAGEMENT_PORT = {
        value = tostring(var.media_management_port)
      }
    },
    {
      for key, value in var.media_env_vars : key => {
        value = value
      }
    }
  )
  notification_env_vars = merge(
    {
      DATABASE_URL = {
        value = render_postgres.notification.connection_info.internal_connection_string
      }
      REDIS_URL = {
        value = render_keyvalue.notification.connection_info.internal_connection_string
      }
      NODE_ENV = {
        value = "production"
      }
      APP_ENV = {
        value = var.environment
      }
      NOTIFICATION_TCP_PORT = {
        value = tostring(var.notification_tcp_port)
      }
      NOTIFICATION_MANAGEMENT_PORT = {
        value = tostring(var.notification_management_port)
      }
    },
    {
      for key, value in var.notification_env_vars : key => {
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

resource "render_postgres" "media" {
  name           = var.media_postgres_name
  plan           = var.media_postgres_plan
  region         = var.region
  version        = var.postgres_version
  database_name  = var.media_postgres_database_name
  database_user  = var.media_postgres_database_user
  environment_id = var.project_environment_id

  ip_allow_list = var.postgres_ip_allow_list
}

resource "render_postgres" "notification" {
  name           = var.notification_postgres_name
  plan           = var.notification_postgres_plan
  region         = var.region
  version        = var.postgres_version
  database_name  = var.notification_postgres_database_name
  database_user  = var.notification_postgres_database_user
  environment_id = var.project_environment_id

  ip_allow_list = var.postgres_ip_allow_list
}

resource "render_keyvalue" "notification" {
  name              = var.notification_keyvalue_name
  plan              = var.notification_keyvalue_plan
  region            = var.region
  max_memory_policy = var.notification_keyvalue_max_memory_policy
  environment_id    = var.project_environment_id

  ip_allow_list = var.notification_keyvalue_ip_allow_list
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

resource "render_private_service" "media" {
  name           = var.media_service_name
  plan           = var.media_service_plan
  region         = var.region
  environment_id = var.project_environment_id

  runtime_source = {
    image = {
      image_url = var.media_image_url
      tag       = var.media_image_tag
    }
  }

  env_vars = local.media_env_vars

  lifecycle {
    ignore_changes = [
      secret_files,
    ]
  }
}

resource "render_private_service" "notification" {
  name           = var.notification_service_name
  plan           = var.notification_service_plan
  region         = var.region
  environment_id = var.project_environment_id

  runtime_source = {
    image = {
      image_url = var.notification_image_url
      tag       = var.notification_image_tag
    }
  }

  env_vars = local.notification_env_vars

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
