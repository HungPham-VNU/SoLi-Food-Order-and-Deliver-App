output "web_service_url" {
  description = "Public URL for UITFood Web."
  value       = render_web_service.web.url
}

output "api_service_url" {
  description = "Public URL for UITFood API."
  value       = render_web_service.api.url
}

output "postgres_id" {
  description = "Render Postgres ID."
  value       = render_postgres.uitfood.id
}
