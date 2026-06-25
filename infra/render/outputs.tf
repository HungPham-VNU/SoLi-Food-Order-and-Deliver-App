output "api_service_id" {
  description = "Render API service ID."
  value       = render_web_service.api.id
}

output "api_service_url" {
  description = "Render API service URL."
  value       = render_web_service.api.url
}

output "gateway_service_id" {
  description = "Render gateway service ID."
  value       = render_web_service.gateway.id
}

output "gateway_service_url" {
  description = "Render gateway service URL (the future public origin)."
  value       = render_web_service.gateway.url
}

output "media_service_id" {
  description = "Render private Media service ID."
  value       = render_private_service.media.id
}

output "media_private_hostname" {
  description = "Private-network hostname used by Gateway and API TCP clients."
  value       = render_private_service.media.slug
}

output "notification_service_id" {
  description = "Render private Notification service ID."
  value       = render_private_service.notification.id
}

output "notification_private_hostname" {
  description = "Private-network hostname used by Gateway Socket.IO and TCP clients."
  value       = render_private_service.notification.slug
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

output "media_postgres_id" {
  description = "Media-owned Render Postgres ID."
  value       = render_postgres.media.id
}

output "media_postgres_internal_connection_string" {
  description = "Internal Media database URL; only the Media service receives it."
  value       = render_postgres.media.connection_info.internal_connection_string
  sensitive   = true
}

output "notification_postgres_id" {
  description = "Notification-owned Render Postgres ID."
  value       = render_postgres.notification.id
}

output "notification_postgres_internal_connection_string" {
  description = "Internal Notification database URL; only the Notification service receives it."
  value       = render_postgres.notification.connection_info.internal_connection_string
  sensitive   = true
}

output "notification_keyvalue_id" {
  description = "Notification-owned Render Key Value ID."
  value       = render_keyvalue.notification.id
}

output "notification_keyvalue_internal_connection_string" {
  description = "Internal Notification Key Value URL; only the Notification service receives it."
  value       = render_keyvalue.notification.connection_info.internal_connection_string
  sensitive   = true
}
