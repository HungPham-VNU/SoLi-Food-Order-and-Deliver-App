output "api_service_id" {
  description = "Render API service ID."
  value       = render_web_service.api.id
}

output "api_service_url" {
  description = "Render API service URL."
  value       = render_web_service.api.url
}

output "web_service_id" {
  description = "Render web service ID."
  value       = render_web_service.web.id
}

output "web_service_url" {
  description = "Render web service URL."
  value       = render_web_service.web.url
}

output "postgres_id" {
  description = "Render Postgres ID."
  value       = render_postgres.main.id
}

output "postgres_internal_connection_string" {
  description = "Internal Postgres connection string used by Render services."
  value       = render_postgres.main.connection_info.internal_connection_string
  sensitive   = true
}

