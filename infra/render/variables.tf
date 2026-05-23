variable "environment" {
  description = "Logical environment name used for tagging/naming conventions."
  type        = string
  default     = "production"
}

variable "region" {
  description = "Render region for all production resources."
  type        = string
  default     = "singapore"
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

variable "postgres_name" {
  description = "Render Postgres instance name."
  type        = string
  default     = "UITFood Postgres"
}

variable "service_plan" {
  description = "Render web service plan."
  type        = string
  default     = "free"
}

variable "postgres_plan" {
  description = "Render Postgres plan."
  type        = string
  default     = "free"
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

variable "postgres_ip_allow_list" {
  description = "CIDR ranges allowed to connect to Postgres externally. Use an empty list to allow private-network connections only."
  type = list(object({
    cidr_block  = string
    description = string
  }))
  default = [
    {
      cidr_block  = "0.0.0.0/0"
      description = "everywhere"
    }
  ]
}

variable "api_image_url" {
  description = "Container image repository for the API, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/soli-food-order-and-deliver-app-api"
}

variable "web_image_url" {
  description = "Container image repository for the web frontend, without a tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/soli-food-order-and-deliver-app-web"
}

variable "api_image_tag" {
  description = "Container image tag for the API service."
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

variable "api_health_check_path" {
  description = "Optional API health check path."
  type        = string
  default     = null
}

variable "web_health_check_path" {
  description = "Optional web health check path."
  type        = string
  default     = null
}

variable "api_env_group_id" {
  description = "Optional existing Render environment group ID that contains API runtime secrets."
  type        = string
  default     = ""
}
