variable "environment" {
  description = "Logical environment name used for tagging/naming conventions."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "The environment variable must be one of: production, staging, development."
  }
}

variable "region" {
  description = "Render region for all production resources."
  type        = string
  default     = "singapore"

  validation {
    condition     = contains(["singapore", "oregon", "frankfurt", "ohio"], var.region)
    error_message = "Render region must be one of: singapore, oregon, frankfurt, ohio."
  }
}

variable "project_environment_id" {
  description = "Optional existing Render project environment ID, such as the Production environment inside the UITFood project."
  type        = string
  default     = null
}

variable "web_service_name" {
  description = "Render service name for the web frontend."
  type        = string
  default     = "UITFood Web"
}

variable "api_service_name" {
  description = "Render service name for the API."
  type        = string
  default     = "UITFood API"
}

variable "gateway_service_name" {
  description = "Render service name for the edge gateway."
  type        = string
  default     = "UITFood Gateway"
}

variable "media_service_name" {
  description = "Private-network DNS/service name for the Media service."
  type        = string
  default     = "uitfood-media"
}

variable "notification_service_name" {
  description = "Private-network DNS/service name for the Notification service."
  type        = string
  default     = "uitfood-notification"
}

variable "postgres_name" {
  description = "Render Postgres instance name."
  type        = string
  default     = "UITFood Postgres"
}

variable "media_postgres_name" {
  description = "Render Postgres instance name dedicated to Media."
  type        = string
  default     = "UITFood Media Postgres"
}

variable "notification_postgres_name" {
  description = "Render Postgres instance name dedicated to Notification."
  type        = string
  default     = "UITFood Notification Postgres"
}

variable "notification_keyvalue_name" {
  description = "Render Key Value instance name dedicated to Notification Redis-compatible state."
  type        = string
  default     = "UITFood Notification Key Value"
}

variable "service_plan" {
  description = "Render web service plan."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "plus"], var.service_plan)
    error_message = "The service_plan must be a valid Render plan: free, starter, standard, pro, or plus."
  }
}

variable "media_service_plan" {
  description = "Render private services require a paid compute plan."
  type        = string
  default     = "starter"

  validation {
    condition     = contains(["starter", "standard", "pro", "pro_plus", "pro_max", "pro_ultra"], var.media_service_plan)
    error_message = "media_service_plan must be a private-service capable Render plan."
  }
}

variable "notification_service_plan" {
  description = "Render private services require a paid compute plan."
  type        = string
  default     = "starter"

  validation {
    condition     = contains(["starter", "standard", "pro", "pro_plus", "pro_max", "pro_ultra"], var.notification_service_plan)
    error_message = "notification_service_plan must be a private-service capable Render plan."
  }
}

variable "postgres_plan" {
  description = "Render Postgres plan."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "plus"], var.postgres_plan)
    error_message = "The postgres_plan must be a valid Render plan: free, starter, standard, pro, or plus."
  }
}

variable "media_postgres_plan" {
  description = "Render Postgres plan for the Media-owned database."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "plus"], var.media_postgres_plan)
    error_message = "media_postgres_plan must be a valid Render Postgres plan."
  }
}

variable "notification_postgres_plan" {
  description = "Render Postgres plan for the Notification-owned database."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "plus"], var.notification_postgres_plan)
    error_message = "notification_postgres_plan must be a valid Render Postgres plan."
  }
}

variable "notification_keyvalue_plan" {
  description = "Render Key Value plan for Notification-owned Redis-compatible state."
  type        = string
  default     = "starter"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "pro_plus"], var.notification_keyvalue_plan)
    error_message = "notification_keyvalue_plan must be a valid Render Key Value plan."
  }
}

variable "notification_keyvalue_max_memory_policy" {
  description = "Eviction policy for Notification Key Value. Presence/unread cache data is non-authoritative."
  type        = string
  default     = "allkeys_lru"

  validation {
    condition = contains([
      "allkeys_lfu",
      "allkeys_lru",
      "allkeys_random",
      "noeviction",
      "volatile_lfu",
      "volatile_lru",
      "volatile_random",
      "volatile_ttl",
    ], var.notification_keyvalue_max_memory_policy)
    error_message = "notification_keyvalue_max_memory_policy must be a valid Render max memory policy."
  }
}

variable "postgres_version" {
  description = "Postgres major version."
  type        = string
  default     = "18"
}

variable "postgres_database_name" {
  description = "Application database name."
  type        = string
  default     = "uitfood_db"
}

variable "postgres_database_user" {
  description = "Application database user."
  type        = string
  default     = "nestjs"
}

variable "media_postgres_database_name" {
  description = "Immutable logical database name owned by Media."
  type        = string
  default     = "uitfood_media"
}

variable "media_postgres_database_user" {
  description = "Immutable database user owned by Media."
  type        = string
  default     = "uitfood_media"
}

variable "notification_postgres_database_name" {
  description = "Immutable logical database name owned by Notification."
  type        = string
  default     = "uitfood_notification"
}

variable "notification_postgres_database_user" {
  description = "Immutable database user owned by Notification."
  type        = string
  default     = "uitfood_notification"
}

variable "postgres_ip_allow_list" {
  description = "CIDR ranges allowed to connect to Postgres externally. Use an empty list to allow private-network connections only."
  type = list(object({
    cidr_block  = string
    description = string
  }))
  default = []
}

variable "notification_keyvalue_ip_allow_list" {
  description = "CIDR ranges allowed to connect to Notification Key Value externally. Empty list means private-network only."
  type = list(object({
    cidr_block  = string
    description = string
  }))
  default = []
}

variable "api_image_url" {
  description = "Container image repository for the API, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/uitfood-api"
}

variable "web_image_url" {
  description = "Container image repository for the web frontend, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/uitfood-web"
}

variable "gateway_image_url" {
  description = "Container image repository for the gateway, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/uitfood-gateway"
}

variable "media_image_url" {
  description = "Container image repository for Media, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/uitfood-media"
}

variable "notification_image_url" {
  description = "Container image repository for Notification, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/uitfood-notification"
}

variable "api_image_tag" {
  description = "Container image tag for the API service."
  type        = string
}

variable "gateway_image_tag" {
  description = "Container image tag for the gateway service."
  type        = string
}

variable "media_image_tag" {
  description = "Container image tag for the Media service."
  type        = string
}

variable "notification_image_tag" {
  description = "Container image tag for the Notification service."
  type        = string
}

variable "web_image_tag" {
  description = "Container image tag for the web service."
  type        = string
}

variable "api_custom_domains" {
  description = "Custom domains attached to the API service."
  type = set(object({
    name = string
  }))
  default = null
}

variable "web_custom_domains" {
  description = "Custom domains attached to the web service."
  type = set(object({
    name = string
  }))
  default = null
}

variable "gateway_custom_domains" {
  description = "Custom domains attached to the gateway service. Once cut over, the public domain points here instead of the API."
  type = set(object({
    name = string
  }))
  default = null
}

variable "api_health_check_path" {
  description = "Optional API health check path."
  type        = string
  default     = "/api/ready"
}

variable "gateway_health_check_path" {
  description = "Gateway health check path."
  type        = string
  default     = "/ready"
}

variable "web_health_check_path" {
  description = "Optional web health check path."
  type        = string
  default     = "/healthz"
}

variable "api_env_vars" {
  description = "API service environment variables managed by Terraform. Values are sent to Render on plan/apply and stored in Terraform state."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "web_env_vars" {
  description = "Web service environment variables managed by Terraform. Values are sent to Render on plan/apply and stored in Terraform state."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "api_env_group_id" {
  description = "Optional existing Render environment group ID that contains API runtime secrets."
  type        = string
  default     = ""
}

variable "gateway_env_vars" {
  description = "Gateway service environment variables managed by Terraform (e.g. GATEWAY_PROXY_TIMEOUT_MS). Values are stored in Terraform state."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "media_env_vars" {
  description = "Media-only runtime variables, including Cloudinary credentials."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "notification_env_vars" {
  description = "Notification-only runtime variables, including SMTP/FCM/Redis/RabbitMQ credentials."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "gateway_monolith_upstream_url" {
  description = "Upstream URL the gateway proxies to. When empty, defaults to the managed API service URL."
  type        = string
  default     = ""
}

variable "media_tcp_host" {
  description = "Optional private DNS override; defaults to the Media service slug."
  type        = string
  default     = ""
}

variable "media_tcp_port" {
  description = "Primary private Nest TCP listener port."
  type        = number
  default     = 10000
}

variable "media_management_port" {
  description = "Secondary private HTTP management port."
  type        = number
  default     = 10001
}

variable "media_rpc_timeout_ms" {
  description = "Gateway/API deadline for Media TCP requests."
  type        = number
  default     = 2000
}

variable "media_rpc_max_attempts" {
  description = "Bounded Catalog retries for idempotent image creation."
  type        = number
  default     = 2
}

variable "notification_tcp_host" {
  description = "Optional private DNS override; defaults to the Notification service slug."
  type        = string
  default     = ""
}

variable "notification_tcp_port" {
  description = "Primary private Nest TCP listener port."
  type        = number
  default     = 10002
}

variable "notification_management_port" {
  description = "Secondary private HTTP/Socket.IO management port."
  type        = number
  default     = 10003
}

variable "notification_rpc_timeout_ms" {
  description = "Gateway deadline for Notification TCP requests."
  type        = number
  default     = 3000
}

variable "gateway_auth_timeout_ms" {
  description = "Deadline for the transitional monolith session check."
  type        = number
  default     = 3000
}

variable "gateway_cors_origins" {
  description = "Comma-separated browser origins allowed on Gateway-owned routes."
  type        = string
  default     = "http://localhost:5173,http://localhost:5174"
}

variable "media_routes_enabled" {
  description = "Cutover switch: Gateway owns /api/images and /api/cloudinary."
  type        = bool
  default     = false
}

variable "notification_routes_enabled" {
  description = "Cutover switch: Gateway owns /api/notifications and Socket.IO notification traffic."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# Catalog service (Phase 6): restaurants, menus, modifiers, delivery zones,
# nutrition, dietary tags, and the pgvector AI-search structures.
# ---------------------------------------------------------------------------

variable "catalog_service_name" {
  description = "Private-network DNS/service name for the Catalog service."
  type        = string
  default     = "uitfood-catalog"
}

variable "catalog_service_plan" {
  description = "Render private services require a paid compute plan."
  type        = string
  default     = "starter"

  validation {
    condition     = contains(["starter", "standard", "pro", "pro_plus", "pro_max", "pro_ultra"], var.catalog_service_plan)
    error_message = "catalog_service_plan must be a private-service capable Render plan."
  }
}

variable "catalog_postgres_name" {
  description = "Render Postgres instance name dedicated to Catalog (pgvector enabled)."
  type        = string
  default     = "UITFood Catalog Postgres"
}

variable "catalog_postgres_plan" {
  description = "Render Postgres plan for the Catalog-owned database."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "plus"], var.catalog_postgres_plan)
    error_message = "catalog_postgres_plan must be a valid Render Postgres plan."
  }
}

variable "catalog_postgres_database_name" {
  description = "Immutable logical database name owned by Catalog."
  type        = string
  default     = "uitfood_catalog"
}

variable "catalog_postgres_database_user" {
  description = "Immutable database user owned by Catalog."
  type        = string
  default     = "uitfood_catalog"
}

variable "catalog_image_url" {
  description = "Container image repository for Catalog, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/uitfood-catalog"
}

variable "catalog_image_tag" {
  description = "Container image tag for the Catalog service."
  type        = string
}

variable "catalog_env_vars" {
  description = "Catalog-only runtime variables: RABBITMQ_URL, INTERNAL_AUTH_*, IDENTITY_TCP_HOST, OLLAMA_*, AI_SEARCH_*."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "catalog_tcp_host" {
  description = "Optional private DNS override; defaults to the Catalog service slug."
  type        = string
  default     = ""
}

variable "catalog_tcp_port" {
  description = "Primary private Nest TCP listener port."
  type        = number
  default     = 10004
}

variable "catalog_management_port" {
  description = "Secondary private HTTP management port."
  type        = number
  default     = 10005
}

variable "catalog_rpc_timeout_ms" {
  description = "Gateway deadline for Catalog TCP requests."
  type        = number
  default     = 4000
}

variable "catalog_routes_enabled" {
  description = "Cutover switch: Gateway owns /api/restaurants, /api/menu-items, /api/search, /api/dietary-tags."
  type        = bool
  default     = false
}

variable "legacy_media_routes_enabled" {
  description = "Rollback switch for legacy API Media routes. Disable at cutover."
  type        = bool
  default     = true
}

variable "legacy_notification_routes_enabled" {
  description = "Rollback switch for legacy API Notification routes. Disable at cutover."
  type        = bool
  default     = true
}

variable "legacy_notification_runtime_enabled" {
  description = "Rollback switch for legacy API Notification event handlers, Socket.IO gateway, and cleanup task."
  type        = bool
  default     = true
}
