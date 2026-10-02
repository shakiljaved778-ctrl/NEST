output "api_url" {
  description = "Internal URL of the AMIL API (put the bank's load balancer in front)."
  value       = google_cloud_run_v2_service.api.uri
}

output "console_url" {
  description = "Internal URL of the bank console (behind the bank's identity-aware proxy)."
  value       = google_cloud_run_v2_service.console.uri
}

output "pii_kms_key" {
  description = "KMS key that wraps the PII data keys (envelope encryption, D-066)."
  value       = google_kms_crypto_key.pii.id
}

output "secrets_to_populate" {
  description = "Secret Manager secrets to fill out of band before the first release."
  value       = [for s in google_secret_manager_secret.secret : s.secret_id]
}
