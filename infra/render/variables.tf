variable "region" {
  description = "Render region for all resources."
  type        = string
  default     = "singapore"
}

variable "render_environment_id" {
  description = "Optional Render Project Environment ID for UITFood / Production. Leave null to create resources outside a project environment."
  type        = string
  default     = null
}

variable "web_service_plan" {
  description = "Render web service instance type. render.yaml used free; the Terraform provider docs for render_web_service currently list paid plans only."
  type        = string
  default     = "free"
}

variable "postgres_plan" {
  description = "Render Postgres plan."
  type        = string
  default     = "free"
}

variable "web_image_repository" {
  description = "GHCR repository for the web image, without tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/soli-food-order-and-deliver-app-web"
}

variable "api_image_repository" {
  description = "GHCR repository for the API image, without tag."
  type        = string
  default     = "ghcr.io/ndtruongdanh/soli-food-order-and-deliver-app-api"
}

variable "image_tag" {
  description = "Default Docker image tag for both services."
  type        = string
  default     = "sha-05beb43"
}

variable "web_image_tag" {
  description = "Optional web image tag override."
  type        = string
  default     = null
}

variable "api_image_tag" {
  description = "Optional API image tag override."
  type        = string
  default     = null
}

variable "web_registry_credential_id" {
  description = "Optional Render registry credential ID for pulling a private web image."
  type        = string
  default     = null
}

variable "api_registry_credential_id" {
  description = "Optional Render registry credential ID for pulling a private API image."
  type        = string
  default     = null
}

variable "api_env_vars" {
  description = "Sensitive API environment variables exported from render.yaml as sync: false."
  type        = map(string)
  sensitive   = true

  validation {
    condition = alltrue([
      can(var.api_env_vars["BETTER_AUTH_URL"]),
      can(var.api_env_vars["CORS_ORIGIN"]),
      can(var.api_env_vars["REDIS_PORT"]),
      can(var.api_env_vars["REDIS_HOST"]),
      can(var.api_env_vars["FIREBASE_SERVICE_ACCOUNT_PATH"]),
      can(var.api_env_vars["soli-food-delivery-FCM-key.json"]),
      can(var.api_env_vars["CLOUDINARY_API_SECRET"]),
      can(var.api_env_vars["CLOUDINARY_API_KEY"]),
      can(var.api_env_vars["CLOUDINARY_CLOUD_NAME"]),
      can(var.api_env_vars["SMTP_FROM"]),
      can(var.api_env_vars["SMTP_PASS"]),
      can(var.api_env_vars["SMTP_USER"]),
      can(var.api_env_vars["SMTP_SECURE"]),
      can(var.api_env_vars["SMTP_PORT"]),
      can(var.api_env_vars["SMTP_HOST"]),
      can(var.api_env_vars["VNPAY_RETURN_URL"]),
      can(var.api_env_vars["VNPAY_URL"]),
      can(var.api_env_vars["VNPAY_HASH_SECRET"]),
      can(var.api_env_vars["VNPAY_TMN_CODE"]),
      can(var.api_env_vars["BETTER_AUTH_SECRET"]),
    ])
    error_message = "api_env_vars must include every sync:false API environment variable from render.yaml."
  }
}
